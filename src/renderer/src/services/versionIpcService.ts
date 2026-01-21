import { invokeIPC } from './ipcApi';
import { IPC_CHANNELS } from '@/shared/types';

/**
 * 简历组接口
 */
export interface ResumeGroup {
  id: number;
  userId: number;
  groupName: string;
  primaryResumeId: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 简历变体接口
 */
export interface ResumeVariant {
  id: number;
  userId: number;
  originalFilename: string;
  originalPath: string;
  originalSize: number;
  originalMimetype: string;
  processedContent: string | null;
  jobDescription: string | null;
  status: string;
  groupId: number | null;
  isPrimary: boolean;
  versionLabel: string | null;
  versionNotes: string | null;
  parsedInfo: any;
  createdAt: string;
  updatedAt: string;
}

/**
 * 版本列表响应
 */
export interface VersionsResponse {
  group: ResumeGroup;
  resumes: ResumeVariant[];
}

/**
 * 简历版本管理 IPC 服务
 */
export class VersionIpcService {
  /**
   * 创建简历组
   */
  async createGroup(data: {
    groupName: string;
    primaryResumeId: number;
    description?: string;
  }): Promise<{ success: boolean; data: ResumeGroup; timestamp: string; error?: string }> {
    return invokeIPC(IPC_CHANNELS.VERSION.CREATE_GROUP, data);
  }

  /**
   * 添加简历变体到组
   */
  async addVariant(data: {
    groupId: number;
    resumeId: number;
    versionLabel: string;
    versionNotes: string;
  }): Promise<{ success: boolean; data: any; timestamp: string; error?: string }> {
    return invokeIPC(IPC_CHANNELS.VERSION.ADD_VARIANT, data);
  }

  /**
   * 设置主版本
   */
  async setPrimary(data: {
    groupId: number;
    resumeId: number;
  }): Promise<{ success: boolean; data: any; timestamp: string; error?: string }> {
    return invokeIPC(IPC_CHANNELS.VERSION.SET_PRIMARY, data);
  }

  /**
   * 获取版本列表
   * 可以通过 groupId 或 resumeId 获取
   */
  async getVersions(data: {
    groupId?: number;
    resumeId?: number;
  }): Promise<{ success: boolean; data: VersionsResponse; timestamp: string; error?: string }> {
    return invokeIPC(IPC_CHANNELS.VERSION.GET_VERSIONS, data);
  }

  /**
   * 合并分组
   */
  async mergeGroups(data: {
    sourceGroupId: number;
    targetGroupId: number;
  }): Promise<{ success: boolean; data: any; timestamp: string; error?: string }> {
    return invokeIPC(IPC_CHANNELS.VERSION.MERGE_GROUPS, data);
  }

  /**
   * 删除分组
   */
  async deleteGroup(data: {
    groupId: number;
    deleteResumes?: boolean;
  }): Promise<{ success: boolean; data: any; timestamp: string; error?: string }> {
    return invokeIPC(IPC_CHANNELS.VERSION.DELETE_GROUP, data);
  }
}

// 导出单例
export const versionApi = new VersionIpcService();
