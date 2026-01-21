import { invokeIPC } from './ipcApi';
import { IPC_CHANNELS } from '../../../shared/types';
import type {
  LLMProvider,
  LLMProviderCreateRequest,
  LLMProviderUpdateRequest,
  LLMProviderTestRequest,
  LLMProviderTestResult,
  LLMModelsSyncRequest,
  LLMModelsSyncResult,
  LLMTaskConfig,
} from '../../../shared/types/llm';

/**
 * 设置 IPC 服务
 * 封装所有设置相关的 IPC 调用
 */
export const settingApi = {
  // ============ LLM 供应商相关 ============

  /**
   * 列出所有供应商
   */
  listProviders: async (): Promise<LLMProvider[]> => {
    return invokeIPC<LLMProvider[]>(IPC_CHANNELS.SETTING.PROVIDER_LIST);
  },

  /**
   * 获取单个供应商
   */
  getProvider: async (providerId: string): Promise<LLMProvider | null> => {
    return invokeIPC<LLMProvider | null>(
      IPC_CHANNELS.SETTING.PROVIDER_GET,
      providerId,
    );
  },

  /**
   * 创建供应商
   */
  createProvider: async (
    data: LLMProviderCreateRequest,
  ): Promise<LLMProvider> => {
    return invokeIPC<LLMProvider>(IPC_CHANNELS.SETTING.PROVIDER_CREATE, data);
  },

  /**
   * 更新供应商
   */
  updateProvider: async (
    providerId: string,
    data: LLMProviderUpdateRequest,
  ): Promise<LLMProvider | null> => {
    return invokeIPC<LLMProvider | null>(
      IPC_CHANNELS.SETTING.PROVIDER_UPDATE,
      providerId,
      data,
    );
  },

  /**
   * 删除供应商
   */
  deleteProvider: async (providerId: string): Promise<void> => {
    return invokeIPC<void>(IPC_CHANNELS.SETTING.PROVIDER_DELETE, providerId);
  },

  /**
   * 测试供应商连接
   */
  testProvider: async (
    request: LLMProviderTestRequest,
  ): Promise<LLMProviderTestResult> => {
    return invokeIPC<LLMProviderTestResult>(
      IPC_CHANNELS.SETTING.PROVIDER_TEST,
      request,
    );
  },

  /**
   * 设置默认供应商
   */
  setDefaultProvider: async (providerId: string): Promise<void> => {
    return invokeIPC<void>(IPC_CHANNELS.SETTING.PROVIDER_SET_DEFAULT, providerId);
  },

  /**
   * 获取默认供应商
   */
  getDefaultProvider: async (): Promise<LLMProvider | null> => {
    return invokeIPC<LLMProvider | null>(
      IPC_CHANNELS.SETTING.PROVIDER_GET_DEFAULT,
    );
  },

  /**
   * 使用指定供应商进行简单聊天
   */
  chat: async (request: {
    providerId: string;
    message: string;
    model?: string;
  }): Promise<{
    success: boolean;
    response?: string;
    error?: string;
  }> => {
    return invokeIPC(IPC_CHANNELS.SETTING.PROVIDER_CHAT, request);
  },

  // ============ 任务配置相关 ============

  /**
   * 获取任务配置
   */
  getTaskConfig: async (taskName: string): Promise<LLMTaskConfig | null> => {
    return invokeIPC<LLMTaskConfig | null>(
      IPC_CHANNELS.SETTING.TASK_CONFIG_GET,
      taskName,
    );
  },

  /**
   * 列出所有任务配置
   */
  listTaskConfigs: async (): Promise<LLMTaskConfig[]> => {
    return invokeIPC<LLMTaskConfig[]>(IPC_CHANNELS.SETTING.TASK_CONFIG_LIST);
  },

  /**
   * 更新任务配置
   */
  updateTaskConfig: async (config: LLMTaskConfig): Promise<void> => {
    return invokeIPC<void>(IPC_CHANNELS.SETTING.TASK_CONFIG_UPDATE, config);
  },

  // ============ 模型列表相关 ============

  /**
   * 同步模型列表
   */
  syncModels: async (
    request: LLMModelsSyncRequest,
  ): Promise<LLMModelsSyncResult> => {
    return invokeIPC<LLMModelsSyncResult>(IPC_CHANNELS.SETTING.MODELS_SYNC, request);
  },
};
