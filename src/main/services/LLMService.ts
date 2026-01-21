/**
 * LLM 服务抽象层
 * 提供统一的 LLM 调用接口，支持供应商选择、降级、重试等
 */

import { database } from "../database/sqlite";
import { logger } from "../utils/logger";
import {
  BaseLLMProvider,
  OpenAIProvider,
  GLMProvider,
  OllamaProvider,
  AnthropicProvider,
  AzureProvider,
  CustomProvider,
  type StreamOptions,
} from "./providers";
import type {
  LLMProvider,
  LLMMessage,
  LLMParameters,
  LLMCallRequest,
  LLMCallResponseResult,
  LLMTaskConfig,
  LLMTaskName,
} from "../../shared/types/llm";

export class LLMService {
  private providerCache = new Map<string, BaseLLMProvider>();
  private taskCache = new Map<string, LLMTaskConfig>();
  private retryCount = 3; // 重试次数
  private retryDelay = 1000; // 重试延迟 (ms)

  /**
   * 获取供应商实例（带缓存）
   */
  private async getProvider(
    providerId: string,
    needFullConfig = true,  // 默认需要完整配置（包含解密的 API Key）
  ): Promise<BaseLLMProvider> {
    // 检查缓存
    if (this.providerCache.has(providerId)) {
      return this.providerCache.get(providerId)!;
    }

    // 从数据库获取配置
    const config = needFullConfig
      ? await database.getLLMProviderFull(providerId)
      : await database.getLLMProvider(providerId);

    if (!config) {
      throw new Error(`供应商不存在: ${providerId}`);
    }

    logger.info(`LLMService.getProvider: providerId=${providerId}, hasApiKey=!!${config.api_key}, apiKey=${config.api_key ? config.api_key.substring(0, 10) + '...' : 'none'}`);

    const provider = this.createProvider(config);
    this.providerCache.set(providerId, provider);

    return provider;
  }

  /**
   * 创建供应商实例
   */
  private createProvider(config: any): BaseLLMProvider {
    switch (config.type) {
      case "openai":
        return new OpenAIProvider(config);
      case "glm":
        return new GLMProvider(config);
      case "ollama":
        return new OllamaProvider(config);
      case "anthropic":
        return new AnthropicProvider(config);
      case "azure":
        return new AzureProvider(config);
      case "custom":
        return new CustomProvider(config);
      default:
        throw new Error(`未知的供应商类型: ${config.type}`);
    }
  }

  /**
   * 解析配置
   * 根据请求确定使用的供应商、模型和参数
   */
  private async resolveConfig(
    request: LLMCallRequest,
  ): Promise<{
    providerId: string;
    model: string;
    parameters: LLMParameters;
  }> {
    // 如果指定了 provider_id，使用指定配置
    if (request.provider_id) {
      const provider = await database.getLLMProviderFull(request.provider_id);
      if (!provider) {
        throw new Error(`供应商不存在: ${request.provider_id}`);
      }

      return {
        providerId: provider.provider_id,
        model: request.model || provider.models[0],
        parameters: { ...provider.parameters, ...request.parameters },
      };
    }

    // 如果指定了 task_name，使用任务配置
    if (request.task_name) {
      const taskConfig = await this.getTaskConfig(request.task_name);

      if (taskConfig.provider_id) {
        const provider = await database.getLLMProviderFull(
          taskConfig.provider_id,
        );

        if (!provider) {
          throw new Error(
            `任务配置的供应商不存在: ${taskConfig.provider_id}`,
          );
        }

        return {
          providerId: provider.provider_id,
          model:
            request.model || taskConfig.model || provider.models[0],
          parameters: {
            ...provider.parameters,
            ...taskConfig.parameters,
            ...request.parameters,
          },
        };
      }
    }

    // 使用默认供应商
    const defaultProvider = await database.getDefaultLLMProviderFull();

    if (!defaultProvider) {
      throw new Error("没有可用的 LLM 供应商配置");
    }

    return {
      providerId: defaultProvider.provider_id,
      model: request.model || defaultProvider.models[0],
      parameters: { ...defaultProvider.parameters, ...request.parameters },
    };
  }

