/**
 * 共享类型入口文件
 * 重新导出所有共享类型
 */

// 导出 IPC 通道定义
export * from './ipc';

// 导出 API 相关类型
export * from './api';

// 导出 LLM 相关类型
export * from './llm';

// 重新导入类型用于接口定义
import type {
  ApiResponse,
  ResumeUploadRequest,
  ResumeUploadResponse,
  ResumeListRequest,
  ResumeListData,
  ResumeGetRequest,
  ResumeData,
  ResumeUpdateRequest,
  ResumeAnalyzeRequest,
  ResumeAnalyzeResponse,
  ResumeOptimizeRequest,
  OptimizationResultData,
  ResumeGetStatusRequest,
  ResumeStatusData,
  ResumeGenerateQuestionsRequest,
  ResumeGenerateQuestionsResponse,
  ResumeDeleteRequest,
  UserRegisterRequest,
  UserRegisterResponse,
  UserLoginRequest,
  UserLoginResponse,
  UserData,
  UserUpdateProfileRequest,
  UserChangePasswordRequest,
  UserStatsData,
} from './api';

// ============================================================================
// Electron API 接口定义
// ============================================================================

/**
 * Resume API 接口 - 通过 IPC 调用
 */
export interface ResumeApi {
  upload: (request: ResumeUploadRequest) => Promise<ApiResponse<ResumeUploadResponse>>;
  list: (request?: ResumeListRequest) => Promise<ApiResponse<ResumeListData>>;
  get: (request: ResumeGetRequest) => Promise<ApiResponse<ResumeData>>;
  update: (request: ResumeUpdateRequest) => Promise<ApiResponse<ResumeData>>;
  delete: (request: ResumeDeleteRequest) => Promise<ApiResponse<void>>;
  analyze: (request: ResumeAnalyzeRequest) => Promise<ApiResponse<ResumeAnalyzeResponse>>;
  optimize: (request: ResumeOptimizeRequest) => Promise<ApiResponse<OptimizationResultData>>;
  getStatus: (request: ResumeGetStatusRequest) => Promise<ApiResponse<ResumeStatusData>>;
  generateQuestions: (request: ResumeGenerateQuestionsRequest) => Promise<ApiResponse<ResumeGenerateQuestionsResponse>>;
}

/**
 * User API 接口 - 通过 IPC 调用
 */
export interface UserApi {
  register: (request: UserRegisterRequest) => Promise<ApiResponse<UserRegisterResponse>>;
  login: (request: UserLoginRequest) => Promise<ApiResponse<UserLoginResponse>>;
  getProfile: () => Promise<ApiResponse<UserData>>;
  updateProfile: (request: UserUpdateProfileRequest) => Promise<ApiResponse<UserData>>;
  changePassword: (request: UserChangePasswordRequest) => Promise<ApiResponse<void>>;
  getStats: () => Promise<ApiResponse<UserStatsData>>;
  logout: () => Promise<ApiResponse<void>>;
}

/**
 * Setting API 接口 - 通过 IPC 调用
 */
export interface SettingApi {
  // LLM 供应商相关
  providerList: () => Promise<ApiResponse<any[]>>;
  providerGet: (providerId: string) => Promise<ApiResponse<any>>;
  providerCreate: (data: any) => Promise<ApiResponse<any>>;
  providerUpdate: (providerId: string, data: any) => Promise<ApiResponse<any>>;
  providerDelete: (providerId: string) => Promise<ApiResponse<any>>;
  providerTest: (request: any) => Promise<ApiResponse<any>>;
  providerSetDefault: (providerId: string) => Promise<ApiResponse<any>>;
  providerGetDefault: () => Promise<ApiResponse<any>>;

  // 任务配置相关
  taskConfigGet: (taskName: string) => Promise<ApiResponse<any>>;
  taskConfigList: () => Promise<ApiResponse<any[]>>;
  taskConfigUpdate: (config: any) => Promise<ApiResponse<void>>;

  // 模型列表相关
  modelsSync: (request: any) => Promise<ApiResponse<any>>;
}

/**
 * Electron API 接口
 * 通过 Preload 脚本暴露到渲染进程
 */
export interface ElectronAPI {
  // ============ 文件操作 ============
  selectFile: (options?: {
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{ canceled: boolean; filePaths?: string[] }>;

  saveFile: (
    data: string,
    filename: string,
    options?: {
      filters?: Array<{ name: string; extensions: string[] }>;
    }
  ) => Promise<{ success: boolean; filePath?: string }>;

  selectDirectory: () => Promise<{ canceled: boolean; filePaths?: string[] }>;

  // ============ 应用控制 ============
  getAppVersion: () => Promise<string>;
  quitApp: () => Promise<void>;
  minimizeApp: () => Promise<void>;
  maximizeApp: () => Promise<void>;

  // ============ 数据库操作 ============
  getDatabasePath: () => Promise<string>;
  exportDatabase: (filePath?: string) => Promise<{ success: boolean; filePath?: string }>;
  importDatabase: (filePath: string) => Promise<{ success: boolean; message?: string }>;

  // ============ 窗口控制 ============
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (filePath: string) => Promise<void>;

  // ============ 通知 ============
  showNotification: (options: {
    title: string;
    body: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }) => Promise<void>;

  // ============ 业务 API (IPC 封装) ============
  resume: ResumeApi;
  user: UserApi;
  setting: SettingApi;
}

/**
 * 菜单事件接口
 */
export interface ElectronMenu {
  onOpenResume: (callback: () => void) => void;
  onExportResults: (callback: () => void) => void;
  onExportDatabase: (callback: () => void) => void;
  onImportDatabase: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;
}

/**
 * 全局 Window 扩展
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electronMenu: ElectronMenu;
  }
}
