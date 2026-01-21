import { invokeIPC } from './ipcApi';
import { IPC_CHANNELS } from '@/shared/types';

/**
 * 去重检测响应
 */
export interface DetectDuplicateResult {
  exactDuplicate: boolean;
  samePersonResumes?: any[];
  suggestedGroupId?: number;
}

/**
 * 去重 IPC 服务
 */
export class DeduplicationIpcService {
  /**
   * 检测重复简历
   */
  async detectDuplicates(params: {
    contentHash: string;
    personHash?: string;
    filename: string;
  }): Promise<{ success: boolean; data: DetectDuplicateResult; timestamp?: string; error?: string }> {
    return invokeIPC(IPC_CHANNELS.DEDEUPE.DETECT, params);
  }
}

export const dedupeApi = new DeduplicationIpcService();