  /**
   * 获取任务配置（带缓存）
   */
  private async getTaskConfig(taskName: LLMTaskName): Promise<LLMTaskConfig> {
    // 检查缓存
    if (this.taskCache.has(taskName)) {
      return this.taskCache.get(taskName)!;
    }

    // 从数据库获取
    const config = await database.getLLMTaskConfig(taskName);

    if (!config) {
      // 返回空配置
      return {
        task_name: taskName,
        parameters: {},
      };
    }

    this.taskCache.set(taskName, config);
    return config;
  }

  /**
   * 获取备用供应商列表
   * 返回除指定供应商外的其他已启用的供应商，按优先级排序
   */
  private async getFallbackProviders(excludeProviderId: string): Promise<string[]> {
    const providers = await database.listLLMProviders();

    // 过滤出已启用且非排除的供应商
    const fallbackProviders = providers
      .filter((p) => p.is_enabled && p.provider_id !== excludeProviderId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => p.provider_id);

    return fallbackProviders;
  }

  /**
   * 统一调用接口
   */
  async call(request: LLMCallRequest): Promise<LLMCallResponseResult> {
    // 解析配置
    const config = await this.resolveConfig(request);

    // 获取供应商实例
    const provider = await this.getProvider(config.providerId, true);

    // 记录开始时间
    const startTime = Date.now();

    // 尝试调用，带重试
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        const result = await provider.chat(
          request.messages,
          config.model,
          config.parameters,
        );

        const duration = Date.now() - startTime;

        // 记录成功日志
        await database.logLLMCall({
          provider_id: config.providerId,
          model: config.model,
          task_name: request.task_name,
          request_tokens: result.usage?.prompt_tokens,
          response_tokens: result.usage?.completion_tokens,
          status: "success",
          duration_ms: duration,
        });

        logger.info(`LLM 调用成功: ${config.providerId}/${config.model}`, {
          duration,
          usage: result.usage,
        });

        // 记录完整的响应数据用于调试
        logger.info(`LLM 响应数据: ${config.providerId}/${config.model}`, {
          response: {
            content: result.content,
            contentLength: result.content?.length || 0,
            model: result.model,
            provider_id: result.provider_id,
            usage: result.usage,
          },
        });

        return result;
      } catch (error) {
        lastError = error as Error;

        // 记录失败日志
        await database.logLLMCall({
          provider_id: config.providerId,
          model: config.model,
          task_name: request.task_name,
          status: "failed",
          error_message: lastError.message,
          duration_ms: Date.now() - startTime,
        });

        logger.warn(
          `LLM 调用失败 (尝试 ${attempt}/${this.retryCount}): ${lastError.message}`,
        );

        // 如果不是最后一次尝试，等待后重试
        if (attempt < this.retryCount) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }

    // 主供应商所有重试都失败，尝试降级到备用供应商
    const fallbackProviders = await this.getFallbackProviders(config.providerId);

    if (fallbackProviders.length > 0) {
      logger.info(`主供应商 ${config.providerId} 失败，尝试降级到备用供应商`, {
        fallbackProviders,
      });

      for (const fallbackProviderId of fallbackProviders) {
        try {
          logger.info(`尝试备用供应商: ${fallbackProviderId}`);

          // 获取备用供应商配置
          const fallbackProvider = await this.getProvider(fallbackProviderId, true);
          const fallbackConfig = await database.getLLMProviderFull(fallbackProviderId);

          if (!fallbackConfig) {
            logger.warn(`备用供应商 ${fallbackProviderId} 配置不存在`);
            continue;
          }

          // 使用备用供应商的第一个模型
          const fallbackModel = request.model || fallbackConfig.models[0];

          const result = await fallbackProvider.chat(
            request.messages,
            fallbackModel,
            { ...fallbackConfig.parameters, ...request.parameters },
          );

          const duration = Date.now() - startTime;

          // 记录降级成功日志
          await database.logLLMCall({
            provider_id: fallbackProviderId,
            model: fallbackModel,
            task_name: request.task_name,
            request_tokens: result.usage?.prompt_tokens,
            response_tokens: result.usage?.completion_tokens,
            status: "success",
            duration_ms: duration,
          });

          logger.info(`LLM 降级调用成功: ${fallbackProviderId}/${fallbackModel}`, {
            duration,
            usage: result.usage,
            originalProvider: config.providerId,
          });

          return result;
        } catch (error) {
          const fallbackError = error as Error;

          // 记录降级失败日志
          await database.logLLMCall({
            provider_id: fallbackProviderId,
            model: "",
            task_name: request.task_name,
            status: "failed",
            error_message: fallbackError.message,
            duration_ms: Date.now() - startTime,
          });

          logger.warn(`备用供应商 ${fallbackProviderId} 调用失败: ${fallbackError.message}`);
        }
      }

      logger.error("所有备用供应商也都失败");
    } else {
      logger.info("没有可用的备用供应商");
    }

