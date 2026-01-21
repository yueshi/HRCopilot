import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment

const electronAPI: Record<string, any> = {
  // 文件操作
  selectFile: (options?: any) => ipcRenderer.invoke("select-file", options),
  saveFile: (data: string, filename: string, options?: any) =>
    ipcRenderer.invoke("save-file", data, filename, options),
  selectDirectory: () => ipcRenderer.invoke("select-directory"),

  // 应用控制
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  minimizeApp: () => ipcRenderer.invoke("minimize-app"),
  maximizeApp: () => ipcRenderer.invoke("maximize-app"),

  // 数据库操作
  getDatabasePath: () => ipcRenderer.invoke("get-database-path"),
  exportDatabase: (filePath?: string) => ipcRenderer.invoke("export-database", filePath),
  importDatabase: (filePath: string) => ipcRenderer.invoke("import-database", filePath),

  // 窗口控制
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke("show-item-in-folder", filePath),
  showNotification: (options: any) => ipcRenderer.invoke("show-notification", options),

  // Window API - 窗口隐藏/恢复管理
  window: {
    showMain: (options?: any) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW.SHOW_MAIN, options),
    hideMain: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW.HIDE_MAIN),
    saveHiddenPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW.SET_HIDDEN_PATH, path),
    getHiddenPath: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW.GET_HIDDEN_PATH),
    clearHiddenPath: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW.CLEAR_HIDDEN_PATH),
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW.GET_STATE),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW.LOGOUT),
    transitionState: (state: any) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW.TRANSITION_STATE, state),
  },

  // Resume API
  resume: {
    upload: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.RESUME.UPLOAD, request),
    list: (request?: any) => ipcRenderer.invoke(IPC_CHANNELS.RESUME.LIST, request),
    get: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.RESUME.GET, request),
    update: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.RESUME.UPDATE, request),
    delete: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.RESUME.DELETE, request),
    analyze: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.RESUME.ANALYZE, request),
    optimize: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.RESUME.OPTIMIZE, request),
    getStatus: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.RESUME.GET_STATUS, request),
    generateQuestions: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.RESUME.GENERATE_QUESTIONS, request),
  },

  // User API
  user: {
    register: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.USER.REGISTER, request),
    login: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.USER.LOGIN, request),
    getProfile: () => ipcRenderer.invoke(IPC_CHANNELS.USER.GET_PROFILE),
    updateProfile: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.USER.UPDATE_PROFILE, request),
    changePassword: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.USER.CHANGE_PASSWORD, request),
    getStats: () => ipcRenderer.invoke(IPC_CHANNELS.USER.GET_STATS),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.USER.LOGOUT),
  },

  // Setting API
  setting: {
    // LLM 供应商相关
    providerList: () => ipcRenderer.invoke(IPC_CHANNELS.SETTING.PROVIDER_LIST),
    providerGet: (providerId: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTING.PROVIDER_GET, providerId),
    providerCreate: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.SETTING.PROVIDER_CREATE, data),
    providerUpdate: (providerId: string, data: any) => ipcRenderer.invoke(IPC_CHANNELS.SETTING.PROVIDER_UPDATE, providerId, data),
    providerDelete: (providerId: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTING.PROVIDER_DELETE, providerId),
    providerTest: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.SETTING.PROVIDER_TEST, request),
    providerSetDefault: (providerId: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTING.PROVIDER_SET_DEFAULT, providerId),
    providerGetDefault: () => ipcRenderer.invoke(IPC_CHANNELS.SETTING.PROVIDER_GET_DEFAULT),

    // 任务配置相关
    taskConfigGet: (taskName: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTING.TASK_CONFIG_GET, taskName),
    taskConfigList: () => ipcRenderer.invoke(IPC_CHANNELS.SETTING.TASK_CONFIG_LIST),
    taskConfigUpdate: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.SETTING.TASK_CONFIG_UPDATE, config),

    // 模型列表
    modelsSync: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.SETTING.MODELS_SYNC, request),
  },

  // Deduplication
  dedupe: {
    detect: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.DEDEUPE.DETECT, request),
  },

  // Version API
  version: {
    createGroup: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.VERSION.CREATE_GROUP, request),
    addVariant: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.VERSION.ADD_VARIANT, request),
    setPrimary: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.VERSION.SET_PRIMARY, request),
    getVersions: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.VERSION.GET_VERSIONS, request),
    mergeGroups: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.VERSION.MERGE_GROUPS, request),
    deleteGroup: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.VERSION.DELETE_GROUP, request),
  },

  // AI HR Assistant API
  aiHrAssistant: {
    sendMessage: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.AI_HR_ASSISTANT.SEND_MESSAGE, request),
    streamMessage: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.AI_HR_ASSISTANT.STREAM_MESSAGE, request),
    getHistory: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.AI_HR_ASSISTANT.GET_HISTORY, request),
    clearHistory: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.AI_HR_ASSISTANT.CLEAR_HISTORY, request),
    generateSuggestion: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.AI_HR_ASSISTANT.GENERATE_SUGGESTION, request),
  },
};

contextBridge.exposeInMainWorld('electronMenu', {
  onOpenResume: (callback: () => void) => {
    ipcRenderer.on('menu-open-resume', callback);
  },
  onExportResults: (callback: () => void) => {
    ipcRenderer.on('menu-export-results', callback);
  },
  onExportDatabase: (callback: () => void) => {
    ipcRenderer.on('menu-export-database', callback);
  },
  onImportDatabase: (callback: () => void) => {
    ipcRenderer.on('menu-import-database', callback);
  },
  onNavigateTo: (callback: () => void) => {
    ipcRenderer.on('navigate-to', callback);
  },
  onWindowStateChanged: (callback: () => void) => {
    ipcRenderer.on('window-state-changed', callback);
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, callback);
  },
  // AI HR 助手流式事件监听
  onAiHrAssistantStreamStart: (callback: (...args: any[]) => void) => {
    ipcRenderer.on('ai-hr-assistant:stream-start', callback);
  },
  onAiHrAssistantStreamChunk: (callback: (...args: any[]) => void) => {
    ipcRenderer.on('ai-hr-assistant:stream-chunk', callback);
  },
  onAiHrAssistantStreamEnd: (callback: (...args: any[]) => void) => {
    ipcRenderer.on('ai-hr-assistant:stream-end', callback);
  },
  onAiHrAssistantStreamError: (callback: (...args: any[]) => void) => {
    ipcRenderer.on('ai-hr-assistant:stream-error', callback);
  },
  removeAiHrAssistantStreamListeners: () => {
    ipcRenderer.removeAllListeners('ai-hr-assistant:stream-start');
    ipcRenderer.removeAllListeners('ai-hr-assistant:stream-chunk');
    ipcRenderer.removeAllListeners('ai-hr-assistant:stream-end');
    ipcRenderer.removeAllListeners('ai-hr-assistant:stream-error');
  },
});

(contextBridge as any).exposeInMainWorld('electronAPI', electronAPI);

if (process.env.NODE_ENV === 'development') {
  console.log('Preload script loaded successfully');
}

export {};
