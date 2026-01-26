import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { logger } from '../utils/logger';
import type { ApiResponse } from '../../shared/types';
import { ErrorCode } from '../../shared/types';

/**
 * Handler 基类
 * 提供统一的错误处理和响应格式化
 */
export abstract class BaseHandler {
  /**
   * 注册 IPC 处理器
   * @param channel IPC 通道名称
   * @param handler 处理函数
   * @param skipWrapResponse 是否跳过响应包装（用于存储等直接返回值的处理器）
   */
  protected register<T>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>,
    skipWrapResponse = false
  ): void {
    // 先移除已存在的处理器，避免重复注册错误
    try {
      ipcMain.removeHandler(channel);
    } catch (error) {
      // 忽略移除不存在的监听器的错误
    }

    ipcMain.handle(channel, async (event, ...args) => {
      try {
        const result = await handler(event, ...args);

        // 如果 skipWrapResponse 为 true，直接返回原始结果
        if (skipWrapResponse) {
          return result;
        }

        // 包装为标准响应格式
        return this.wrapResponse(result);
      } catch (error) {
        const errorMessage = error?.message || String(error);

        // "用户未登录" 是预期的业务逻辑，不视为错误
        if (errorMessage.includes('用户未登录')) {
          logger.info(`[${channel}] - 用户未登录`);
        } else {
          logger.error(`[${channel}] 处理失败`, error);
        }

        return this.createErrorResponse(error);
      }
    });
  }

  /**
   * 包装响应为标准格式
   */
  private wrapResponse<T>(result: T | ApiResponse<T>): ApiResponse<T> {
    // 如果已经是 ApiResponse 格式，直接返回
    if (result && typeof result === 'object' && 'success' in result) {
      return result as ApiResponse<T>;
    }

    // 否则包装成功响应
    return {
      success: true,
      data: result as T,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 创建标准错误响应
   */
  private createErrorResponse(error: any): ApiResponse {
    const message = error?.message || '未知错误';
    const code = this.inferErrorCode(error, message);

    return {
      success: false,
      error: message,
      code,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 推断错误码
   */
  private inferErrorCode(error: any, message: string): ErrorCode | undefined {
    // 优先使用错误对象中的 code
    if (error?.code) {
      const errorStr = String(error.code);
      if (Object.values(ErrorCode).includes(errorStr as ErrorCode)) {
        return errorStr as ErrorCode;
      }
    }

    const lowerMessage = message.toLowerCase();

    // 根据错误消息推断
    if (lowerMessage.includes('user') && lowerMessage.includes('not found')) {
      return ErrorCode.USER_NOT_FOUND;
    }
    if (lowerMessage.includes('not found')) {
      return ErrorCode.RESUME_NOT_FOUND;
    }
    if (lowerMessage.includes('exists') || lowerMessage.includes('duplicate') || lowerMessage.includes('unique')) {
      return ErrorCode.USER_EXISTS;
    }
    if (lowerMessage.includes('password')) {
      return ErrorCode.PASSWORD_MISMATCH;
    }
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('auth')) {
      return ErrorCode.UNAUTHORIZED;
    }
    if (lowerMessage.includes('forbidden')) {
      return ErrorCode.FORBIDDEN;
    }
    if (lowerMessage.includes('file') && (lowerMessage.includes('not found') || lowerMessage.includes('not exist'))) {
      return ErrorCode.FILE_NOT_FOUND;
    }
    if (lowerMessage.includes('file') && lowerMessage.includes('too large')) {
      return ErrorCode.FILE_TOO_LARGE;
    }
    if (lowerMessage.includes('file') && lowerMessage.includes('type')) {
      return ErrorCode.INVALID_FILE_TYPE;
    }
    if (lowerMessage.includes('database') || lowerMessage.includes('sql')) {
      return ErrorCode.DATABASE_ERROR;
    }
    if (lowerMessage.includes('ai') || lowerMessage.includes('glm')) {
      return ErrorCode.AI_SERVICE_ERROR;
    }

    return undefined;
  }

  /**
   * 获取当前用户 ID
   * 基于 SessionManager 获取已登录用户的 ID
   * @returns 当前用户 ID，如果未登录则抛出未授权错误
   */
  protected getCurrentUserId(event: IpcMainInvokeEvent): number {
    // 动态导入以避免循环依赖
    const { sessionManager } = require('../managers/sessionManager');
    const userId = sessionManager.getCurrentUserId();

    if (userId === null) {
      throw new Error('用户未登录，请先登录');
    }

    return userId;
  }

  /**
   * 验证文件路径
   */
  protected async validateFile(filePath: string): Promise<{ valid: boolean; error?: string }> {
    const fs = await import('fs/promises');
    try {
      await fs.access(filePath);
      return { valid: true };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { valid: false, error: '文件不存在' };
      }
      return { valid: false, error: '无法访问文件' };
    }
  }
}
