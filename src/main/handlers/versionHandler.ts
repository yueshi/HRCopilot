import { IpcMainInvokeEvent } from 'electron';
import { BaseHandler } from './base';
import { IPC_CHANNELS, ErrorCode } from '../../shared/types';
import { database } from '../database/sqlite';
import { logger } from '../utils/logger';

export class VersionHandler extends BaseHandler {
  constructor() {
    super();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register(IPC_CHANNELS.VERSION.CREATE_GROUP, this.createGroup.bind(this));
    this.register(IPC_CHANNELS.VERSION.ADD_VARIANT, this.addVariant.bind(this));
    this.register(IPC_CHANNELS.VERSION.SET_PRIMARY, this.setPrimary.bind(this));
    this.register(IPC_CHANNELS.VERSION.GET_VERSIONS, this.getVersions.bind(this));
    this.register(IPC_CHANNELS.VERSION.MERGE_GROUPS, this.mergeGroups.bind(this));
    this.register(IPC_CHANNELS.VERSION.DELETE_GROUP, this.deleteGroup.bind(this));
  }

  /**
   * 创建简历组
   */
  private async createGroup(
    event: IpcMainInvokeEvent,
    request: {
      groupName: string;
      primaryResumeId: number;
      description?: string;
    }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 创建简历组: ${request.groupName}`);

    try {
      // 验证简历所有权
      const isOwner = await database.isResumeOwner(userId, request.primaryResumeId);
      if (!isOwner) {
        return {
          success: false,
          error: '简历不存在或无权限',
          code: ErrorCode.NOT_FOUND,
        };
      }

      // 检查简历是否已在其他组中
      const resume = await database.getResumeById(request.primaryResumeId);
      if (resume && resume.group_id) {
        return {
          success: false,
          error: '该简历已属于其他简历组',
          code: ErrorCode.VALIDATION_ERROR,
        };
      }

      const groupId = await database.createResumeGroup({
        userId,
        groupName: request.groupName,
        primaryResumeId: request.primaryResumeId,
        description: request.description,
      });

      const group = await database.getResumeGroup(groupId);

      return {
        success: true,
        data: group,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('创建简历组失败:', error);
      return {
        success: false,
        error: `创建简历组失败: ${(error as Error).message}`,
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * 添加简历变体到组
   */
  private async addVariant(
    event: IpcMainInvokeEvent,
    request: {
      groupId: number;
      resumeId: number;
      versionLabel?: string;
      versionNotes?: string;
    }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 添加简历变体到组 ${request.groupId}`);

