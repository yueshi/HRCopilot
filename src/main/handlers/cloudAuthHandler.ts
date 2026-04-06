import { IpcMainInvokeEvent } from "electron";
import { BaseHandler } from "./base";
import { ErrorCode } from "../../shared/types";
import { sessionManager } from "../managers/sessionManager";
import { cloudAuthService } from "../services/cloudAuthService";
import { database } from "../database/sqlite";
import type {
  ApiResponse,
} from "../../shared/types";
import { logger } from "../utils/logger";

export class CloudAuthHandler extends BaseHandler {
  constructor() {
    super();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register("cloud-auth:login", this.handleLogin.bind(this));
    this.register("cloud-auth:get-token", this.getToken.bind(this));
    this.register("cloud-auth:validate-token", this.validateToken.bind(this));
    this.register("cloud-auth:get-user-info", this.getUserInfo.bind(this));
    this.register("cloud-auth:logout", this.logout.bind(this));
    this.register("cloud-auth:get-config", this.getConfig.bind(this));
    this.register("cloud-auth:is-available", this.isAvailable.bind(this));
    this.register("setting:save-cloud-config", this.saveConfig.bind(this));
    this.register("cloud-auth:reload-config", this.reloadConfig.bind(this));
  }

  /**
   * 云端登录
   */
  private async handleLogin(
    event: IpcMainInvokeEvent,
    request: { username: string; password: string },
  ): Promise<ApiResponse<any>> {
    logger.info(`云端登录: ${request.username}`);

    try {
      // 用户名/密码验证
      if (!request.username || request.username.length === 0) {
        return {
          success: false,
          error: "用户名不能为空",
          code: ErrorCode.INVALID_PARAMS,
        };
      }

      if (!request.password || request.password.length === 0) {
        return {
          success: false,
          error: "密码不能为空",
          code: ErrorCode.INVALID_PARAMS,
        };
      }

      // 调用云端认证服务
      const loginResponse = await cloudAuthService.login(
        request.username,
        request.password,
      );

      // 获取本地用户 ID（通过 email 或 username）
      const user = await database.getUserByEmail(
        loginResponse.user.email || loginResponse.user.username,
      );
      if (!user) {
        return {
          success: false,
          error: "用户同步失败",
          code: ErrorCode.DATABASE_ERROR,
        };
      }

      // 设置 SessionManager
      sessionManager.setCurrentUser({
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.user_type,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      });

      // 发送登录成功事件
      event.sender.send("user:login-success", {
        userId: user.id,
        email: user.email,
        name: user.name,
        userType: user.user_type,
      });

      logger.info(`云端登录成功: ${user.id}`);
      return {
        success: true,
        data: {
          user: loginResponse.user,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("云端登录失败:", error);
      return {
        success: false,
        error: (error as Error).message || "云端登录失败",
        code: ErrorCode.UNAUTHORIZED,
      };
    }
  }

  /**
   * 获取云端 Token
   */
  private async getToken(
    event: IpcMainInvokeEvent,
  ): Promise<ApiResponse<string | null>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`获取云端 Token: ${userId}`);

    try {
      const token = await cloudAuthService.getCloudToken(userId);
      return {
        success: true,
        data: token,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("获取云端 Token 失败:", error);
      return {
        success: false,
        error: "获取云端 Token 失败",
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * 验证云端 Token
   */
  private async validateToken(
    event: IpcMainInvokeEvent,
    token: string,
  ): Promise<ApiResponse<boolean>> {
    logger.info("验证云端 Token");

    try {
      const isValid = await cloudAuthService.validateToken(token);
      return {
        success: true,
        data: isValid,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("验证云端 Token 失败:", error);
      return {
        success: true,
        data: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 获取用户信息
   */
  private async getUserInfo(
    event: IpcMainInvokeEvent,
  ): Promise<ApiResponse<any | null>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`获取用户信息: ${userId}`);

    try {
      const token = await cloudAuthService.getCloudToken(userId);
      if (!token) {
        return {
          success: false,
          error: "未获取到云端 Token",
          code: ErrorCode.UNAUTHORIZED,
        };
      }

      const userInfo = await cloudAuthService.getUserInfo(token);
      return {
        success: true,
        data: userInfo,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("获取用户信息失败:", error);
      return {
        success: false,
        error: "获取用户信息失败",
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * 云端登出
   */
  private async logout(
    event: IpcMainInvokeEvent,
  ): Promise<ApiResponse<void>> {
    try {
      const userId = this.getCurrentUserId(event);
      logger.info(`云端登出: ${userId}`);

      // 清除云端 Token
      await cloudAuthService.logout(userId);

      // 清除 SessionManager
      sessionManager.clearCurrentUser();

      // 发送登出成功事件
      event.sender.send("user:logout-success");

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("云端登出失败:", error);
      return {
        success: false,
        error: "云端登出失败",
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * 获取云端认证配置
   */
  private async getConfig(
    event: IpcMainInvokeEvent,
  ): Promise<ApiResponse<any>> {
    logger.info("获取云端认证配置");

    try {
      const config = cloudAuthService.getConfig();
      return {
        success: true,
        data: config,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("获取云端认证配置失败:", error);
      return {
        success: false,
        error: "获取云端认证配置失败",
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * 检查云端认证是否可用
   */
  private async isAvailable(
    event: IpcMainInvokeEvent,
  ): Promise<ApiResponse<boolean>> {
    const available = cloudAuthService.isAvailable();
    return {
      success: true,
      data: available,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 保存云端认证配置
   */
  private async saveConfig(
    event: IpcMainInvokeEvent,
    config: {
      apiUrl: string;
      enabled: boolean;
    },
  ): Promise<ApiResponse<void>> {
    logger.info("保存云端认证配置");

    try {
      const db = database.getDatabase();
      const now = Date.now();

      // 保存各项配置到 settings 表
      const settings = [
        ["cloud_api_url", config.apiUrl],
        ["cloud_auth_enabled", config.enabled],
      ];

      for (const [key, value] of settings) {
        db.prepare(
          `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
        ).run(key, JSON.stringify({ value }), now, JSON.stringify({ value }), now);
      }

      logger.info("云端认证配置保存成功");
      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("保存云端认证配置失败:", error);
      return {
        success: false,
        error: "保存云端认证配置失败",
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * 重新加载云端认证配置
   */
  private async reloadConfig(
    event: IpcMainInvokeEvent,
  ): Promise<ApiResponse<void>> {
    logger.info("重新加载云端认证配置");

    try {
      cloudAuthService.reloadConfig();
      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error("重新加载云端认证配置失败:", error);
      return {
        success: false,
        error: "重新加载云端认证配置失败",
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }
}
