/**
 * 设置相关 IPC 处理器
 * 处理 LLM 供应商、任务配置等设置相关的 IPC 请求
 */

import { BaseHandler } from './base';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import { llmProviderController } from '../controllers/LLMProviderController';
import { logger } from '../utils/logger';

export class SettingHandler extends BaseHandler {
  constructor() {
    super();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // ============ LLM 供应商相关 ============

    // 列出所有供应商
    this.register(IPC_CHANNELS.SETTING.PROVIDER_LIST, async () => {
      return await llmProviderController.listProviders();
    });

    // 获取单个供应商
    this.register(IPC_CHANNELS.SETTING.PROVIDER_GET, async (_event, providerId: string) => {
      return await llmProviderController.getProvider(providerId);
    });

    // 创建供应商
    this.register(IPC_CHANNELS.SETTING.PROVIDER_CREATE, async (_event, data) => {
      return await llmProviderController.createProvider(data);
    });

    // 更新供应商
    this.register(IPC_CHANNELS.SETTING.PROVIDER_UPDATE, async (_event, providerId: string, data) => {
      return await llmProviderController.updateProvider(providerId, data);
    });

    // 删除供应商
    this.register(IPC_CHANNELS.SETTING.PROVIDER_DELETE, async (_event, providerId: string) => {
      await llmProviderController.deleteProvider(providerId);
      return { success: true };
    });

    // 测试供应商连接
    this.register(IPC_CHANNELS.SETTING.PROVIDER_TEST, async (_event, request) => {
      return await llmProviderController.testConnection(request);
    });

    // 设置默认供应商
    this.register(IPC_CHANNELS.SETTING.PROVIDER_SET_DEFAULT, async (_event, providerId: string) => {
      await llmProviderController.setDefaultProvider(providerId);
      return { success: true };
    });

    // 获取默认供应商
    this.register(IPC_CHANNELS.SETTING.PROVIDER_GET_DEFAULT, async () => {
      return await llmProviderController.getDefaultProvider();
    });

    // LLM 供应商聊天
    this.register(IPC_CHANNELS.SETTING.PROVIDER_CHAT, async (_event, request: {
      providerId: string;
      message: string;
      model?: string;
    }) => {
      return await llmProviderController.chat(request);
    });

    // ============ 任务配置相关 ============

    // 获取任务配置
    this.register(IPC_CHANNELS.SETTING.TASK_CONFIG_GET, async (_event, taskName: string) => {
      return await llmProviderController.getTaskConfig(taskName);
    });

    // 列出所有任务配置
    this.register(IPC_CHANNELS.SETTING.TASK_CONFIG_LIST, async () => {
      return await llmProviderController.listTaskConfigs();
    });

    // 更新任务配置
    this.register(IPC_CHANNELS.SETTING.TASK_CONFIG_UPDATE, async (_event, config) => {
      await llmProviderController.updateTaskConfig(config);
      return { success: true };
    });

    // ============ 模型列表相关 ============

    // 同步模型列表
    this.register(IPC_CHANNELS.SETTING.MODELS_SYNC, async (_event, request) => {
      return await llmProviderController.syncModels(request);
    });

    logger.info('设置 IPC 处理器已注册');
  }
}
