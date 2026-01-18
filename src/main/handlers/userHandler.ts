import { IpcMainInvokeEvent } from 'electron';
import { BaseHandler } from './base';
import { IPC_CHANNELS, ErrorCode } from '../../shared/types';
import type {
  UserRegisterRequest,
  UserRegisterResponse,
  UserLoginRequest,
  UserLoginResponse,
  UserData,
  UserUpdateProfileRequest,
  UserChangePasswordRequest,
  UserStatsData,
  ApiResponse,
} from '../../shared/types';
import { database } from '../database/sqlite';
import { hashPassword, comparePassword } from '../utils/crypto';
import { logger } from '../utils/logger';

export class UserHandler extends BaseHandler {
  constructor() {
    super();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register(IPC_CHANNELS.USER.REGISTER, this.handleRegister.bind(this));
    this.register(IPC_CHANNELS.USER.LOGIN, this.login.bind(this));
    this.register(IPC_CHANNELS.USER.GET_PROFILE, this.getProfile.bind(this));
    this.register(IPC_CHANNELS.USER.UPDATE_PROFILE, this.updateProfile.bind(this));
    this.register(IPC_CHANNELS.USER.CHANGE_PASSWORD, this.changePassword.bind(this));
    this.register(IPC_CHANNELS.USER.GET_STATS, this.getStats.bind(this));
    this.register(IPC_CHANNELS.USER.LOGOUT, this.logout.bind(this));
  }

  private async handleRegister(
    event: IpcMainInvokeEvent,
    request: UserRegisterRequest
  ): Promise<ApiResponse<UserRegisterResponse>> {
    logger.info(`用户注册: ${request.email}`);

    if (!this.isValidEmail(request.email)) {
      return {
        success: false,
        error: '邮箱格式不正确',
        code: ErrorCode.INVALID_PARAMS,
      };
    }

    if (!this.isStrongPassword(request.password)) {
      return {
        success: false,
        error: '密码强度不足，至少8位，包含字母和数字',
        code: ErrorCode.INVALID_PARAMS,
      };
    }

    try {
      const existing = await database.getUserByEmail(request.email);
      if (existing) {
        return {
          success: false,
          error: '邮箱已被注册',
          code: ErrorCode.USER_EXISTS,
        };
      }

      const userId = await database.createUser({
        email: request.email,
        password: await hashPassword(request.password),
        name: request.name,
        userType: 'free',
      });

      logger.info(`用户注册成功，ID: ${userId}`);
      return {
        success: true,
        data: {
          userId,
          email: request.email,
          name: request.name,
          userType: 'free',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('用户注册失败:', error);
      return {
        success: false,
        error: '注册失败，请重试',
        code: ErrorCode.DATABASE_ERROR,
      };
    }
  }

  private async login(
    event: IpcMainInvokeEvent,
    request: UserLoginRequest
  ): Promise<ApiResponse<UserLoginResponse>> {
    logger.info(`用户登录: ${request.email}`);

    try {
      // 检查数据库是否已初始化
      const db = database.getDatabase();
      logger.info('数据库已初始化');

      const user = await database.getUserByEmail(request.email);
      logger.info(`查询到用户: ${JSON.stringify(user)}`);

      if (!user) {
        return {
          success: false,
          error: '用户不存在',
          code: ErrorCode.USER_NOT_FOUND,
        };
      }

      const isValid = await comparePassword(request.password, user.password_hash);
      logger.info(`密码验证结果: ${isValid}`);

      if (!isValid) {
        return {
          success: false,
          error: '密码错误',
          code: ErrorCode.INVALID_CREDENTIALS,
        };
      }

      event.sender.send('user:login-success', {
        userId: user.id,
        email: user.email,
        name: user.name,
        userType: user.user_type,
      });

      logger.info(`用户登录成功: ${user.id}`);
      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            userType: user.user_type,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('用户登录失败:', error);
      return {
        success: false,
        error: `登录失败: ${(error as Error).message}`,
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }

  private async getProfile(
    event: IpcMainInvokeEvent
  ): Promise<ApiResponse<UserData>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`获取用户资料: ${userId}`);

    try {
      const user = await database.getUserById(userId);
      if (!user) {
        return {
          success: false,
          error: '用户不存在',
          code: ErrorCode.USER_NOT_FOUND,
        };
      }

      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: user.user_type,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('获取用户资料失败:', error);
      return {
        success: false,
        error: '获取用户资料失败',
        code: ErrorCode.DATABASE_ERROR,
      };
    }
  }

  private async updateProfile(
    event: IpcMainInvokeEvent,
    request: UserUpdateProfileRequest
  ): Promise<ApiResponse<UserData>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`更新用户资料: ${userId}`);

    try {
      if (request.email && !this.isValidEmail(request.email)) {
        return {
          success: false,
          error: '邮箱格式不正确',
          code: ErrorCode.INVALID_PARAMS,
        };
      }

      await database.updateUser(userId, request);
      const user = await database.getUserById(userId);

      return {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: user.user_type,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('更新用户资料失败:', error);
      return {
        success: false,
        error: '更新用户资料失败',
        code: ErrorCode.DATABASE_ERROR,
      };
    }
  }

  private async changePassword(
    event: IpcMainInvokeEvent,
    request: UserChangePasswordRequest
  ): Promise<ApiResponse<void>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`修改密码: ${userId}`);

    try {
      const user = await database.getUserById(userId);
      if (!user) {
        return {
          success: false,
          error: '用户不存在',
          code: ErrorCode.USER_NOT_FOUND,
        };
      }

      const isValid = await comparePassword(request.currentPassword, user.password_hash);
      if (!isValid) {
        return {
          success: false,
          error: '当前密码错误',
          code: ErrorCode.PASSWORD_MISMATCH,
        };
      }

      if (!this.isStrongPassword(request.newPassword)) {
        return {
          success: false,
          error: '新密码强度不足',
          code: ErrorCode.INVALID_PARAMS,
        };
      }

      await database.updateUser(userId, {
        password: await hashPassword(request.newPassword),
      });

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('修改密码失败:', error);
      return {
        success: false,
        error: '修改密码失败',
        code: ErrorCode.DATABASE_ERROR,
      };
    }
  }

  private async getStats(
    event: IpcMainInvokeEvent
  ): Promise<ApiResponse<UserStatsData>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`获取用户统计: ${userId}`);

    try {
      const stats = await database.getUserStats(userId);
      return {
        success: true,
        data: {
          totalResumes: stats.totalResumes,
          completedResumes: stats.completedResumes,
          processingResumes: stats.processingResumes,
          failedResumes: 0,
          totalAnalysisCount: stats.completedResumes,
          lastActiveAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('获取用户统计失败:', error);
      return {
        success: false,
        error: '获取用户统计失败',
        code: ErrorCode.DATABASE_ERROR,
      };
    }
  }

  private async logout(
    event: IpcMainInvokeEvent
  ): Promise<ApiResponse<void>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户登出: ${userId}`);
    event.sender.send('user:logout-success');
    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isStrongPassword(password: string): boolean {
    return password?.length >= 8 &&
      /[a-zA-Z]/.test(password) &&
      /[0-9]/.test(password);
  }
}
