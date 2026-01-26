import { invokeIPC } from './ipcApi';
import { IPC_CHANNELS } from '../../../shared/types';
import type {
  ApiResponse,
  UserData,
  UserRegisterRequest,
  UserLoginRequest,
  UserLoginResponse,
  UserRegisterResponse,
  UserUpdateProfileRequest,
  UserChangePasswordRequest,
  UserStatsData,
} from '../../../shared/types';

const console = window.console;

const electronAPI = (window as any).electronAPI;

export const userApi = {
  register: async (
    data: UserRegisterRequest
  ): Promise<UserRegisterResponse> => {
    const response = await invokeIPC<ApiResponse<UserRegisterResponse>>(
      IPC_CHANNELS.USER.REGISTER,
      data
    );
    if (response && response.success && response.data) {
      return response.data;
    }
    throw new Error('注册失败');
  },

  login: async (
    email: string,
    password: string
  ): Promise<UserLoginResponse> => {
    const response = await invokeIPC<ApiResponse<UserLoginResponse>>(
      IPC_CHANNELS.USER.LOGIN,
      { email, password } as UserLoginRequest
    );

    console.log('userApi.login response:', response);

    if (response && response.success && response.data && response.data.user) {
      const dataToStore = {
        user: response.data.user,
        timestamp: Date.now(),
      };
      console.log('userApi.login 保存到持久化存储:', dataToStore);
      await electronAPI?.storage?.setItem('user-storage', JSON.stringify(dataToStore));
      const saved = await electronAPI?.storage?.getItem('user-storage');
      console.log('userApi.login 验证保存:', saved);
      return response.data;
    } else {
      console.error('登录响应格式错误:', response);
      throw new Error('登录响应格式错误');
    }
  },

  getProfile: async (): Promise<UserData> => {
    const response = await invokeIPC<ApiResponse<UserData>>(
      IPC_CHANNELS.USER.GET_PROFILE
    );
    console.log('userApi.getProfile response:', response);
    if (response && response.success && response.data) {
      return response.data;
    }
    throw new Error('获取用户资料失败');
  },

  updateProfile: async (
    data: UserUpdateProfileRequest
  ): Promise<UserData> => {
    const response = await invokeIPC<ApiResponse<UserData>>(
      IPC_CHANNELS.USER.UPDATE_PROFILE,
      data
    );
    if (response && response.success && response.data) {
      return response.data;
    }
    throw new Error('更新用户资料失败');
  },

  changePassword: async (
    data: UserChangePasswordRequest
  ): Promise<void> => {
    const response = await invokeIPC<ApiResponse<void>>(
      IPC_CHANNELS.USER.CHANGE_PASSWORD,
      data
    );
    if (response && response.success) {
      return;
    }
    throw new Error('修改密码失败');
  },

  getStats: async (): Promise<UserStatsData> => {
    const response = await invokeIPC<ApiResponse<UserStatsData>>(
      IPC_CHANNELS.USER.GET_STATS
    );
    if (response && response.success && response.data) {
      return response.data;
    }
    throw new Error('获取用户统计失败');
  },

  logout: async (): Promise<void> => {
    console.log('[userApi] logout 被调用，清除持久化存储');
    await electronAPI?.storage?.removeItem('user-storage');

    return invokeIPC<void>(
      IPC_CHANNELS.USER.LOGOUT
    );
  },

  isLoggedIn: async (): Promise<boolean> => {
    const userStorage = await electronAPI?.storage?.getItem('user-storage');
    console.log('[userApi] isLoggedIn 检查持久化存储:', userStorage);
    if (!userStorage) return false;

    try {
      const data = JSON.parse(userStorage);
      console.log('[userApi] isLoggedIn 解析后 data:', data, '有user:', !!data.user);
      return !!data.user;
    } catch {
      console.error('[userApi] isLoggedIn 解析失败');
      return false;
    }
  },

  getCurrentUser: async (): Promise<UserData | null> => {
    const userStorage = await electronAPI?.storage?.getItem('user-storage');
    if (!userStorage) return null;

    try {
      const data = JSON.parse(userStorage);
      return data.user || null;
    } catch {
      return null;
    }
  },

  getLastLoginInfo: async (): Promise<{ user: UserData; timestamp: number } | null> => {
    const userStorage = await electronAPI?.storage?.getItem('user-storage');
    console.log('[userApi] 持久化存储 user-storage:', userStorage);
    if (!userStorage) return null;

    try {
      const data = JSON.parse(userStorage);
      console.log('[userApi] 解析后的数据:', data);
      if (!data.user || !data.timestamp) {
        console.log('[userApi] 数据缺少 user 或 timestamp');
        return null;
      }

      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;
      const timeDiff = now - data.timestamp;
      const isValid = timeDiff < thirtyMinutes;

      console.log('[userApi] 时间检查:', {
        now,
        timestamp: data.timestamp,
        timeDiff,
        thirtyMinutes,
        isValid,
        minutesAgo: Math.floor(timeDiff / (60 * 1000))
      });

      return isValid ? { user: data.user, timestamp: data.timestamp } : null;
    } catch (error) {
      console.error('[userApi] getLastLoginInfo 错误:', error);
      return null;
    }
  },

  updateActivityTimestamp: async (): Promise<void> => {
    const userStorage = await electronAPI?.storage?.getItem('user-storage');
    if (!userStorage) return;

    try {
      const data = JSON.parse(userStorage);
      if (data.user) {
        data.timestamp = Date.now();
        await electronAPI?.storage?.setItem('user-storage', JSON.stringify(data));
        console.log('[userApi] updateActivityTimestamp 更新时间戳:', data.timestamp);
      }
    } catch (error) {
      console.error('[userApi] updateActivityTimestamp 错误:', error);
    }
  },
};
