import { invokeIPC } from './ipcApi';
import { IPC_CHANNELS } from '@/shared/types';

/**
 * AI HR 助手相关类型定义
 */

export interface ConversationMessage {
  id: number;
  resume_id: number;
  user_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_type: 'chat' | 'suggestion' | 'analysis';
  metadata: any;
  token_count: number;
  is_summary: boolean;
  created_at: string;
}

export interface ConversationHistoryResponse {
  conversations: ConversationMessage[];
  count: number;
}

export interface SuggestionResponse {
  suggestions: string;
  type: 'question' | 'analysis' | 'evaluation';
}

/**
 * AI HR 助手 IPC 服务
 */
export class AIHRAssistantIpcService {
  /**
   * 发送消息（同步）
   */
  async sendMessage(request: {
    message: string;
    context?: string;
  }): Promise<any> {
    return invokeIPC(IPC_CHANNELS.AI_HR_ASSISTANT.SEND_MESSAGE, request);
  }

  /**
   * 流式发送消息
   * 注意：流式响应通过 IPC 事件监听器接收
   */
  async streamMessage(request: {
    resumeId: number;
    message: string;
    context?: string;
  }): Promise<any> {
    return invokeIPC(IPC_CHANNELS.AI_HR_ASSISTANT.STREAM_MESSAGE, request);
  }

  /**
   * 获取对话历史
   */
  async getHistory(request: {
    resumeId: number;
    limit?: number;
    offset?: number;
  }): Promise<ConversationHistoryResponse> {
    return invokeIPC(IPC_CHANNELS.AI_HR_ASSISTANT.GET_HISTORY, request);
  }

  /**
   * 清除对话历史
   */
  async clearHistory(request: {
    resumeId: number;
  }): Promise<{ message: string; deletedCount: number }> {
    return invokeIPC(IPC_CHANNELS.AI_HR_ASSISTANT.CLEAR_HISTORY, request);
  }

  /**
   * 生成智能建议
   */
  async generateSuggestion(request: {
    resumeId: number;
    type?: 'question' | 'analysis' | 'evaluation';
  }): Promise<SuggestionResponse> {
    return invokeIPC(IPC_CHANNELS.AI_HR_ASSISTANT.GENERATE_SUGGESTION, request);
  }
}

// 导出单例
export const aiHrAssistantApi = new AIHRAssistantIpcService();
