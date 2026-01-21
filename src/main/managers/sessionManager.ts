import type { UserData } from '../../shared/types';
import { logger } from '../utils/logger';

/**
 * 用户会话信息
 */
interface UserSession {
  user: UserData;
  userId: number;
  loginTime: Date;
}

/**
 * 会话管理器（单例）
 * 管理用户登录状态和会话信息
 */
class SessionManager {
  private static instance: SessionManager | null = null;
  private currentUser: UserSession | null = null;

  private constructor() {
    this.loadSessionFromStorage();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * 设置当前用户（登录时调用）
   */
  setCurrentUser(user: UserData): void {
    this.currentUser = {
      user,
      userId: user.id,
      loginTime: new Date(),
    };

    // 保存到本地存储
    this.saveSessionToStorage();

    logger.info(`用户已登录: userId=${user.id}, email=${user.email}`);
  }

  /**
   * 获取当前用户 ID
   */
  getCurrentUserId(): number | null {
    return this.currentUser?.userId ?? null;
  }

  /**
   * 获取当前用户信息
   */
  getCurrentUser(): UserData | null {
    return this.currentUser?.user ?? null;
  }

  /**
   * 检查用户是否已登录
   */
  isLoggedIn(): boolean {
    return this.currentUser !== null;
  }

  /**
   * 清除当前用户（登出时调用）
   */
  clearCurrentUser(): void {
    if (this.currentUser) {
      logger.info(`用户已登出: userId=${this.currentUser.userId}`);
    }
    this.currentUser = null;

    // 清除本地存储
    this.clearSessionFromStorage();
  }

  /**
   * 保存会话到本地存储
   */
  private saveSessionToStorage(): void {
    if (this.currentUser) {
      try {
        const sessionData = JSON.stringify({
          userId: this.currentUser.userId,
          user: this.currentUser.user,
          loginTime: this.currentUser.loginTime.toISOString(),
        });

        // 使用 Electron 的 localStorage API
        // 这里可以通过主进程存储到文件或使用其他持久化方式
        // 简化实现：仅保存在内存中
      } catch (error) {
        logger.error('保存会话失败:', error);
      }
    }
  }

  /**
   * 从本地存储加载会话
   */
  private loadSessionFromStorage(): void {
    try {
      // 简化实现：从内存中恢复
      // 实际应用中可以从文件或 Electron store 加载
    } catch (error) {
      logger.error('加载会话失败:', error);
    }
  }

  /**
   * 清除本地存储的会话
   */
  private clearSessionFromStorage(): void {
    try {
      // 清除本地存储
    } catch (error) {
      logger.error('清除会话失败:', error);
    }
  }
}

// 导出单例
export const sessionManager = SessionManager.getInstance();
