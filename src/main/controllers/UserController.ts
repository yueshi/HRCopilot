import { Context } from 'koa';
import { DatabaseService } from '../database/sqlite';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'resumer-helper-secret-key-2024';

/**
 * 用户控制器
 * 处理用户认证和用户管理
 */
export class UserController {
  private database: DatabaseService;

  constructor() {
    this.database = new DatabaseService();
  }

  /**
   * 用户注册
   */
  async register(ctx: Context) {
    try {
      const { email, password, name } = ctx.request.body as any;

      // 验证输入
      if (!email || !password) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: '邮箱和密码不能为空'
        };
        return;
      }

      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: '邮箱格式不正确'
        };
        return;
      }

      // 验证密码长度
      if (password.length < 6) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: '密码长度不能少于6位'
        };
        return;
      }

      await this.database.init();

      // 检查邮箱是否已存在
      const existingUser = await this.database.getUserByEmail(email);
      if (existingUser) {
        ctx.status = 409;
        ctx.body = {
          success: false,
          error: '邮箱已被注册'
        };
        return;
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      const userId = await this.database.createUser({
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        userType: 'free'
      });

      // 生成JWT
      const token = jwt.sign(
        { id: userId, email },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      ctx.body = {
        success: true,
        data: {
          token,
          user: {
            id: userId,
            email,
            name: name || email.split('@')[0],
            userType: 'free'
          }
        }
      };
    } catch (error) {
      logger.error('用户注册失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '用户注册失败'
      };
    } finally {
      await this.database.close();
    }
  }

  /**
   * 用户登录
   */
  async login(ctx: Context) {
    try {
      const { email, password } = ctx.request.body as any;

      // 验证输入
      if (!email || !password) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: '邮箱和密码不能为空'
        };
        return;
      }

      await this.database.init();

      // 查找用户
      const user = await this.database.getUserByEmail(email);
      if (!user) {
        ctx.status = 401;
        ctx.body = {
          success: false,
          error: '邮箱或密码错误'
        };
        return;
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        ctx.status = 401;
        ctx.body = {
          success: false,
          error: '邮箱或密码错误'
        };
        return;
      }

      // 生成JWT
      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      ctx.body = {
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            userType: user.userType
          }
        }
      };
    } catch (error) {
      logger.error('用户登录失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '用户登录失败'
      };
    } finally {
      await this.database.close();
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(ctx: Context) {
    try {
      const userId = ctx.state.user?.id;

      if (!userId) {
        ctx.status = 401;
        ctx.body = {
          success: false,
          error: '未授权'
        };
        return;
      }

      await this.database.init();

      const user = await this.database.getUserById(userId);
      if (!user) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: '用户不存在'
        };
        return;
      }

      ctx.body = {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: user.userType,
          createdAt: user.createdAt
        }
      };
    } catch (error) {
      logger.error('获取用户信息失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '获取用户信息失败'
      };
    } finally {
      await this.database.close();
    }
  }

  /**
   * 更新用户信息
   */
  async updateProfile(ctx: Context) {
    try {
      const userId = ctx.state.user?.id;
      const { name } = ctx.request.body as any;

      if (!userId) {
        ctx.status = 401;
        ctx.body = {
          success: false,
          error: '未授权'
        };
        return;
      }

      await this.database.init();

      await this.database.updateUser(userId, { name });

      const user = await this.database.getUserById(userId);

      ctx.body = {
        success: true,
        data: {
          id: user?.id,
          email: user?.email,
          name: user?.name,
          userType: user?.userType
        }
      };
    } catch (error) {
      logger.error('更新用户信息失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '更新用户信息失败'
      };
    } finally {
      await this.database.close();
    }
  }

  /**
   * 修改密码
   */
  async changePassword(ctx: Context) {
    try {
      const userId = ctx.state.user?.id;
      const { oldPassword, newPassword } = ctx.request.body as any;

      if (!userId) {
        ctx.status = 401;
        ctx.body = {
          success: false,
          error: '未授权'
        };
        return;
      }

      if (!oldPassword || !newPassword) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: '旧密码和新密码不能为空'
        };
        return;
      }

      if (newPassword.length < 6) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: '新密码长度不能少于6位'
        };
        return;
      }

      await this.database.init();

      const user = await this.database.getUserById(userId);
      if (!user) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: '用户不存在'
        };
        return;
      }

      // 验证旧密码
      const isValidPassword = await bcrypt.compare(oldPassword, user.password);
      if (!isValidPassword) {
        ctx.status = 401;
        ctx.body = {
          success: false,
          error: '旧密码错误'
        };
        return;
      }

      // 加密新密码
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 更新密码
      await this.database.updateUser(userId, { password: hashedPassword });

      ctx.body = {
        success: true,
        data: {
          message: '密码修改成功'
        }
      };
    } catch (error) {
      logger.error('修改密码失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '修改密码失败'
      };
    } finally {
      await this.database.close();
    }
  }

  /**
   * 获取用户统计信息
   */
  async getStats(ctx: Context) {
    try {
      const userId = ctx.state.user?.id;

      if (!userId) {
        ctx.status = 401;
        ctx.body = {
          success: false,
          error: '未授权'
        };
        return;
      }

      await this.database.init();

      const stats = await this.database.getUserStats(userId);

      ctx.body = {
        success: true,
        data: stats
      };
    } catch (error) {
      logger.error('获取用户统计失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '获取用户统计失败'
      };
    } finally {
      await this.database.close();
    }
  }
}

// 导出单例实例
export const userController = new UserController();
