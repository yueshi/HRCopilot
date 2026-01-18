/**
 * LLM 供应商抽象基类
 * 所有供应商适配器都应继承此类
 */

import type {
  LLMProvider,
  LLMMessage,
  LLMParameters,
  LLMCallResponseResult,
  LLMProviderTestResult,
} from "../../../shared/types/llm";
import { logger } from "../../utils/logger";

// 流式响应回调函数类型
export type StreamChunkCallback = (chunk: string) => void;
export type StreamDoneCallback = (fullContent: string) => void;
export type StreamErrorCallback = (error: Error) => void;

// 流式响应选项
export interface StreamOptions {
  onChunk?: StreamChunkCallback;
  onDone?: StreamDoneCallback;
  onError?: StreamErrorCallback;
}

export abstract class BaseLLMProvider {
  protected providerId: string;
  protected baseUrl: string;
  protected apiKey?: string;
  protected parameters: LLMParameters;

  constructor(config: LLMProvider) {
    this.providerId = config.provider_id;
    this.baseUrl = config.base_url;
    this.apiKey = config.api_key;
    this.parameters = config.parameters;
  }

  /**
   * 测试连接
   */
  abstract testConnection(model?: string): Promise<LLMProviderTestResult>;

  /**
   * 获取可用模型列表
   */
  abstract fetchModels(): Promise<string[]>;

  /**
   * 发送聊天请求
   */
  abstract chat(
    messages: LLMMessage[],
    model: string,
    parameters?: LLMParameters,
  ): Promise<LLMCallResponseResult>;

  /**
   * 流式发送聊天请求
   */
  abstract chatStream(
    messages: LLMMessage[],
    model: string,
    parameters?: LLMParameters,
    options?: StreamOptions,
  ): Promise<void>;

  /**
   * 获取请求头
   */
  protected abstract getHeaders(): Record<string, string>;

  /**
   * 构建请求体
   */
  protected abstract buildRequestBody(
    messages: LLMMessage[],
    model: string,
    parameters?: LLMParameters,
  ): any;

  /**
   * 解析响应
   */
  protected abstract parseResponse(response: any): LLMCallResponseResult;

  /**
   * 获取超时时间
   */
  protected getTimeout(parameters?: LLMParameters): number {
    return parameters?.timeout_ms || this.parameters.timeout_ms || 30000;
  }

  /**
   * 合并参数
   */
  protected mergeParameters(parameters?: LLMParameters): LLMParameters {
    return {
      ...this.parameters,
      ...parameters,
    };
  }

  /**
   * 执行 HTTP 请求
   */
  protected async fetchWithTimeout(
    url: string,
    options: RequestInit & { timeout?: number },
    timeout?: number,
  ): Promise<Response> {
    const timeoutMs = timeout || this.getTimeout();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`请求超时 (${timeoutMs}ms)`);
      }
      throw error;
    }
  }

  /**
   * 解析 JSON 响应
   */
  protected async parseJSONResponse(response: Response): Promise<any> {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      logger.error("解析 JSON 响应失败:", text);
      throw new Error(`解析响应失败: ${(error as Error).message}`);
    }
  }

  /**
   * 处理错误响应
   */
  protected async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `请求失败 (${response.status})`;

    try {
      const data = await this.parseJSONResponse(response);
      if (data.error) {
        errorMessage = data.error.message || data.error || errorMessage;
      }
    } catch {
      // 忽略解析错误
    }

    throw new Error(errorMessage);
  }
}
