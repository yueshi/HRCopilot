/**
 * LLM 供应商控制器
 * 处理 LLM 供应商相关的业务逻辑
 */

import { database } from "../database/sqlite";
import { llmService } from "../services/LLMService";
import { logger } from "../utils/logger";
import type {
  LLMProvider,
  LLMProviderCreateRequest,
  LLMProviderUpdateRequest,
  LLMProviderTestRequest,
  LLMProviderTestResult,
  LLMModelsSyncResult,
  LLMTaskConfig,
  LLMModelsSyncRequest,
} from "../../shared/types/llm";

export class LLMProviderController {
  /**
   * 列出所有供应商
   */
  async listProviders(): Promise<LLMProvider[]> {
    try {
      return await database.listLLMProviders();
    } catch (error) {
      logger.error("列出供应商失败:", error);
      throw error;
    }
  }

  /**
   * 获取供应商
   */
  async getProvider(providerId: string): Promise<LLMProvider | null> {
    try {
      return await database.getLLMProvider(providerId);
    } catch (error) {
      logger.error("获取供应商失败:", error);
      throw error;
    }
  }

  /**
   * 创建供应商
   */
  async createProvider(data: LLMProviderCreateRequest): Promise<LLMProvider> {
    try {
      // 验证数据
      this.validateProviderData(data);

      // 创建供应商
      const provider = await database.createLLMProvider(data);

      // 清除缓存
      llmService.clearCache();

      logger.info(`创建供应商成功: ${data.name}`);
      return provider;
    } catch (error) {
      logger.error("创建供应商失败:", error);
      throw error;
    }
  }

  /**
   * 更新供应商
   */
  async updateProvider(
    providerId: string,
    data: LLMProviderUpdateRequest,
  ): Promise<LLMProvider | null> {
    try {
      // 验证数据
      this.validateProviderData(data);

      // 更新供应商
      const provider = await database.updateLLMProvider(providerId, data);

      // 清除缓存
      llmService.clearProviderCache(providerId);

      logger.info(`更新供应商成功: ${providerId}`);
      return provider;
    } catch (error) {
      logger.error("更新供应商失败:", error);
      throw error;
    }
  }

  /**
   * 删除供应商
   */
  async deleteProvider(providerId: string): Promise<void> {
    try {
      await database.deleteLLMProvider(providerId);

      // 清除缓存
      llmService.clearProviderCache(providerId);

      logger.info(`删除供应商成功: ${providerId}`);
    } catch (error) {
      logger.error("删除供应商失败:", error);
      throw error;
    }
  }

  /**
   * 设置默认供应商
   */
  async setDefaultProvider(providerId: string): Promise<void> {
    try {
      await database.setDefaultLLMProvider(providerId);

      // 清除缓存
      llmService.clearCache();

      logger.info(`设置默认供应商成功: ${providerId}`);
    } catch (error) {
      logger.error("设置默认供应商失败:", error);
      throw error;
    }
  }

  /**
   * 获取默认供应商
   */
  async getDefaultProvider(): Promise<LLMProvider | null> {
    try {
      return await database.getDefaultLLMProvider();
    } catch (error) {
      logger.error("获取默认供应商失败:", error);
      throw error;
    }
  }

  /**
   * 测试供应商连接
   */
  async testConnection(
    request: LLMProviderTestRequest,
  ): Promise<LLMProviderTestResult> {
    try {
      const result = await llmService.testConnection(
        request.provider_id,
        request.model,
      );

      if (result.success) {
        logger.info(`供应商连接测试成功: ${request.provider_id}`);
      } else {
        logger.warn(
          `供应商连接测试失败: ${request.provider_id} - ${result.message}`,
        );
      }

      return {
        success: result.success,
        message: result.message,
        latency_ms: result.latencyMs,
        available_models: result.availableModels,
      };
    } catch (error) {
      logger.error("测试连接失败:", error);
      throw error;
    }
  }

  /**
   * 同步模型列表
   */
  async syncModels(request: LLMModelsSyncRequest): Promise<LLMModelsSyncResult> {
    try {
      const models = await llmService.syncModels(request.provider_id);

      logger.info(`同步模型列表成功: ${request.provider_id}, ${models.length} 个模型`);

      return {
        success: true,
        models,
        message: `成功获取 ${models.length} 个模型`,
      };
    } catch (error) {
      logger.error("同步模型列表失败:", error);

      return {
        success: false,
        models: [],
        message: (error as Error).message,
      };
    }
  }

  /**
   * 获取任务配置
   */
  async getTaskConfig(taskName: string): Promise<LLMTaskConfig | null> {
    try {
      return await database.getLLMTaskConfig(taskName);
    } catch (error) {
      logger.error("获取任务配置失败:", error);
      throw error;
    }
  }

  /**
   * 列出所有任务配置
   */
  async listTaskConfigs(): Promise<LLMTaskConfig[]> {
    try {
      return await database.listLLMTaskConfigs();
    } catch (error) {
      logger.error("列出任务配置失败:", error);
      throw error;
    }
  }

  /**
   * 更新任务配置
   */
  async updateTaskConfig(config: LLMTaskConfig): Promise<void> {
    try {
      await database.updateLLMTaskConfig(config);

      // 清除任务缓存
      llmService.clearTaskCache(config.task_name);

      logger.info(`更新任务配置成功: ${config.task_name}`);
    } catch (error) {
      logger.error("更新任务配置失败:", error);
      throw error;
    }
  }

  /**
   * 验证供应商数据
   */
  private validateProviderData(data: any): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error("供应商名称不能为空");
    }

    if (!data.type) {
      throw new Error("供应商类型不能为空");
    }

    if (!data.base_url || data.base_url.trim().length === 0) {
      throw new Error("API 地址不能为空");
    }

    // 验证 URL 格式
    try {
      new URL(data.base_url);
    } catch {
      throw new Error("API 地址格式无效");
    }

    // 验证模型列表
    if (data.models && !Array.isArray(data.models)) {
      throw new Error("模型列表必须是数组");
    }

    if (data.models && data.models.length === 0) {
      throw new Error("至少需要一个模型");
    }
  }
}

// 导出单例实例
export const llmProviderController = new LLMProviderController();
