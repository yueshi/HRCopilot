/**
 * OpenAI API 兼容基类
 * 为 GLM、Ollama 和自定义供应商提供 OpenAI API 格式的支持
 *
 * 注意：此类为内部实现，不直接作为供应商类型暴露给用户
 */

import axios, { AxiosError } from "axios";
import { BaseLLMProvider, type StreamOptions } from "./BaseLLMProvider";
import type {
  LLMMessage,
  LLMParameters,
  LLMProvider,
  LLMCallResponseResult,
  LLMProviderTestResult,
} from "../../../shared/types/llm";
import { logger } from "../../utils/logger";

interface OpenAIChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface OpenAIStreamChoice {
  index: number;
  delta: {
    role?: string;
    content?: string;
  };
  finish_reason: string | null;
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIStreamChoice[];
}

export class OpenAIProvider extends BaseLLMProvider {
  constructor(config: LLMProvider) {
    super(config);
  }

  /**
   * 获取请求头
   */
  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * 构建请求体
   */
  protected buildRequestBody(
    messages: LLMMessage[],
    model: string,
    parameters: LLMParameters,
    stream = false,
  ): unknown {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream,
    };

    // 添加可选参数
    if (parameters.temperature !== undefined) {
      body.temperature = parameters.temperature;
    }
    if (parameters.max_tokens !== undefined) {
      body.max_tokens = parameters.max_tokens;
    }
    if (parameters.top_p !== undefined) {
      body.top_p = parameters.top_p;
    }
    if (parameters.frequency_penalty !== undefined) {
      body.frequency_penalty = parameters.frequency_penalty;
    }
    if (parameters.presence_penalty !== undefined) {
      body.presence_penalty = parameters.presence_penalty;
    }
    if (parameters.stop !== undefined) {
      body.stop = parameters.stop;
    }

    return body;
  }

  /**
   * 解析响应
   */
  protected parseResponse(responseData: unknown): LLMCallResponseResult {
    const data = responseData as OpenAIResponse;
    const choice = data.choices[0];

    return {
      content: choice.message.content,
      model: data.model,
      provider_id: this.providerId,
      usage: data.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * 测试连接
   */
  async testConnection(model?: string): Promise<LLMProviderTestResult> {
    const startTime = Date.now();

    try {
      // 使用简单的测试消息
      const testMessages: LLMMessage[] = [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hi" },
      ];

      const testModel = model || this.models[0] || "gpt-3.5-turbo";

      await this.chat(testMessages, testModel, {
        temperature: 0.7,
        max_tokens: 10,
        timeout_ms: 10000,
      });

      const latency_ms = Date.now() - startTime;

      // 尝试获取可用模型列表
      let available_models: string[] | undefined;
      try {
        available_models = await this.fetchModels();
      } catch (error) {
        logger.warn("获取模型列表失败:", error);
        // 使用默认模型列表
        available_models = this.models.length > 0 ? this.models : undefined;
      }

      return {
        success: true,
        message: "连接成功",
        latency_ms,
        available_models,
      };
    } catch (error) {
      const errorMessage = this.formatError(error);
      return {
        success: false,
        message: `连接失败: ${errorMessage}`,
      };
    }
  }

  /**
   * 获取可用模型列表
   */
  async fetchModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: this.getHeaders(),
        timeout: 10000,
      });

      const data = response.data as { data?: Array<{ id: string }> };

      if (data.data && Array.isArray(data.data)) {
        return data.data.map((model) => model.id);
      }

      return [];
    } catch (error) {
      logger.error("获取模型列表失败:", error);
      // 如果 API 调用失败，返回配置的模型列表
      return this.models;
    }
  }

  /**
   * 非流式对话
   */
  async chat(
    messages: LLMMessage[],
    model: string,
    parameters: LLMParameters,
  ): Promise<LLMCallResponseResult> {
    const url = `${this.baseUrl}/chat/completions`;
    const timeout = parameters.timeout_ms || 30000;

    try {
      const response = await axios.post(
        url,
        this.buildRequestBody(messages, model, parameters, false),
        {
          headers: this.getHeaders(),
          timeout,
        },
      );

      return this.parseResponse(response.data);
    } catch (error) {
      throw new Error(this.formatError(error));
    }
  }

  /**
   * 流式对话
   */
  async chatStream(
    messages: LLMMessage[],
    model: string,
    parameters: LLMParameters,
    options: StreamOptions,
  ): Promise<void> {
    const url = `${this.baseUrl}/chat/completions`;
    const timeout = parameters.timeout_ms || 30000;

    try {
      const response = await axios.post(
        url,
        this.buildRequestBody(messages, model, parameters, true),
        {
          headers: this.getHeaders(),
          timeout,
          responseType: "stream",
        },
      );

      const stream = response.data as NodeJS.ReadableStream;
      let fullContent = "";

      stream.on("data", (chunk: Buffer) => {
        const lines = chunk.toString().split("\n");

        for (const line of lines) {
          if (line.trim() === "") continue;
          if (line.trim() === "data: [DONE]") continue;

          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as OpenAIStreamResponse;
              const choice = data.choices[0];

              if (choice?.delta?.content) {
                const content = choice.delta.content;
                fullContent += content;

                if (options.onChunk) {
                  options.onChunk(content);
                }
              }
            } catch (error) {
              logger.warn("解析流式响应失败:", line, error);
            }
          }
        }
      });

      stream.on("end", () => {
        if (options.onDone) {
          options.onDone(fullContent);
        }
      });

      stream.on("error", (error: Error) => {
        if (options.onError) {
          options.onError(error);
        }
      });
    } catch (error) {
      const formattedError = new Error(this.formatError(error));
      if (options.onError) {
        options.onError(formattedError);
      } else {
        throw formattedError;
      }
    }
  }

  /**
   * 格式化错误
   */
  protected formatError(error: unknown): string {
    if (error instanceof AxiosError) {
      const response = error.response?.data as { error?: { message?: string } };
      if (response?.error?.message) {
        return response.error.message;
      }
      return error.message;
    }
    return String(error);
  }
}
