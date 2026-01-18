/**
 * 自定义供应商适配器
 * 兼容 OpenAI API 格式的第三方服务
 */

import { OpenAIProvider } from "./OpenAIProvider";
import type { LLMProvider } from "../../../shared/types/llm";

export class CustomProvider extends OpenAIProvider {
  constructor(config: LLMProvider) {
    super(config);
  }

  // 自定义供应商假设兼容 OpenAI API 格式，直接继承 OpenAIProvider 的所有方法
  // 包括: testConnection, fetchModels, chat, getHeaders, buildRequestBody, parseResponse
}
