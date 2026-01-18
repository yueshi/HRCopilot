/**
 * Azure OpenAI 供应商适配器
 * Azure OpenAI API 兼容 OpenAI API 格式，但需要特殊处理
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

export class AzureProvider extends BaseLLMProvider {
  private apiVersion: string = "2024-02-15-preview";
  private deploymentName?: string;

  constructor(config: LLMProvider) {
    super(config);
    // 从 base_url 或 parameters 中提取部署名称
    this.extractDeploymentInfo();
  }

  /**
   * 从配置中提取 Azure 特定信息
   */
  private extractDeploymentInfo(): void {
    // 从 base_url 中提取部署名称
    // Azure URL 格式: https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions
    const deploymentMatch = this.baseUrl.match(/\/deployments\/([^\/]+)/);
    if (deploymentMatch) {
      this.deploymentName = deploymentMatch[1];
    }

    // 从 parameters 中提取 api_version
    if (this.parameters.api_version) {
      this.apiVersion = this.parameters.api_version as string;
    }
  }

  /**
   * 构建 API 端点
   * Azure OpenAI 的端点格式与标准 OpenAI 不同
   */
  private buildEndpoint(endpoint: string): string {
    // 如果 base_url 已经包含了完整路径（如 /openai/deployments/{deployment}/chat/completions）
    // 则提取基础部分
    const baseUrl = this.baseUrl;

    // 如果 baseUrl 已经包含完整路径，返回 baseUrl + query
    if (baseUrl.includes('/chat/completions')) {
      const base = baseUrl.split('/chat/completions')[0];
      return `${base}${endpoint}`;
    }

    // 如果 baseUrl 包含 deployments，构建完整路径
    if (baseUrl.includes('/deployments/')) {
      const base = baseUrl.split('/deployments/')[0];
      return `${base}${endpoint}`;
    }

    // 默认情况：假设 baseUrl 是基础 URL
    return `${baseUrl}${endpoint}`;
  }

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
   * Azure OpenAI 使用 deployments endpoint
   */
  async fetchModels(): Promise<string[]> {
    try {
      // Azure OpenAI 的模型列表端点与 OpenAI 不同
      // 使用 deployments endpoint
      const response = await this.fetchWithTimeout(
        this.buildEndpoint('/openai/deployments?api-version=' + this.apiVersion),
        {
          method: "GET",
          headers: this.getHeaders(),
        },
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await this.parseJSONResponse(response);

      // Azure 返回的格式: { data: [{ id: "gpt-4", ... }] }
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((d: any) => d.id || d.model || d.name);
      }

      return [];
    } catch (error) {
      logger.error("获取 Azure 模型列表失败:", error);
      // 如果无法获取模型列表，返回空数组（LLMParameters 中没有 models 属性）
      return [];
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

      logger.debug(`调用 Azure OpenAI API: ${model}`, {
        messagesCount: messages.length,
        parameters,
      });

      // Azure OpenAI 使用不同的端点
      const endpoint = this.buildEndpoint('/openai/deployments/' + model + '/chat/completions?api-version=' + this.apiVersion);

      const response = await this.fetchWithTimeout(
        endpoint,
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
      logger.error("Azure OpenAI API 调用失败:", error);
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

      logger.debug(`调用 Azure OpenAI 流式 API: ${model}`, {
        messagesCount: messages.length,
        parameters,
      });

      const endpoint = this.buildEndpoint('/openai/deployments/' + model + '/chat/completions?api-version=' + this.apiVersion);

      const response = await this.fetchWithTimeout(
        endpoint,
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
      logger.error("Azure OpenAI 流式 API 调用失败:", error);

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
    };

    // Azure OpenAI 使用 api-key 而不是 Authorization Bearer
    if (this.apiKey) {
      headers["api-key"] = this.apiKey;
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
      model, // Azure 也需要 model 字段
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
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error("响应格式错误: 缺少 choices");
    }

    return {
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
  }
}
