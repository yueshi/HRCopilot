import { invokeIPC } from './ipcApi';
import { IPC_CHANNELS } from '../../../shared/types';
import type {
  UserData,
  UserRegisterRequest,
  UserLoginRequest,
  UserLoginResponse,
  UserRegisterResponse,
  UserUpdateProfileRequest,
  UserChangePasswordRequest,
  UserStatsData,
} from '../../../shared/types';

/**
 * 用户 IPC 服务
 * 替代原来的 authService.ts
 */
export const userApi = {
  /**
   * 用户注册
   */
  register: async (
    data: UserRegisterRequest
  ): Promise<UserRegisterResponse> => {
    const response = await invokeIPC<UserRegisterResponse>(
      IPC_CHANNELS.USER.REGISTER,
      data
    );
    return response;
  },

  /**
   * 用户登录
   */
  login: async (
    email: string,
    password: string
  ): Promise<UserLoginResponse> => {
    // 这里需要注意：invokeIPC 已经处理了 ApiResponse 的包装，直接返回 data 部分
    // 所以 response 已经是 UserLoginResponse 类型（包含 user 字段）
    const response = await invokeIPC<UserLoginResponse>(
      IPC_CHANNELS.USER.LOGIN,
      { email, password } as UserLoginRequest
    );

    console.log('userApi.login response:', response); // 添加调试日志

    // 登录成功，保存用户信息到本地存储
    if (response && 'user' in response && response.user) {
      localStorage.setItem('user-storage', JSON.stringify({
        user: response.user,
        timestamp: Date.now(),
      }));
    } else {
      console.error('登录响应格式错误:', response);
      throw new Error('登录响应格式错误');
    }

    return response;
  },

  /**
   * 获取用户资料
   */
  getProfile: async (): Promise<UserData> => {
    return invokeIPC<UserData>(
      IPC_CHANNELS.USER.GET_PROFILE
    );
  },

  /**
   * 更新用户资料
   */
  updateProfile: async (
    data: UserUpdateProfileRequest
  ): Promise<UserData> => {
    return invokeIPC<UserData>(
      IPC_CHANNELS.USER.UPDATE_PROFILE,
      data
    );
  },

  /**
   * 修改密码
   */
  changePassword: async (
    data: UserChangePasswordRequest
  ): Promise<void> => {
    return invokeIPC<void>(
      IPC_CHANNELS.USER.CHANGE_PASSWORD,
      data
    );
  },

  /**
   * 获取用户统计
   */
  getStats: async (): Promise<UserStatsData> => {
    return invokeIPC<UserStatsData>(
      IPC_CHANNELS.USER.GET_STATS
    );
  },

  /**
   * 用户登出
   */
  logout: async (): Promise<void> => {
    // 清除本地存储
    localStorage.removeItem('user-storage');

    return invokeIPC<void>(
      IPC_CHANNELS.USER.LOGOUT
    );
  },

  /**
   * 检查登录状态
   */
  isLoggedIn: (): boolean => {
    const userStorage = localStorage.getItem('user-storage');
    if (!userStorage) return false;

    try {
      const data = JSON.parse(userStorage);
      return !!data.user;
    } catch {
      return false;
    }
  },

  /**
   * 获取当前用户
   */
  getCurrentUser: (): UserData | null => {
    const userStorage = localStorage.getItem('user-storage');
    if (!userStorage) return null;

    try {
      const data = JSON.parse(userStorage);
      return data.user || null;
    } catch {
      return null;
    }
  },
};