    try {
      // 验证组所有权
      const isGroupOwner = await database.isResumeGroupOwner(userId, request.groupId);
      if (!isGroupOwner) {
        return {
          success: false,
          error: '简历组不存在或无权限',
          code: ErrorCode.NOT_FOUND,
        };
      }

      // 验证简历所有权
      const isResumeOwner = await database.isResumeOwner(userId, request.resumeId);
      if (!isResumeOwner) {
        return {
          success: false,
          error: '简历不存在或无权限',
          code: ErrorCode.NOT_FOUND,
        };
      }

      // 检查简历是否已在其他组中
      const resume = await database.getResumeById(request.resumeId);
      if (resume && resume.group_id) {
        return {
          success: false,
          error: '该简历已属于其他简历组',
          code: ErrorCode.VALIDATION_ERROR,
        };
      }

      await database.addResumeToGroup({
        resumeId: request.resumeId,
        groupId: request.groupId,
        versionLabel: request.versionLabel,
        versionNotes: request.versionNotes,
      });

      const updatedResume = await database.getResumeById(request.resumeId);

      return {
        success: true,
        data: updatedResume,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('添加简历变体失败:', error);
      return {
        success: false,
        error: `添加简历变体失败: ${(error as Error).message}`,
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * 设置主版本
   */
  private async setPrimary(
    event: IpcMainInvokeEvent,
    request: {
      groupId: number;
      resumeId: number;
    }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 设置主版本: 组 ${request.groupId}, 简历 ${request.resumeId}`);

    try {
      // 验证组所有权
      const isGroupOwner = await database.isResumeGroupOwner(userId, request.groupId);
      if (!isGroupOwner) {
        return {
          success: false,
          error: '简历组不存在或无权限',
          code: ErrorCode.NOT_FOUND,
        };
      }

      // 验证简历所有权
      const isResumeOwner = await database.isResumeOwner(userId, request.resumeId);
      if (!isResumeOwner) {
        return {
          success: false,
          error: '简历不存在或无权限',
          code: ErrorCode.NOT_FOUND,
        };
      }

      // 验证简历是否属于该组
      const resume = await database.getResumeById(request.resumeId);
      if (!resume || resume.group_id !== request.groupId) {
        return {
          success: false,
          error: '该简历不属于指定的简历组',
          code: ErrorCode.VALIDATION_ERROR,
        };
      }

      await database.setPrimaryResume(request.groupId, request.resumeId);

      return {
        success: true,
        data: {
          message: '主版本设置成功',
          groupId: request.groupId,
          resumeId: request.resumeId,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('设置主版本失败:', error);
      return {
        success: false,
        error: `设置主版本失败: ${(error as Error).message}`,
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * 获取版本列表
   */
  private async getVersions(
    event: IpcMainInvokeEvent,
    request: {
      groupId?: number;
      resumeId?: number;
    }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 获取版本列表`);

    try {
      let groupId = request.groupId;
      let group: any = null;

      if (request.resumeId) {
        // 通过简历 ID 获取组
        const isResumeOwner = await database.isResumeOwner(userId, request.resumeId);
        if (!isResumeOwner) {
          return {
            success: false,
            error: '简历不存在或无权限',
            code: ErrorCode.NOT_FOUND,
          };
        }

        const resume = await database.getResumeById(request.resumeId);
        if (resume) {
          groupId = resume.group_id;
        }
      }

      if (!groupId) {
        return {
          success: false,
          error: '无法确定简历组',
          code: ErrorCode.VALIDATION_ERROR,
        };
      }

      // 验证组所有权
      const isGroupOwner = await database.isResumeGroupOwner(userId, groupId);
      if (!isGroupOwner) {
        return {
          success: false,
          error: '简历组不存在或无权限',
          code: ErrorCode.NOT_FOUND,
        };
      }

      group = await database.getResumeGroup(groupId);
      const resumes = await database.getResumesInGroup(groupId);

      return {
        success: true,
        data: {
          group,
          resumes,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('获取版本列表失败:', error);
      return {
        success: false,
        error: `获取版本列表失败: ${(error as Error).message}`,
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * 合并分组
   */
  private async mergeGroups(
    event: IpcMainInvokeEvent,
    request: {
      sourceGroupId: number;
      targetGroupId: number;
    }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 合并分组: ${request.sourceGroupId} -> ${request.targetGroupId}`);

    try {
      // 验证两个组的所有权
      const isSourceOwner = await database.isResumeGroupOwner(userId, request.sourceGroupId);
      const isTargetOwner = await database.isResumeGroupOwner(userId, request.targetGroupId);

      if (!isSourceOwner) {
        return {
          success: false,
          error: '源简历组不存在或无权限',
          code: ErrorCode.NOT_FOUND,
        };
      }

      if (!isTargetOwner) {
        return {
          success: false,
          error: '目标简历组不存在或无权限',
          code: ErrorCode.NOT_FOUND,
        };
      }

      if (request.sourceGroupId === request.targetGroupId) {
        return {
          success: false,
          error: '不能将组合并到自身',
          code: ErrorCode.VALIDATION_ERROR,
        };
      }

      await database.mergeResumeGroups(request.sourceGroupId, request.targetGroupId);

      return {
        success: true,
        data: {
          message: '分组合并成功',
          sourceGroupId: request.sourceGroupId,
          targetGroupId: request.targetGroupId,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('合并分组失败:', error);
      return {
        success: false,
        error: `合并分组失败: ${(error as Error).message}`,
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * 删除分组
   */
  private async deleteGroup(
    event: IpcMainInvokeEvent,
    request: {
      groupId: number;
      deleteResumes?: boolean;
    }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 删除分组: ${request.groupId}`);

    try {
      // 验证组所有权
      const isGroupOwner = await database.isResumeGroupOwner(userId, request.groupId);
      if (!isGroupOwner) {
        return {
          success: false,
          error: '简历组不存在或无权限',
          code: ErrorCode.NOT_FOUND,
        };
      }

      await database.deleteResumeGroup(request.groupId, request.deleteResumes || false);

      return {
        success: true,
        data: {
          message: '分组删除成功',
          groupId: request.groupId,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('删除分组失败:', error);
      return {
        success: false,
        error: `删除分组失败: ${(error as Error).message}`,
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }
}
