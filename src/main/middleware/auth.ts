import { Context, Middleware } from 'koa';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'resumer-helper-secret-key-2024';

/**
 * JWT 用户信息接口
 */
export interface JwtUser {
  id: number;
  email: string;
}

/**
 * 扩展 Koa Context 类型
 */
declare module 'koa' {
  interface BaseState {
    user?: JwtUser;
  }
}

/**
 * 验证 JWT Token 中间件
 */
export const auth: Middleware = async (ctx: Context, next: () => Promise<any>) => {
  try {
    // 获取 Authorization header
    const authHeader = ctx.headers.authorization;

    if (!authHeader) {
      ctx.status = 401;
      ctx.body = {
        success: false,
        error: '未提供认证令牌'
      };
      return;
    }

    // 提取 Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      ctx.status = 401;
      ctx.body = {
        success: false,
        error: '认证令牌格式错误'
      };
      return;
    }

    const token = parts[1];

    // 验证 token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtUser;

    // 将用户信息存入 context.state
    ctx.state.user = decoded;

    await next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      ctx.status = 401;
      ctx.body = {
        success: false,
        error: '无效的认证令牌'
      };
      return;
    }

    if (error.name === 'TokenExpiredError') {
      ctx.status = 401;
      ctx.body = {
        success: false,
        error: '认证令牌已过期'
      };
      return;
    }

    logger.error('认证中间件错误:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: '认证验证失败'
    };
  }
};

/**
 * 可选认证中间件
 * 如果提供了 token 则验证，没有提供则跳过
 */
export const optionalAuth: Middleware = async (ctx: Context, next: () => Promise<any>) => {
  try {
    const authHeader = ctx.headers.authorization;

    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        const token = parts[1];
        const decoded = jwt.verify(token, JWT_SECRET) as JwtUser;
        ctx.state.user = decoded;
      }
    }

    await next();
  } catch (error) {
    // 可选认证失败不阻止请求
    logger.warn('可选认证失败，继续处理请求:', error);
    await next();
  }
};

/**
 * 检查用户类型中间件
 */
export const checkUserType = (allowedTypes: string[]): Middleware => {
  return async (ctx: Context, next: () => Promise<any>) => {
    const userType = ctx.state.user?.userType;

    if (!userType) {
      ctx.status = 401;
      ctx.body = {
        success: false,
        error: '未授权'
      };
      return;
    }

    if (!allowedTypes.includes(userType)) {
      ctx.status = 403;
      ctx.body = {
        success: false,
        error: '权限不足'
      };
      return;
    }

    await next();
  };
};

/**
 * 仅管理员可访问
 */
export const adminOnly = checkUserType(['admin']);

/**
 * VIP 和管理员可访问
 */
export const vipAndAbove = checkUserType(['vip', 'admin']);
