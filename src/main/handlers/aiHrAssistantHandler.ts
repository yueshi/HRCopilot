import { ipcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import { BaseHandler } from './base';
import { IPC_CHANNELS } from '../../shared/types';
import { logger } from '../utils/logger';
import { aiAnalysisService } from '../services/aiAnalysis';
import { database } from '../database/sqlite';

export class AIHRAssistantHandler extends BaseHandler {
  constructor() {
    super();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register(IPC_CHANNELS.AI_HR_ASSISTANT.SEND_MESSAGE, this.sendMessage.bind(this));
    this.register(IPC_CHANNELS.AI_HR_ASSISTANT.STREAM_MESSAGE, this.streamMessage.bind(this));
    this.register(IPC_CHANNELS.AI_HR_ASSISTANT.GET_HISTORY, this.getHistory.bind(this));
    this.register(IPC_CHANNELS.AI_HR_ASSISTANT.CLEAR_HISTORY, this.clearHistory.bind(this));
    this.register(IPC_CHANNELS.AI_HR_ASSISTANT.GENERATE_SUGGESTION, this.generateSuggestion.bind(this));
  }

  /**
   * 发送消息（同步）
   */
  private async sendMessage(
    event: IpcMainInvokeEvent,
    request: any
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 发送 AI HR 助手消息`);

    try {
      const response = await aiAnalysisService.analyzeHRQuery(request);
      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('发送 AI HR 助手消息失败:', error);
      return {
        success: false,
        error: error.message || '发送消息失败',
      };
    }
  }

  /**
   * 流式发送消息
   */
  private async streamMessage(
    event: IpcMainInvokeEvent,
    request: {
      resumeId: number;
      message: string;
      context?: string;
    }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 流式发送 AI HR 助手消息`);

    try {
      const webContents = event.sender;

      // 发送开始事件
      webContents.send('ai-hr-assistant:stream-start', {
        resumeId: request.resumeId,
      });

      let fullResponse = '';

      // 流式调用
      await aiAnalysisService.streamHRAssistantQuery({
        resumeId: request.resumeId,
        userId,
        message: request.message,
        context: request.context,
        onChunk: (chunk: string) => {
          // 发送每个数据块到渲染进程
          webContents.send('ai-hr-assistant:stream-chunk', {
            resumeId: request.resumeId,
        chunk,
          });
          fullResponse += chunk;
        },
      });

      // 发送完成事件
      webContents.send('ai-hr-assistant:stream-end', {
        resumeId: request.resumeId,
        response: fullResponse,
      });

      return {
        success: true,
        data: { response: fullResponse },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('流式发送消息失败:', error);

      // 发送错误事件
      event.sender.send('ai-hr-assistant:stream-error', {
        resumeId: request.resumeId,
        error: error.message || '流式发送消息失败',
      });

      return {
        success: false,
        error: error.message || '流式发送消息失败',
      };
    }
  }

  /**
   * 获取对话历史
   */
  private async getHistory(
    event: IpcMainInvokeEvent,
    request: {
      resumeId: number;
      limit?: number;
      offset?: number;
    }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 获取 AI HR 助手历史记录`);

    try {
      const conversations = await database.getConversations({
        resumeId: request.resumeId,
        userId,
        limit: request.limit || 50,
        offset: request.offset || 0,
      });

      return {
        success: true,
        data: {
          conversations,
          count: await database.getConversationCount({
            resumeId: request.resumeId,
            userId,
          }),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('获取历史记录失败:', error);
      return {
        success: false,
        error: error.message || '获取历史记录失败',
      };
    }
  }

  /**
   * 清除对话历史
   */
  private async clearHistory(
    event: IpcMainInvokeEvent,
    request: {
      resumeId: number;
    }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 清除 AI HR 助手历史记录`);

    try {
      const deletedCount = await database.clearConversations({
        resumeId: request.resumeId,
        userId,
      });

      return {
        success: true,
        data: {
          message: '历史记录已清除',
          deletedCount,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('清除历史记录失败:', error);
      return {
        success: false,
        error: error.message || '清除历史记录失败',
      };
    }
  }

  /**
   * 生成智能建议
   */
  private async generateSuggestion(
    event: IpcMainInvokeEvent,
    request: {
      resumeId: number;
      type?: 'question' | 'analysis' | 'evaluation';
    }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 生成 AI HR 助手建议`);

    try {
      const suggestions = await aiAnalysisService.generateHRAssistantSuggestion({
        resumeId: request.resumeId,
        userId,
        type: request.type,
      });

      return {
        success: true,
        data: {
          suggestions,
          type: request.type || 'evaluation',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('生成建议失败:', error);
      return {
        success: false,
        error: error.message || '生成建议失败',
      };
    }
  }
}