    // 所有尝试都失败
    throw lastError || new Error("LLM 调用失败");
  }

  /**
   * 测试供应商连接
   */
  async testConnection(
    providerId: string,
    model?: string,
  ): Promise<{
    success: boolean;
    message: string;
    latencyMs?: number;
    availableModels?: string[];
  }> {
    try {
      const provider = await this.getProvider(providerId, true);
      const result = await provider.testConnection(model);

      return {
        success: result.success,
        message: result.message,
        latencyMs: result.latency_ms,
        availableModels: result.available_models,
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  /**
   * 同步可用模型列表
   */
  async syncModels(providerId: string): Promise<string[]> {
    const provider = await this.getProvider(providerId, true);
    const models = await provider.fetchModels();

    // 更新数据库中的模型列表
    await database.updateLLMProvider(providerId, {
      provider_id: providerId,
      models,
    });

    return models;
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.providerCache.clear();
    this.taskCache.clear();
    logger.debug("LLM 服务缓存已清除");
  }

  /**
   * 清除供应商缓存
   */
  clearProviderCache(providerId: string): void {
    this.providerCache.delete(providerId);
  }

  /**
   * 清除任务配置缓存
   */
  clearTaskCache(taskName?: LLMTaskName): void {
    if (taskName) {
      this.taskCache.delete(taskName);
    } else {
      this.taskCache.clear();
    }
  }

  /**
   * 设置重试配置
   */
  setRetryConfig(count: number, delay: number): void {
    this.retryCount = Math.max(1, count);
    this.retryDelay = Math.max(100, delay);
    logger.debug(`LLM 重试配置已更新: ${count} 次, ${delay}ms 延迟`);
  }

  /**
   * 流式调用接口
   */
  async callStream(
    request: LLMCallRequest,
    options?: StreamOptions,
  ): Promise<void> {
    // 解析配置
    const config = await this.resolveConfig(request);

    // 获取供应商实例
    const provider = await this.getProvider(config.providerId, true);

    // 记录开始时间
    const startTime = Date.now();

    try {
      // 修改完成回调以记录日志
      const wrappedOptions: StreamOptions = {
        onChunk: options?.onChunk,
        onDone: (fullContent) => {
          const duration = Date.now() - startTime;

          // 记录成功日志
          database.logLLMCall({
            provider_id: config.providerId,
            model: config.model,
            task_name: request.task_name,
            response_tokens: this.estimateTokens(fullContent),
            status: "success",
            duration_ms: duration,
          }).catch((err) => {
            logger.error("记录流式调用日志失败:", err);
          });

          logger.info(`LLM 流式调用成功: ${config.providerId}/${config.model}`, {
            duration,
            contentLength: fullContent.length,
          });

          if (options?.onDone) {
            options.onDone(fullContent);
          }
        },
        onError: options?.onError,
      };

      await provider.chatStream(
        request.messages,
        config.model,
        config.parameters,
        wrappedOptions,
      );
    } catch (error) {
      logger.error("LLM 流式调用失败:", error);

      // 记录失败日志
      await database.logLLMCall({
        provider_id: config.providerId,
        model: config.model,
        task_name: request.task_name,
        status: "failed",
        error_message: (error as Error).message,
        duration_ms: Date.now() - startTime,
      }).catch((err) => {
        logger.error("记录流式调用失败日志失败:", err);
      });

      if (options?.onError) {
        options.onError(error as Error);
      } else {
        throw error;
      }
    }
  }

  /**
   * 估算文本的 token 数量
   */
  private estimateTokens(text: string): number {
    // 简单估算：中文每个字符约 4 tokens，英文每个字符约 0.3 tokens
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return chineseChars * 4 + Math.ceil(otherChars * 0.3);
  }
}

// 导出单例实例
export const llmService = new LLMService();
