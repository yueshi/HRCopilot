/**
 * 云端认证服务
 * 负责与云端 API 的用户认证和用户数据同步
 */

import axios, { type AxiosInstance } from "axios";
import { logger } from "../utils/logger";
import { encrypt, decrypt } from "../utils/encryption";

// 云端用户信息类型
export interface CloudUserInfo {
  id: number;
  username: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
}

// 云端登录响应
export interface CloudLoginResponse {
  user: CloudUserInfo;
  token: string;
}

// 云端认证配置
export interface CloudAuthConfig {
  apiUrl: string;
  enabled: boolean;
}

// 云端 API 响应结构
export interface CloudApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export class CloudAuthService {
  private static instance: CloudAuthService;
  private db: typeof import("../database/sqlite").database;
  private apiClient: AxiosInstance;
  private config: CloudAuthConfig;

  private constructor() {
    this.db = require("../database/sqlite").database;
    this.config = this.loadConfig();

    // 创建 axios 实例
    this.apiClient = axios.create({
      baseURL: this.config.apiUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    logger.info("云端认证服务初始化完成");
  }

  public static getInstance(): CloudAuthService {
    if (!CloudAuthService.instance) {
      CloudAuthService.instance = new CloudAuthService();
    }
    return CloudAuthService.instance;
  }

  /**
   * 从数据库加载云端认证配置
   */
  private loadConfig(): CloudAuthConfig {
    try {
      const db = this.db.getDatabase();
      const settings = db
        .prepare("SELECT * FROM settings WHERE key LIKE 'cloud_%'")
        .all() as {
        key: string;
        value: string;
      }[];

      const configMap = new Map(
        settings.map((s) => [s.key, JSON.parse(s.value)]),
      );

      return {
        apiUrl: configMap.get("cloud_api_url")?.value || "https://api.example.com",
        enabled: configMap.get("cloud_auth_enabled")?.value ?? false,
      };
    } catch (error) {
      logger.warn("加载云端认证配置失败，使用默认配置:", error);
      return {
        apiUrl: "https://api.example.com",
        enabled: false,
      };
    }
  }

  /**
   * 重新加载配置
   */
  public reloadConfig(): void {
    this.config = this.loadConfig();
    this.apiClient.defaults.baseURL = this.config.apiUrl;
    logger.info("云端认证配置已重新加载");
  }

  /**
   * 云端登录
   */
  public async login(
    username: string,
    password: string,
  ): Promise<CloudLoginResponse> {
    if (!this.config.enabled) {
      throw new Error("云端登录未启用");
    }

    try {
      const response = await this.apiClient.post<CloudApiResponse<CloudLoginResponse>>(
        "/api/auth/login",
        {
          username,
          password,
        },
      );

      const apiResponse = response.data;

      if (!apiResponse.success || !apiResponse.data) {
        throw new Error(apiResponse.message || "云端认证失败");
      }

      const loginResponse = apiResponse.data;

      // 同步用户数据到本地数据库
      const localUserId = await this.syncUser(loginResponse.user, loginResponse.token);

      logger.info(
        `云端登录成功: ${username}, 本地用户 ID: ${localUserId}`,
      );

      return loginResponse;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.message ||
          error.message ||
          "云端认证失败";
        logger.error(`云端认证失败: ${message}`, error);
        throw new Error(message);
      }
      throw error;
    }
  }

  /**
   * 同步用户数据到本地数据库
   */
  public async syncUser(
    cloudUser: CloudUserInfo,
    token?: string,
  ): Promise<number> {
    try {
      const db = this.db.getDatabase();

      // 检查用户是否已存在（通过 email 或 cloud_user_id）
      let user = db
        .prepare(
          "SELECT * FROM users WHERE email = ? OR cloud_user_id = ?",
        )
        .get(cloudUser.email || cloudUser.username, cloudUser.id) as {
        id: number;
        email: string;
        name: string;
        user_type: string;
        cloud_user_id: number | null;
        cloud_username: string | null;
      } | null;

      if (user) {
        // 更新现有用户
        const updates: string[] = ["updated_at = CURRENT_TIMESTAMP"];
        const params: (string | number)[] = [];

        if (user.name !== cloudUser.name) {
          updates.push("name = ?");
          params.push(cloudUser.name);
        }

        if (cloudUser.email && user.email !== cloudUser.email) {
          updates.push("email = ?");
          params.push(cloudUser.email);
        }

        if (user.cloud_user_id !== cloudUser.id) {
          updates.push("cloud_user_id = ?");
          params.push(cloudUser.id);
        }

        if (cloudUser.username && user.cloud_username !== cloudUser.username) {
          updates.push("cloud_username = ?");
          params.push(cloudUser.username);
        }

        if (token) {
          // 加密并存储 Token
          const encryptedToken = encrypt(token);
          const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30天

          updates.push("cloud_token = ?", "cloud_token_expires_at = ?");
          params.push(encryptedToken, expiresAt);
        }

        if (updates.length > 1) {
          // 除了 updated_at 还有其他字段需要更新
          const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
          params.push(user.id);
          db.prepare(sql).run(...params);
          logger.info(`更新用户: ${user.id}`);
        }

        return user.id;
      } else {
        // 创建新用户
        const encryptedToken = token ? encrypt(token) : null;
        const expiresAt = token ? Date.now() + 30 * 24 * 60 * 60 * 1000 : null; // 30天

        const result = db
          .prepare(
            `INSERT INTO users (email, name, user_type, cloud_user_id, cloud_username, cloud_token, cloud_token_expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            cloudUser.email || cloudUser.username,
            cloudUser.name,
            "free",
            cloudUser.id,
            cloudUser.username,
            encryptedToken,
            expiresAt,
          );

        logger.info(`创建新用户: ${result.lastInsertRowid}`);
        return result.lastInsertRowid as number;
      }
    } catch (error) {
      logger.error("同步用户数据失败:", error);
      throw error;
    }
  }

  /**
   * 获取用户的云端 Token
   */
  public async getCloudToken(userId: number): Promise<string | null> {
    try {
      const db = this.db.getDatabase();
      const user = db
        .prepare(
("SELECT cloud_token, cloud_token_expires_at FROM users WHERE id = ?")
        )
        .get(userId) as {
        cloud_token: string | null;
        cloud_token_expires_at: number | null;
      } | null;

      if (!user?.cloud_token) {
        return null;
      }

      // 检查 Token 是否过期
      if (
        user.cloud_token_expires_at &&
        user.cloud_token_expires_at < Date.now()
      ) {
        logger.info(`用户 ${userId} 的云端 Token 已过期`);
        return null;
      }

      return decrypt(user.cloud_token);
    } catch (error) {
      logger.error(`获取用户 ${userId} 的云端 Token 失败:`, error);
      return null;
    }
  }

  /**
   * 验证 Token 有效性
   */
  public async validateToken(token: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const response = await this.apiClient.post<CloudApiResponse<{ valid: boolean }>>(
        "/api/auth/validate",
        null,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return response.data.success && response.data.data?.valid === true;
    } catch (error) {
      logger.error("验证云端 Token 失败:", error);
      return false;
    }
  }

  /**
   * 获取用户信息
   */
  public async getUserInfo(token: string): Promise<CloudUserInfo | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const response = await this.apiClient.get<CloudApiResponse<CloudUserInfo>>(
        "/api/user/info",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      logger.error("获取用户信息失败:", error);
      return null;
    }
  }

  /**
   * 云端登出
   */
  public async logout(userId: number): Promise<void> {
    try {
      const db = this.db.getDatabase();

      // 清除用户的云端 Token
      db.prepare(
        `UPDATE users
         SET cloud_token = NULL, cloud_token_expires_at = NULL
         WHERE id = ?`,
      ).run(userId);

      logger.info(`用户 ${userId} 云端登出成功`);
    } catch (error) {
      logger.error(`用户 ${userId} 云端登出失败:`, error);
      throw error;
    }
  }

  /**
   * 获取云端认证配置
   */
  public getConfig(): CloudAuthConfig {
    return { ...this.config };
  }

  /**
   * 检查云端认证是否可用
   */
  public isAvailable(): boolean {
    return this.config.enabled && !!this.config.apiUrl;
  }
}

// 导出单例
export const cloudAuthService = CloudAuthService.getInstance();
