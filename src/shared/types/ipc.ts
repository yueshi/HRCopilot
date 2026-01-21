/**
 * IPC 通道常量定义
 * 所有 IPC 通道名称集中管理，避免字符串硬编码和拼写错误
 */

export const IPC_CHANNELS = {
  // ============ 系统相关 ============
  SYSTEM: {
    GET_VERSION: "system:get-version",
    GET_HEALTH: "system:get-health",
  },

  // ============ 用户相关 ============
  USER: {
    REGISTER: "user:register",
    LOGIN: "user:login",
    GET_PROFILE: "user:get-profile",
    UPDATE_PROFILE: "user:update-profile",
    CHANGE_PASSWORD: "user:change-password",
    GET_STATS: "user:get-stats",
    LOGOUT: "user:logout",
  },

  // ============ 简历相关 ============
  RESUME: {
    UPLOAD: "resume:upload",
    LIST: "resume:list",
    GET: "resume:get",
    UPDATE: "resume:update",
    DELETE: "resume:delete",
    ANALYZE: "resume:analyze",
    OPTIMIZE: "resume:optimize",
    GET_STATUS: "resume:get-status",
    GENERATE_QUESTIONS: "resume:generate-questions",
  },

  // ============ 文件相关 ============
  FILE: {
    PARSE: "file:parse",
    VALIDATE: "file:validate",
  },

  // ============ 数据库相关 ============
  DATABASE: {
    GET_PATH: "database:get-path",
    EXPORT: "database:export",
    IMPORT: "database:import",
    GET_STATS: "database:get-stats",
  },

  // ============ 设置相关 ============
  SETTING: {
    // LLM 供应商相关
    PROVIDER_LIST: "setting:provider:list",
    PROVIDER_GET: "setting:provider:get",
    PROVIDER_CREATE: "setting:provider:create",
    PROVIDER_UPDATE: "setting:provider:update",
    PROVIDER_DELETE: "setting:provider:delete",
    PROVIDER_TEST: "setting:provider:test",
    PROVIDER_SET_DEFAULT: "setting:provider:set-default",
    PROVIDER_GET_DEFAULT: "setting:provider:get-default",
    PROVIDER_CHAT: "setting:provider:chat",

    // 任务配置相关
    TASK_CONFIG_GET: "setting:task-config:get",
    TASK_CONFIG_UPDATE: "setting:task-config:update",
    TASK_CONFIG_LIST: "setting:task-config:list",

    // 模型列表相关
    MODELS_SYNC: "setting:models:sync",
    CONFIG_EXPORT: "setting:config:export",
    CONFIG_IMPORT: "setting:config:import",
  },

  // ============ AI HR Assistant 相关 ============
  AI_HR_ASSISTANT: {
    SEND_MESSAGE: "ai-hr-assistant:send-message",
    STREAM_MESSAGE: "ai-hr-assistant:stream-message",
    GET_HISTORY: "ai-hr-assistant:get-history",
    CLEAR_HISTORY: "ai-hr-assistant:clear-history",
    GENERATE_SUGGESTION: "ai-hr-assistant:generate-suggestion",
  },

  // ============ 去重和版本管理相关 ============
  DEDEUPE: {
    DETECT: "dedupe:detect",
  },
  VERSION: {
    CREATE_GROUP: "version:create-group",
    ADD_VARIANT: "version:add-variant",
    SET_PRIMARY: "version:set-primary",
    GET_VERSIONS: "version:get-versions",
    MERGE_GROUPS: "version:merge-groups",
    DELETE_GROUP: "version:delete-group",
  },

  // ============ 窗口管理相关 ============
  WINDOW: {
    SHOW_MAIN: "window:show-main",
    HIDE_MAIN: "window:hide-main",
    SHOW_MINIBAR: "window:show-minibar",
    HIDE_MINIBAR: "window:hide-minibar",
    SET_HIDDEN_PATH: "window:set-hidden-path",
    GET_HIDDEN_PATH: "window:get-hidden-path",
    CLEAR_HIDDEN_PATH: "window:clear-hidden-path",
    GET_STATE: "window:get-state",
    LOGOUT: "window:logout",
    TRANSITION_STATE: "window:transition-state",
  } as const,
} as const;

// 窗口类型枚举
export enum WindowType {
  MINIBAR = "minibar",
  MAIN = "main",
}

// 窗口状态枚举（用于状态机）
export enum WindowState {
  /** 仅主窗口 - 应用启动或主窗口正常显示时 */
  MAIN_ONLY = "main_only",

  /** 主窗口 + Minibar 窗口 - Minibar菜单被点击时 */
  MAIN_WITH_MINIBAR = "main_with_minibar",

  /** 仅 Minibar 窗口 - 主窗口隐藏时 */
  MINIBAR_ONLY = "minibar_only",
}

// 显示功能窗口请求
export interface ShowMainWindowRequest {
  path?: string;
  clearPath?: boolean;
}

// 窗口状态响应
export interface WindowStateResponse {
  currentWindow: WindowType | null;
  mainWindowVisible: boolean;
  minibarWindowVisible: boolean;
  hiddenMainPath: string | null;
}

// 导出通道类型用于类型约束
export type IPCChannel =
  | typeof IPC_CHANNELS.SYSTEM[keyof typeof IPC_CHANNELS.SYSTEM]
  | typeof IPC_CHANNELS.USER[keyof typeof IPC_CHANNELS.USER]
  | typeof IPC_CHANNELS.RESUME[keyof typeof IPC_CHANNELS.RESUME]
  | typeof IPC_CHANNELS.FILE[keyof typeof IPC_CHANNELS.FILE]
  | typeof IPC_CHANNELS.DATABASE[keyof typeof IPC_CHANNELS.DATABASE]
  | typeof IPC_CHANNELS.SETTING[keyof typeof IPC_CHANNELS.SETTING]
  | typeof IPC_CHANNELS.AI_HR_ASSISTANT[keyof typeof IPC_CHANNELS.AI_HR_ASSISTANT]
  | typeof IPC_CHANNELS.DEDEUPE[keyof typeof IPC_CHANNELS.DEDEUPE]
  | typeof IPC_CHANNELS.VERSION[keyof typeof IPC_CHANNELS.VERSION]
  | typeof IPC_CHANNELS.WINDOW[keyof typeof IPC_CHANNELS.WINDOW];
