import type { UserData } from '../../shared/types';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * 用户会话信息
 */
interface UserSession {
  user: UserData;
  userId: number;
  loginTime: Date;
}

/**
 * 会话数据结构（用于持久化存储）
 */
interface SessionData {
  userId: number;
  user: UserData;
  loginTime: string;
}

/**
 * 前端 storage.json 的结构
 */
interface UserStorageData {
  user: UserData;
  timestamp: number;
}

/**
 * storage.json 的完整结构
 */
interface StorageJson {
  'user-storage'?: string;
}

/**
 * 会话管理器（单例）
 * 管理用户登录状态和会话信息
 */
class SessionManager {
  private static instance: SessionManager | null = null;
  private currentUser: UserSession | null = null;
  private readonly SESSION_FILE_PATH: string;
  private readonly STORAGE_FILE_PATH: string;

  private constructor() {
    this.SESSION_FILE_PATH = path.join(app.getPath('userData'), 'session.json');
    this.STORAGE_FILE_PATH = path.join(app.getPath('userData'), 'storage.json');
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
   * 保存会话到本地存储（同步）
   */
  private saveSessionToStorage(): void {
    if (this.currentUser) {
      try {
        const sessionData: SessionData = {
          userId: this.currentUser.userId,
          user: this.currentUser.user,
          loginTime: this.currentUser.loginTime.toISOString(),
        };

        // 保存到 session.json
        this.ensureDirectoryExists(this.SESSION_FILE_PATH);
        fs.writeFileSync(this.SESSION_FILE_PATH, JSON.stringify(sessionData, null, 2), 'utf-8');
        logger.info(`会话已保存到: ${this.SESSION_FILE_PATH}`);
      } catch (error) {
        logger.error('保存会话失败:', error);
      }
    }
  }

  /**
   * 从本地存储加载会话（同步）
   */
  private loadSessionFromStorage(): void {
    try {
      // 优先从 storage.json 读取（与前端保持一致）
      if (fs.existsSync(this.STORAGE_FILE_PATH)) {
        const fileContent = fs.readFileSync(this.STORAGE_FILE_PATH, 'utf-8');
        const storageJson: StorageJson = JSON.parse(fileContent);

        if (storageJson['user-storage']) {
          const userStorageStr = storageJson['user-storage'];
          const userStorage: UserStorageData = JSON.parse(userStorageStr);

          // 恢复用户会话
          this.currentUser = {
            userId: userStorage.user.id,
            user: userStorage.user,
            loginTime: new Date(userStorage.timestamp),
          };

          logger.info(`会话已从 ${this.STORAGE_FILE_PATH} 恢复，用户ID: ${userStorage.user.id}, 邮箱: ${userStorage.user.email}`);
          return;
        }
      }

      // 如果 storage.json 没有，尝试从 session.json 读取（向后兼容）
      if (fs.existsSync(this.SESSION_FILE_PATH)) {
        const fileContent = fs.readFileSync(this.SESSION_FILE_PATH, 'utf-8');
        const sessionData = JSON.parse(fileContent) as SessionData;

        this.currentUser = {
          userId: sessionData.userId,
          user: sessionData.user,
          loginTime: new Date(sessionData.loginTime),
        };

        logger.info(`会话已从 ${this.SESSION_FILE_PATH} 恢复（向后兼容），用户ID: ${sessionData.userId}`);
      } else {
        logger.info('会话文件不存在，跳过加载');
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        logger.error('加载会话失败:', error);
      }
      // 文件不存在或读取失败是正常情况，不需要报错
    }
  }

  /**
   * 清除本地存储的会话（同步）
   */
  private clearSessionFromStorage(): void {
    try {
      // 清除 session.json
      if (fs.existsSync(this.SESSION_FILE_PATH)) {
        fs.unlinkSync(this.SESSION_FILE_PATH);
        logger.info(`会话文件已删除: ${this.SESSION_FILE_PATH}`);
      }

      // 清除 storage.json 中的 user-storage
      if (fs.existsSync(this.STORAGE_FILE_PATH)) {
        const fileContent = fs.readFileSync(this.STORAGE_FILE_PATH, 'utf-8');
        const storageJson: StorageJson = JSON.parse(fileContent);
        delete storageJson['user-storage'];
        fs.writeFileSync(this.STORAGE_FILE_PATH, JSON.stringify(storageJson, null, 2), 'utf-8');
        logger.info(`storage.json 中的 user-storage 已清除`);
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        logger.error('清除会话失败:', error);
      }
    }
  }

  /**
   * 确保目录存在
   */
  private ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// 导出单例
export const sessionManager = SessionManager.getInstance();
