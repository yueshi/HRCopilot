import { create } from "zustand";
import { settingApi } from "../services/settingIpcService";
import type {
  LLMProvider,
  LLMProviderCreateRequest,
  LLMProviderUpdateRequest,
  LLMTaskConfig,
  LLMTaskName,
  LLMProviderTestResult,
} from "@/shared/types/llm";

interface SettingState {
  // LLM 供应商
  providers: LLMProvider[] | null;
  defaultProvider: LLMProvider | null;
  providersLoading: boolean;
  providersError: string | null;

  // 任务配置
  taskConfigs: Record<string, LLMTaskConfig> | null;
  taskConfigsLoading: boolean;
  taskConfigsError: string | null;

  // 供应商测试结果缓存
  testResults: Record<string, LLMProviderTestResult> | null;
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
  }) => Promise<string>;

  // 任务配置相关
  fetchTaskConfigs: () => Promise<void>;
  updateTaskConfig: (config: LLMTaskConfig) => Promise<void>;

  // 错误处理
  clearError: () => void;
}

export const useSettingStore = create<SettingState & SettingActions>(
  (set, get) => ({
    // ============ 状态 ============
    providers: null,
    defaultProvider: null,
    providersLoading: false,
    providersError: null,

    taskConfigs: null,
    taskConfigsLoading: false,
    taskConfigsError: null,

    testResults: null,

    // ============ LLM 供应商相关 ============

    fetchProviders: async () => {
      console.log("[settingStore] fetchProviders 方法被调用");

      set({ providersLoading: true, providersError: null });

      try {
        console.log("[settingStore] fetchProviders 开始调用 API");

        // 先单独调用 listProviders
        console.log("[settingStore] 调用 listProviders...");
        const providers = await settingApi.listProviders();
        console.log("[settingStore] listProviders 返回:", providers);

        console.log("[settingStore] 调用 getDefaultProvider...");
        const defaultProvider = await settingApi.getDefaultProvider();
        console.log("[settingStore] getDefaultProvider 返回:", defaultProvider);

        console.log("[settingStore] fetchProviders API 调用完成");
        console.log("[settingStore] fetchProviders 处理前的 providers:", {
          providers,
          providersType: typeof providers,
          providersIsArray: Array.isArray(providers),
        });

        const safeProviders = Array.isArray(providers) ? providers : [];
        console.log(
          "[settingStore] fetchProviders 处理后的 providers:",
          safeProviders,
        );

        set({
          providers: safeProviders,
          defaultProvider,
          providersLoading: false,
        });

        console.log("[settingStore] fetchProviders 状态更新完成");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("[settingStore] fetchProviders 错误:", error);
        set({ providersLoading: false, providersError: errorMessage });
        throw error;
      }
    },

    createProvider: async (data) => {
      set({ providersLoading: true, providersError: null });

      try {
        const provider = await settingApi.createProvider(data);
        const { providers } = get();
        const currentProviders = providers || [];
        set({
          providers: [...currentProviders, provider],
          providersLoading: false,
        });

        // 如果设置为默认，更新默认供应商
        if (data.is_default) {
          set({ defaultProvider: provider });
        }

        return provider;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("createProvider 错误:", error);
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
          const currentProviders = providers || [];
          const newProviders = currentProviders.map((p) =>
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
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("updateProvider 错误:", error);
        set({ providersLoading: false, providersError: errorMessage });
        throw error;
      }
    },

    deleteProvider: async (providerId) => {
      set({ providersLoading: true, providersError: null });

      try {
        await settingApi.deleteProvider(providerId);
        const { providers, defaultProvider } = get();

        const currentProviders = providers || [];
        const newProviders = currentProviders.filter(
          (p) => p.provider_id !== providerId,
        );
        set({ providers: newProviders, providersLoading: false });

        // 如果删除的是默认供应商，清除默认
        if (defaultProvider?.provider_id === providerId) {
          set({ defaultProvider: null });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("deleteProvider 错误:", error);
        set({ providersLoading: false, providersError: errorMessage });
        throw error;
      }
    },

    testProvider: async (providerId, model) => {
      try {
        const result = await settingApi.testProvider({
          provider_id: providerId,
          model,
        });

        const state = get();
        // 确保 state.testResults 是一个对象，如果 undefined 则初始化
        const currentTestResults = state.testResults || {};

        set({
          testResults: {
            ...currentTestResults,
            [`${providerId}-${model || "default"}`]: result,
          },
        });

        return result;
      } catch (error) {
        console.error("testProvider 错误:", error);
        throw error;
      }
    },

    setDefaultProvider: async (providerId) => {
      try {
        await settingApi.setDefaultProvider(providerId);
        const { providers } = get();
        const provider = (providers || []).find(
          (p) => p.provider_id === providerId,
        );

        if (provider) {
          set({ defaultProvider: provider });
        }
      } catch (error) {
        console.error("setDefaultProvider 错误:", error);
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
        console.error("syncModels 错误:", error);
        throw error;
      }
    },

    chat: async (request) => {
      return await settingApi.chat(request);
    },

    // ============ 任务配置相关 ============

    fetchTaskConfigs: async () => {
      set({
        taskConfigsLoading: true,
        taskConfigs: null,
        taskConfigsError: null,
      });

      try {
        console.log("[settingStore] fetchTaskConfigs 开始调用");
        const configs = await settingApi.listTaskConfigs();

        console.log("[settingStore] fetchTaskConfigs API 响应:", {
          configsType: typeof configs,
          isArray: Array.isArray(configs),
          configsLength: configs?.length,
        });

        const safeConfigs = Array.isArray(configs) ? configs : [];
        const configMap = safeConfigs.reduce(
          (acc, config) => {
            acc[config.task_name] = config;
            return acc;
          },
          {} as Record<string, LLMTaskConfig>,
        );

        console.log(
          "[settingStore] fetchTaskConfigs 处理后的 configMap:",
          configMap,
        );

        set({ taskConfigs: configMap, taskConfigsLoading: false });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("[settingStore] fetchTaskConfigs 错误:", error);
        set({ taskConfigsLoading: false, taskConfigsError: errorMessage });
        throw error;
      }
    },

    updateTaskConfig: async (config) => {
      try {
        await settingApi.updateTaskConfig(config);

        const state = get();
        // 确保 state.taskConfigs 是一个对象
        const currentTaskConfigs = state.taskConfigs || {};

        set({
          taskConfigs: {
            ...currentTaskConfigs,
            [config.task_name]: config,
          },
        });
      } catch (error) {
        console.error("updateTaskConfig 错误:", error);
        throw error;
      }
    },

    // ============ 错误处理 ============

    clearError: () => {
      set({ providersError: null, taskConfigsError: null });
    },
  }),
);

/**
 * Hook: 获取任务配置
 */
export const useTaskConfig = (taskName: LLMTaskName) => {
  return useSettingStore((state) => state.taskConfigs?.[taskName]);
};

/**
 * Hook: 获取供应商测试结果
 */
export const useTestResult = (providerId: string, model?: string) => {
  return useSettingStore(
    (state) => state.testResults?.[`${providerId}-${model || "default"}`],
  );
};
