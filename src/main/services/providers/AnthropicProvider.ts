/**
 * Anthropic (Claude) 供应商适配器
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

export class AnthropicProvider extends BaseLLMProvider {
  /**
   * 测试连接
   */
  async testConnection(model?: string): Promise<LLMProviderTestResult> {
    const startTime = Date.now();

    try {
      // Anthropic 没有统一的 models 端点，我们用一个简单的请求测试
      const testModel = model || "claude-3-haiku-20240307";
      const response = await this.chat(
        [
          {
            role: "user",
            content: "Hi",
          },
        ],
        testModel,
        { max_tokens: 10 },
      );

      return {
        success: true,
        message: "连接成功",
        latency_ms: Date.now() - startTime,
        available_models: [
          "claude-3-opus-20240229",
          "claude-3-sonnet-20240229",
          "claude-3-haiku-20240307",
        ],
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
    // Anthropic 没有公开的 models 端点，返回已知模型
    return [
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
    ];
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

      logger.debug(`调用 Anthropic API: ${model}`, {
        messagesCount: messages.length,
        parameters,
      });

      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/messages`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await this.parseJSONResponse(response);
      return this.parseResponse(data);
    } catch (error) {
      logger.error("Anthropic API 调用失败:", error);
      throw error;
    }
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

      logger.debug(`调用 Anthropic 流式 API: ${model}`, {
        messagesCount: messages.length,
        parameters,
      });

      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/messages`,
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

            // Anthropic 使用 delta_block 类型的事件
            if (json.type === "content_block_delta") {
              const chunk = json.delta?.text;

              if (chunk) {
                fullContent += chunk;

                // 触发回调
                if (options?.onChunk) {
                  options.onChunk(chunk);
                }
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
      logger.error("Anthropic 流式 API 调用失败:", error);

      // 触发错误回调
      if (options?.onError) {
        options.onError(error as Error);
      } else {
        throw error;
      }
    }
  }

  /**
   * 获取请求头
   */
  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };

    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
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

    // 转换消息格式
    const systemMessage = messages.find((m) => m.role === "system");
    const userMessages = messages.filter((m) => m.role !== "system");

    const body: any = {
      model,
      max_tokens: mergedParams.max_tokens || 2000,
      messages: userMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    if (mergedParams.temperature !== undefined) {
      body.temperature = mergedParams.temperature;
    }
    if (mergedParams.top_p !== undefined) {
      body.top_p = mergedParams.top_p;
    }
    if (mergedParams.stop) {
      body.stop_sequences = Array.isArray(mergedParams.stop)
        ? mergedParams.stop
        : [mergedParams.stop];
    }
    if (mergedParams.stream === true) {
      body.stream = true;
    }

    return body;
  }

  /**
   * 解析响应
   */
  protected parseResponse(response: any): LLMCallResponseResult {
    const content = response.content?.[0]?.text || "";
    return {
      content,
      model: response.model || "",
      provider_id: this.providerId,
      usage: response.usage
        ? {
            prompt_tokens: response.usage.input_tokens || 0,
            completion_tokens: response.usage.output_tokens || 0,
            total_tokens:
              (response.usage.input_tokens || 0) +
              (response.usage.output_tokens || 0),
          }
        : undefined,
    };
  }
}
