import { invokeIPC } from "./ipcApi";
import { IPC_CHANNELS } from "../../../shared/types";
import type {
  ApiResponse,
  LLMProvider,
  LLMProviderCreateRequest,
  LLMProviderUpdateRequest,
  LLMProviderTestRequest,
  LLMProviderTestResult,
  LLMModelsSyncRequest,
  LLMModelsSyncResult,
  LLMTaskConfig,
} from "../../../shared/types";

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
    const response = await invokeIPC<ApiResponse<LLMProvider[]>>(
      IPC_CHANNELS.SETTING.PROVIDER_LIST,
    );
    console.log("[settingApi] listProviders 原始响应:", response);
    if (response && response.success && response.data) {
      console.log("[settingApi] listProviders 解包后数据:", response.data);
      return response.data;
    }
    console.error("[settingApi] listProviders 响应格式错误:", response);
    throw new Error("获取供应商列表失败");
  },

  /**
   * 获取单个供应商
   */
  getProvider: async (providerId: string): Promise<LLMProvider | null> => {
    const response = await invokeIPC<ApiResponse<LLMProvider | null>>(
      IPC_CHANNELS.SETTING.PROVIDER_GET,
      providerId,
    );
    if (response && response.success && response.data) {
      return response.data;
    }
    return null;
  },

  /**
   * 创建供应商
   */
  createProvider: async (
    data: LLMProviderCreateRequest,
  ): Promise<LLMProvider> => {
    const response = await invokeIPC<ApiResponse<LLMProvider>>(
      IPC_CHANNELS.SETTING.PROVIDER_CREATE,
      data,
    );
    if (response && response.success && response.data) {
      return response.data;
    }
    throw new Error("创建供应商失败");
  },

  /**
   * 更新供应商
   */
  updateProvider: async (
    providerId: string,
    data: LLMProviderUpdateRequest,
  ): Promise<LLMProvider | null> => {
    const response = await invokeIPC<ApiResponse<LLMProvider | null>>(
      IPC_CHANNELS.SETTING.PROVIDER_UPDATE,
      providerId,
      data,
    );
    if (response && response.success && response.data) {
      return response.data;
    }
    return null;
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
    return await invokeIPC<LLMProviderTestResult>(
      IPC_CHANNELS.SETTING.PROVIDER_TEST,
      request,
    );
  },

  /**
   * 设置默认供应商
   */
  setDefaultProvider: async (providerId: string): Promise<void> => {
    return invokeIPC<void>(
      IPC_CHANNELS.SETTING.PROVIDER_SET_DEFAULT,
      providerId,
    );
  },

  /**
   * 获取默认供应商
   */
  getDefaultProvider: async (): Promise<LLMProvider | null> => {
    const response = await invokeIPC<ApiResponse<LLMProvider | null>>(
      IPC_CHANNELS.SETTING.PROVIDER_GET_DEFAULT,
    );
    if (response && response.success && response.data) {
      return response.data;
    }
    return null;
  },

  /**
   * 使用指定供应商进行简单聊天
   * 返回 AI 响应文本
   */
  chat: async (request: {
    providerId: string;
    message: string;
    model?: string;
  }): Promise<string> => {
    console.log("[settingApi] chat 调用:", request);
    const response = await invokeIPC<{
      success: boolean;
      data?: string;
      error?: string;
    }>(IPC_CHANNELS.SETTING.PROVIDER_CHAT, request);

    console.log("[settingApi] chat 响应:", response);

    if (response && response.success && response.data) {
      return response.data;
    }

    const errorMsg = response?.error || "聊天失败";
    console.error("[settingApi] chat 失败:", errorMsg);
    throw new Error(errorMsg);
  },

  // ============ 任务配置相关 ============

  /**
   * 获取任务配置
   */
  getTaskConfig: async (taskName: string): Promise<LLMTaskConfig | null> => {
    const response = await invokeIPC<ApiResponse<LLMTaskConfig | null>>(
      IPC_CHANNELS.SETTING.TASK_CONFIG_GET,
      taskName,
    );
    if (response && response.success && response.data) {
      return response.data;
    }
    return null;
  },

  /**
   * 列出所有任务配置
   */
  listTaskConfigs: async (): Promise<LLMTaskConfig[]> => {
    const response = await invokeIPC<ApiResponse<LLMTaskConfig[]>>(
      IPC_CHANNELS.SETTING.TASK_CONFIG_LIST,
    );
    console.log("[settingApi] listTaskConfigs 原始响应:", response);
    if (response && response.success && response.data) {
      console.log("[settingApi] listTaskConfigs 解包后数据:", response.data);
      return response.data;
    }
    console.error("[settingApi] listTaskConfigs 响应格式错误:", response);
    throw new Error("获取任务配置失败");
  },

  /**
   * 更新任务配置
   */
  updateTaskConfig: async (config: LLMTaskConfig): Promise<void> => {
    const response = await invokeIPC<ApiResponse<void>>(
      IPC_CHANNELS.SETTING.TASK_CONFIG_UPDATE,
      config,
    );
    if (response && response.success) {
      return;
    }
    throw new Error("更新任务配置失败");
  },

  // ============ 模型列表相关 ============

  /**
   * 同步模型列表
   */
  syncModels: async (
    request: LLMModelsSyncRequest,
  ): Promise<LLMModelsSyncResult> => {
    return await invokeIPC<LLMModelsSyncResult>(
      IPC_CHANNELS.SETTING.MODELS_SYNC,
      request,
    );
  },
};
