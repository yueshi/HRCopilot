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
   */
  protected register<T>(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T>
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

        // 包装为标准响应格式
        return this.wrapResponse(result);
      } catch (error) {
        logger.error(`\${channel} 处理失败`, error);
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
   * TODO: 后续实现基于 session 的用户管理
   */
  protected getCurrentUserId(event: IpcMainInvokeEvent): number {
    // 暂时返回默认用户 ID
    return 1;
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
