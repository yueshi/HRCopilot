/**
 * OpenAI 供应商适配器
 * 兼容 OpenAI API 格式的服务
 */

import { BaseLLMProvider, type StreamOptions } from "./BaseLLMProvider";
import type {
  LLMProvider,
  LLMMessage,
  LLMParameters,
  LLMCallResponseResult,
  LLMProviderTestResult,
} from "../../../shared/types/llm";
import { logger } from "../../utils/logger";

export class OpenAIProvider extends BaseLLMProvider {
  /**
   * 测试连接
   */
  async testConnection(model?: string): Promise<LLMProviderTestResult> {
    const startTime = Date.now();

    try {
      const models = await this.fetchModels();

      // 如果指定了模型，检查是否可用
      if (model && !models.includes(model)) {
        return {
          success: false,
          message: `模型 ${model} 不可用`,
          latency_ms: Date.now() - startTime,
        };
      }

      return {
        success: true,
        message: "连接成功",
        latency_ms: Date.now() - startTime,
        available_models: models,
      };
    } catch (error) {
      return {
        success: false,
        message: `连接失败: ${(error as Error).message}`,
        latency_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * 获取可用模型列表
   */
  async fetchModels(): Promise<string[]> {
    try {
      // 检测是否是 OpenAI 官方服务器
      const isOpenAiOfficial = this.baseUrl.includes("api.openai.com");

      if (isOpenAiOfficial) {
        const response = await this.fetchWithTimeout(
          `${this.baseUrl}/models`,
          {
            method: "GET",
            headers: this.getHeaders(),
          },
        );

        if (!response.ok) {
          await this.handleErrorResponse(response);
        }

        const data = await this.parseJSONResponse(response);
        return (data.data || []).map((m: any) => m.id);
      } else {
        // 对于非官方 OpenAI 服务器（如 GLM、兼容 API），使用本地配置的模型列表
        // 发送一个简单的测试请求来验证连接
        const response = await this.fetchWithTimeout(
          `${this.baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({
              model: "test",
              messages: [{ role: "user", content: "testConnection" }],
              max_tokens: 1,
            }),
          },
        );

        if (!response.ok) {
          // 如果返回 401 或 404，可能是因为模型不存在
          // 对于兼容 API，我们返回空列表，让用户在配置中指定模型
          logger.info("非官方 OpenAI 服务器无法通过 /models 获取列表，返回配置的模型列表");
          return [];
        }

        // 连接成功，返回配置的模型列表或空列表
        logger.info("非官方 OpenAI 服务器连接测试成功");
        return [];
      }
    } catch (error) {
      logger.error("获取模型列表失败:", error);
      throw error;
    }
  }

  /**
   * 发送聊天请求
   */
  async chat(
    messages: LLMMessage[],
    model: string,
    parameters?: LLMParameters,
  ): Promise<LLMCallResponseResult> {
    try {
      const body = this.buildRequestBody(messages, model, parameters);

      const apiUrl = `${this.baseUrl}/chat/completions`;
      const headers = this.getHeaders();

      logger.info(`调用 OpenAI API: model=${model}`, {
        url: apiUrl,
        headers,
        requestBody: body,
      });

      const response = await this.fetchWithTimeout(
        apiUrl,
        {
          method: "POST",
          headers: headers,
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        logger.error(`API 请求失败: status=${response.status}, statusText=${response.statusText}`, {
          url: apiUrl,
          model,
        });
        await this.handleErrorResponse(response);
      }

      const data = await this.parseJSONResponse(response);
      const parsedResponse = this.parseResponse(data);

      logger.info(`OpenAI API 响应成功: model=${model}`, {
        url: apiUrl,
        response: parsedResponse,
        usage: parsedResponse.usage,
      });

      return parsedResponse;
    } catch (error) {
      logger.error("OpenAI API 调用失败:", error);
      throw error;
    }
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
    parameters?: LLMParameters,
  ): any {
    const mergedParams = this.mergeParameters(parameters);

    const body: any = {
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    // 添加参数
    if (mergedParams.temperature !== undefined) {
      body.temperature = mergedParams.temperature;
    }
    if (mergedParams.max_tokens !== undefined) {
      body.max_tokens = mergedParams.max_tokens;
    }
    if (mergedParams.top_p !== undefined) {
      body.top_p = mergedParams.top_p;
    }
    if (mergedParams.frequency_penalty !== undefined) {
      body.frequency_penalty = mergedParams.frequency_penalty;
    }
    if (mergedParams.presence_penalty !== undefined) {
      body.presence_penalty = mergedParams.presence_penalty;
    }
    if (mergedParams.stop !== undefined) {
      body.stop = mergedParams.stop;
    }

    return body;
  }

  /**
   * 解析响应
   */
  protected parseResponse(response: any): LLMCallResponseResult {
    logger.info(`OpenAI API 解析响应，原始响应数据:`, {
      hasChoices: !!response.choices,
      hasFirstChoice: !!response.choices?.[0],
      hasMessage: !!response.choices?.[0]?.message,
      hasContent: !!response.choices?.[0]?.message?.content,
      hasUsage: !!response.usage,
      choicesCount: response.choices?.length || 0,
    });

    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error("响应格式错误: 缺少 choices");
    }

    const result = {
      content: choice.message?.content || "",
      model: response.model || "",
      provider_id: this.providerId,
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens || 0,
            completion_tokens: response.usage.completion_tokens || 0,
            total_tokens: response.usage.total_tokens || 0,
          }
        : undefined,
    };

    logger.info(`OpenAI API 解析响应结果:`, {
      contentLength: result.content.length,
      contentPreview: result.content.substring(0, 100) + (result.content.length > 100 ? '...' : ''),
      model: result.model,
      usage: result.usage,
    });

    return result;
  }

  /**
   * 流式发送聊天请求
   */
  async chatStream(
    messages: LLMMessage[],
    model: string,
    parameters?: LLMParameters,
    options?: StreamOptions,
  ): Promise<void> {
    try {
      const body = this.buildRequestBody(messages, model, { ...parameters, stream: true });

      logger.debug(`调用 OpenAI 流式 API: ${model}`, {
        messagesCount: messages.length,
        parameters,
      });

      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("无法获取响应流");
      }

      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // 解码并处理数据
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // 保留未完成的数据

        for (const line of lines) {
          const trimmed = line.trim();

          // 跳过空行和注释
          if (!trimmed || trimmed.startsWith(":")) {
            continue;
          }

          // 检查 SSE 格式
          if (!trimmed.startsWith("data: ")) {
            continue;
          }

          const data = trimmed.slice(6); // 移除 "data: " 前缀

          // 检查结束标记
          if (data === "[DONE]") {
            continue;
          }

          try {
            const json = JSON.parse(data);
            const chunk = json.choices?.[0]?.delta?.content;

            if (chunk) {
              fullContent += chunk;

              // 触发回调
              if (options?.onChunk) {
                options.onChunk(chunk);
              }
            }
          } catch (error) {
            logger.warn("解析流式数据块失败:", error, { data });
          }
        }
      }

      // 触发完成回调
      if (options?.onDone) {
        options.onDone(fullContent);
      }
    } catch (error) {
      logger.error("OpenAI 流式 API 调用失败:", error);

      // 触发错误回调
      if (options?.onError) {
        options.onError(error as Error);
      } else {
        throw error;
      }
    }
  }
}
