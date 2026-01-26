import type { ApiResponse } from "../../../shared/types";

/**
 * IPC 调用工具函数
 * 统一处理 Electron IPC 通信
 */

// 存储操作特殊处理（直接返回值，不是 ApiResponse）
const STORAGE_CHANNELS = [
  "storage:get",
  "storage:set",
  "storage:remove"
];

export async function invokeIPC<T = any>(
  channel: string,
  ...args: any[]
): Promise<T> {
  const { electronAPI } = window as any;

  if (!electronAPI) {
    throw new Error("electronAPI 未初始化，请确保应用在 Electron 环境中运行");
  }

  try {
    let api: any = electronAPI;

    // 存储通道直接从 electronAPI.storage 获取
    if (STORAGE_CHANNELS.includes(channel)) {
      api = electronAPI.storage;
      const method = channel.split(":")[1]; // "get", "set", "remove"
      const camelCaseMethod = method === "get" ? "getItem" : method === "set" ? "setItem" : "removeItem";
      api = api[camelCaseMethod];
    } else if (channel.startsWith("user:")) {
      api = electronAPI.user;
      const method = channel
        .slice(5)
        .replace(/-([a-z])/g, (match, char) => char.toUpperCase());
      api = api[method];
    } else if (channel.startsWith("resume:")) {
      api = electronAPI.resume;
      const method = channel
        .slice(7)
        .replace(/-([a-z])/g, (match, char) => char.toUpperCase());
      api = api[method];
    } else if (channel.startsWith("setting:")) {
      api = electronAPI.setting;
      const subChannel = channel.slice(8);

      if (subChannel.startsWith("provider:")) {
        const subMethod = subChannel.slice(9);
        const parts = subMethod.split("-");
        // Convert to camelCase: "list" -> "List", "get-default" -> "GetDefault"
        const methodName =
          "provider" +
          parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
        api = api[methodName];
      } else if (subChannel.startsWith("task-config:")) {
        const subMethod = subChannel.slice(12);
        const parts = subMethod.split("-");
        // Convert to camelCase: "get" -> "Get", "update" -> "Update"
        const methodName =
          "taskConfig" +
          parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
        api = api[methodName];
      } else if (subChannel === "models:sync") {
        api = api.modelsSync;
      }
    } else if (channel.startsWith("ai-hr-assistant:")) {
      api = electronAPI.aiHrAssistant;
      const method = channel
        .slice(15)
        .replace(/-([a-z])/g, (match, char) => char.toUpperCase());
      api = api[method];
    } else if (channel.startsWith("version:")) {
      api = electronAPI.version;
      const method = channel
        .slice(8)
        .replace(/-([a-z])/g, (match, char) => char.toUpperCase());
      api = api[method];
    } else if (channel.startsWith("dedupe:")) {
      api = electronAPI.dedupe;
      const method = channel
        .slice(7)
        .replace(/-([a-z])/g, (match, char) => char.toUpperCase());
      api = api[method];
    } else if (channel.startsWith("window:")) {
      api = electronAPI.window;
      const method = channel
        .slice(7)
        .replace(/-([a-z])/g, (match, char) => char.toUpperCase());
      api = api[method];
    }

    if (!api || typeof api !== "function") {
      throw new Error(`IPC 通道 ${channel} 不存在`);
    }

    const response = await api(...args);

    return response as T;
  } catch (error) {
    const errorMessage = error?.message || String(error);

    // "用户未登录" 是预期内的业务逻辑，用 info 级别
    if (errorMessage.includes("用户未登录")) {
      if (import.meta.env.DEV) {
        console.info(`IPC [${channel}]: 用户未登录`);
      }
    } else {
      console.error(`IPC 调用失败 [${channel}]:`, error);
    }

    throw error;
  }
}

export function isElectronEnv(): boolean {
  return (
    typeof window !== "undefined" && (window as any).electronAPI !== undefined
  );
}
