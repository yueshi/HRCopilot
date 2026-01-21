import { IpcMainInvokeEvent } from 'electron';
import { BaseHandler } from './base';
import { IPC_CHANNELS, ErrorCode } from '../../shared/types';
import { DeduplicationService } from '../services/deduplicationService';
import { logger } from '../utils/logger';

export class DeduplicationHandler extends BaseHandler {
  constructor() {
    super();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register(IPC_CHANNELS.DEDEUPE.DETECT, this.detectDuplicates.bind(this));
  }

  /**
   * 检测重复简历
   */
  private async detectDuplicates(
    event: IpcMainInvokeEvent,
    request: {
      contentHash: string;
      personHash?: string;
      filename: string;
    }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 检测重复简历: ${request.filename}`);

    try {
      const result = await DeduplicationService.detectDuplicates(userId, request);

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('检测重复简历失败:', error);
      return {
        success: false,
        error: `检测重复简历失败: ${(error as Error).message}`,
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }
}
