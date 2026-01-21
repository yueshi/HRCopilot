import { create } from 'zustand';
import { settingApi } from '../services/settingIpcService';
import type {
  LLMProvider,
  LLMProviderCreateRequest,
  LLMProviderUpdateRequest,
  LLMTaskConfig,
  LLMTaskName,
  LLMProviderTestResult,
} from '@/shared/types/llm';

interface SettingState {
  // LLM 供应商
  providers: LLMProvider[];
  defaultProvider: LLMProvider | null;
  providersLoading: boolean;
  providersError: string | null;

  // 任务配置
  taskConfigs: Record<string, LLMTaskConfig>;
  taskConfigsLoading: boolean;
  taskConfigsError: string | null;

  // 供应商测试结果缓存
  testResults: Record<string, LLMProviderTestResult>;
}

interface SettingActions {
  // LLM 供应商相关
  fetchProviders: () => Promise<void>;
  createProvider: (data: LLMProviderCreateRequest) => Promise<LLMProvider>;
  updateProvider: (
    providerId: string,
    data: LLMProviderUpdateRequest,
  ) => Promise<LLMProvider | null>;
  deleteProvider: (providerId: string) => Promise<void>;
  testProvider: (
    providerId: string,
    model?: string,
  ) => Promise<LLMProviderTestResult>;
  setDefaultProvider: (providerId: string) => Promise<void>;
  syncModels: (providerId: string) => Promise<string[]>;
  chat: (request: {
    providerId: string;
    message: string;
    model?: string;
  }) => Promise<{
    success: boolean;
    response?: string;
    error?: string;
  }>;

  // 任务配置相关
  fetchTaskConfigs: () => Promise<void>;
  updateTaskConfig: (config: LLMTaskConfig) => Promise<void>;

  // 错误处理
  clearError: () => void;
}

export const useSettingStore = create<SettingState & SettingActions>((set, get) => ({
  // ============ 状态 ============
  providers: [],
  defaultProvider: null,
  providersLoading: false,
  providersError: null,

  taskConfigs: {},
  taskConfigsLoading: false,
  taskConfigsError: null,

  testResults: {},

  // ============ LLM 供应商相关 ============

  fetchProviders: async () => {
    set({ providersLoading: true, providersError: null });

    try {
      const providers = await settingApi.listProviders();
      set({ providers, providersLoading: false });

      // 获取默认供应商
      const defaultProvider = await settingApi.getDefaultProvider();
      set({ defaultProvider });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('fetchProviders 错误:', error);
      set({ providersLoading: false, providersError: errorMessage });
      throw error;
    }
  },

  createProvider: async (data) => {
    set({ providersLoading: true, providersError: null });

    try {
      const provider = await settingApi.createProvider(data);
      const { providers } = get();
      set({ providers: [...providers, provider], providersLoading: false });

      // 如果设置为默认，更新默认供应商
      if (data.is_default) {
        set({ defaultProvider: provider });
      }

      return provider;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('createProvider 错误:', error);
      set({ providersLoading: false, providersError: errorMessage });
      throw error;
    }
  },

  updateProvider: async (providerId, data) => {
    set({ providersLoading: true, providersError: null });

    try {
      const provider = await settingApi.updateProvider(providerId, data);
      const { providers, defaultProvider } = get();

      if (provider) {
        const newProviders = providers.map((p) =>
          p.provider_id === providerId ? provider : p,
        );
        set({ providers: newProviders, providersLoading: false });

        // 如果更新的是默认供应商，同步更新
        if (defaultProvider?.provider_id === providerId) {
          set({ defaultProvider: provider });
        }
      }

      return provider;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('updateProvider 错误:', error);
      set({ providersLoading: false, providersError: errorMessage });
      throw error;
    }
  },

  deleteProvider: async (providerId) => {
    set({ providersLoading: true, providersError: null });

    try {
      await settingApi.deleteProvider(providerId);
      const { providers, defaultProvider } = get();

      const newProviders = providers.filter((p) => p.provider_id !== providerId);
      set({ providers: newProviders, providersLoading: false });

      // 如果删除的是默认供应商，清除默认
      if (defaultProvider?.provider_id === providerId) {
        set({ defaultProvider: null });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('deleteProvider 错误:', error);
      set({ providersLoading: false, providersError: errorMessage });
      throw error;
    }
  },

  testProvider: async (providerId, model) => {
    try {
      const result = await settingApi.testProvider({ provider_id: providerId, model });

      set((state) => ({
        testResults: {
          ...state.testResults,
          [`${providerId}-${model || 'default'}`]: result,
        },
      }));

      return result;
    } catch (error) {
      console.error('testProvider 错误:', error);
      throw error;
    }
  },

  setDefaultProvider: async (providerId) => {
    try {
      await settingApi.setDefaultProvider(providerId);
      const { providers } = get();
      const provider = providers.find((p) => p.provider_id === providerId);

      if (provider) {
        set({ defaultProvider: provider });
      }
    } catch (error) {
      console.error('setDefaultProvider 错误:', error);
      throw error;
    }
  },

  syncModels: async (providerId) => {
    try {
      const result = await settingApi.syncModels({ provider_id: providerId });

      if (result.success) {
        // 重新获取供应商列表以更新模型列表
        await get().fetchProviders();
      }

      return result.models;
    } catch (error) {
      console.error('syncModels 错误:', error);
      throw error;
    }
  },

  chat: async (request) => {
    return await settingApi.chat(request);
  },

  // ============ 任务配置相关 ============

  fetchTaskConfigs: async () => {
    set({ taskConfigsLoading: true, taskConfigsError: null });

    try {
      const configs = await settingApi.listTaskConfigs();
      const configMap = configs.reduce(
        (acc, config) => {
          acc[config.task_name] = config;
          return acc;
        },
        {} as Record<string, LLMTaskConfig>,
      );

      set({ taskConfigs: configMap, taskConfigsLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('fetchTaskConfigs 错误:', error);
      set({ taskConfigsLoading: false, taskConfigsError: errorMessage });
      throw error;
    }
  },

  updateTaskConfig: async (config) => {
    try {
      await settingApi.updateTaskConfig(config);

      set((state) => ({
        taskConfigs: {
          ...state.taskConfigs,
          [config.task_name]: config,
        },
      }));
    } catch (error) {
      console.error('updateTaskConfig 错误:', error);
      throw error;
    }
  },

  // ============ 错误处理 ============

  clearError: () => {
    set({ providersError: null, taskConfigsError: null });
  },
}));

/**
 * Hook: 获取任务配置
 */
export const useTaskConfig = (taskName: LLMTaskName) => {
  return useSettingStore((state) => state.taskConfigs[taskName]);
};

/**
 * Hook: 获取供应商测试结果
 */
export const useTestResult = (providerId: string, model?: string) => {
  return useSettingStore((state) =>
    state.testResults[`${providerId}-${model || 'default'}`],
  );
};
