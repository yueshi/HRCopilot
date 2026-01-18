/**
 * Ollama 供应商适配器
 * 兼容 OpenAI API 格式的本地服务
 */

import { OpenAIProvider } from "./OpenAIProvider";
import type { LLMProvider } from "../../../shared/types/llm";

export class OllamaProvider extends OpenAIProvider {
  constructor(config: LLMProvider) {
    super(config);
  }

  // Ollama API 兼容 OpenAI 格式，直接继承
}
