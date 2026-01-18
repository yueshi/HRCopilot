/**
 * GLM (智谱 AI) 供应商适配器
 * 兼容 OpenAI API 格式
 */

import { OpenAIProvider } from "./OpenAIProvider";
import type { LLMProvider } from "../../../shared/types/llm";

export class GLMProvider extends OpenAIProvider {
  constructor(config: LLMProvider) {
    super(config);
  }

  // GLM 完全兼容 OpenAI API 格式，直接继承 OpenAIProvider 的所有方法
}
