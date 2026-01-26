import { create } from "zustand";
import { userApi } from "../services/userIpcService";
import type { UserData, UserStatsData } from "../../../shared/types";

export interface User {
  id: number;
  email: string;
  name: string;
  userType: "free" | "vip" | "admin";
}

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  stats: UserStatsData | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  fetchUser: () => Promise<void>;
  fetchStats: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  isLoggedIn: false,
  isLoading: false,
  error: null,
  stats: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });

    try {
      console.log("authStore.login: 调用 userApi.login");
      const userLoginResponse = await userApi.login(email, password);
      console.log("authStore.login: 响应", userLoginResponse);

      // userApi.login 已经解包了 ApiResponse，直接返回 UserLoginResponse
      const userData = userLoginResponse.user;
      if (userData && userData.id) {
        const user: User = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          userType: userData.userType || "free",
        };

        set({ user, isLoggedIn: true, isLoading: false });

        userApi
          .getStats()
          .then((stats) => {
            set({ stats });
          })
          .catch(() => {});
      } else {
        console.error(
          "authStore.login: 响应中没有 user 字段",
          userLoginResponse,
        );
        set({ isLoading: false, error: "登录失败：响应格式错误" });
        throw new Error("登录失败：响应格式错误");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("authStore.login: 错误", error);
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  logout: async () => {
    try {
      await userApi.logout();
      set({ user: null, isLoggedIn: false, stats: null });
    } catch (error) {
      console.error("登出失败:", error);
      set({ user: null, isLoggedIn: false, stats: null });
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true, error: null });

    try {
      const registerResponse = await userApi.register({
        email,
        password,
        name,
      });

      if (registerResponse && registerResponse.userId) {
        await get().login(email, password);
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  updateProfile: async (updates) => {
    set({ isLoading: true, error: null });

    try {
      const user = await userApi.updateProfile(updates);
      if (user) {
        const updatedUser: User = {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: user.userType || "free",
        };
        set({ user: updatedUser, isLoading: false });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  changePassword: async (oldPassword, newPassword) => {
    set({ isLoading: true, error: null });

    try {
      await userApi.changePassword({
        currentPassword: oldPassword,
        newPassword,
      });
      set({ isLoading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  fetchUser: async () => {
    try {
      console.log("[authStore] fetchUser 调用 getProfile");
      const user = await userApi.getProfile();
      console.log("[authStore] fetchUser 成功，获取到用户:", user);
      if (user) {
        const userData: User = {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: user.userType || "free",
        };
        console.log("[authStore] 设置用户数据，isLoggedIn=true");
        set({ user: userData, isLoggedIn: true });
        // 确保 localStorage 中的时间戳是最新的
        userApi.updateActivityTimestamp().catch(() => {});
      }
    } catch (error) {
      // 静默处理登录状态失效，只在调试模式下输出
      console.error("[authStore] fetchUser 失败:", error);
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("用户未登录")) {
        // 只有真正是"用户未登录"错误才清除存储
        console.log("[authStore] 用户未登录，清除 localStorage");
        if (import.meta.env.DEV) {
          console.info("[Auth] Session 已失效，需要重新登录");
        }
        set({ user: null, isLoggedIn: false });
        // 清除本地存储
        userApi.logout().catch(() => {});
      } else {
        // 其他错误不清除 localStorage，只设置状态
        console.log("[authStore] 其他错误，仅设置 isLoggedIn=false");
        set({ isLoggedIn: false });
      }
    }
  },

  fetchStats: async () => {
    try {
      const stats = await userApi.getStats();
      set({ stats });
    } catch (error) {
      console.error("获取用户统计失败:", error);
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

export const hasPermission = (
  userType: string,
  requiredType: string[],
): boolean => {
  if (!requiredType || requiredType.length === 0) return false;

  const typeHierarchy = ["free", "vip", "admin"];
  const userLevel = typeHierarchy.indexOf(userType);
  const levels = requiredType.map((t) => typeHierarchy.indexOf(t));
  const requiredLevel = Math.min(...levels);

  return userLevel >= requiredLevel;
};

export const isVipOrAbove = (user: User | null): boolean => {
  if (!user) return false;
  return hasPermission(user.userType, ["vip", "admin"]);
};

export const isAdmin = (user: User | null): boolean => {
  if (!user) return false;
  return user.userType === "admin";
};
