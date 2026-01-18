import type { ResumeData, ResumeGroupData } from '../../shared/types';
import { HashService } from './hashService';
import { logger } from '../utils/logger';
import { database } from '../database/sqlite';

/**
 * 简历版本管理服务
 * 用于管理简历组和版本
 */
export class VersionService {
  /**
   * 创建简历组
   *
   * @param userId - 用户ID
   * @param primaryResumeId - 主简历ID
   * @param groupName - 组名（默认为简历姓名）
   * @returns 组ID
   */
  static async createResumeGroup(
    userId: number,
    primaryResumeId: number,
    groupName?: string,
  ): Promise<number> {
    try {
      const db = database.getDatabase();

      // 如果没有指定组名，使用简历文件名
      const finalGroupName = groupName || '默认简历组';

      // 创建简历组
      const result = db
        .prepare(`
          INSERT INTO resume_groups (user_id, group_name, primary_resume_id)
          VALUES (?, ?, ?)
        `)
        .run(userId, finalGroupName, primaryResumeId);

      const groupId = result.lastInsertRowid as number;

      // 更新简历记录，设置 group_id 和 is_primary
      db
        .prepare(`
          UPDATE resumes
          SET group_id = ?, is_primary = 1
          WHERE id = ?
        `)
        .run(groupId, primaryResumeId);

      logger.info(`创建简历组: groupId=${groupId}, groupName=${finalGroupName}`);
      return groupId;
    } catch (error) {
      logger.error('创建简历组失败:', error);
      throw new Error(`创建简历组失败: ${(error as Error).message}`);
    }
  }

  /**
   * 添加简历变体到组
   *
   * @param groupId - 组ID
   * @param resumeId - 简历ID
   * @param versionLabel - 版本标签（可选）
   * @param versionNotes - 版本备注（可选）
   */
  static async addResumeVariant(
    groupId: number,
    resumeId: number,
    versionLabel?: string,
    versionNotes?: string,
  ): Promise<void> {
    try {
      const db = database.getDatabase();

      // 获取组中已有的版本标签
      const existingVersions = db
        .prepare(`
          SELECT version_label FROM resumes
          WHERE group_id = ? AND version_label IS NOT NULL
          ORDER BY created_at DESC
        `)
        .all(groupId) as { version_label: string }[];

      // 如果没有指定版本标签，自动生成
      const finalVersionLabel = versionLabel || HashService.generateVersionLabel(
        existingVersions.map(v => v.version_label),
      );

      // 更新简历记录
      db
        .prepare(`
          UPDATE resumes
          SET group_id = ?, is_primary = 0, version_label = ?, version_notes = ?
          WHERE id = ?
        `)
        .run(groupId, finalVersionLabel, versionNotes || null, resumeId);

      logger.info(`添加简历变体: groupId=${groupId}, resumeId=${resumeId}, versionLabel=${finalVersionLabel}`);
    } catch (error) {
      logger.error('添加简历变体失败:', error);
      throw new Error(`添加简历变体失败: ${(error as Error).message}`);
    }
  }

  /**
   * 设置主简历
   *
   * @param groupId - 组ID
   * @param resumeId - 简历ID
   */
  static async setPrimaryResume(groupId: number, resumeId: number): Promise<void> {
    try {
      const db = database.getDatabase();

      // 在事务中执行
      db.transaction(() => {
        // 取消所有简历的主简历标记
        db
          .prepare('UPDATE resumes SET is_primary = 0 WHERE group_id = ?')
          .run(groupId);

        // 设置新的主简历
        db
          .prepare(`
            UPDATE resumes SET is_primary = 1
            WHERE group_id = ? AND id = ?
          `)
          .run(groupId, resumeId);

        // 更新简历组的 primary_resume_id
        db
          .prepare('UPDATE resume_groups SET primary_resume_id = ? WHERE id = ?')
          .run(resumeId, groupId);
      })();

      logger.info(`设置主简历: groupId=${groupId}, resumeId=${resumeId}`);
    } catch (error) {
      logger.error('设置主简历失败:', error);
      throw new Error(`设置主简历失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取简历版本历史
   *
   * @param groupId - 组ID
   * @returns 简历版本列表
   */
  static async getResumeVersions(groupId: number): Promise<ResumeData[]> {
    try {
      const db = database.getDatabase();
      const rows = db
        .prepare(`
          SELECT * FROM resumes
          WHERE group_id = ?
          ORDER BY is_primary DESC, created_at DESC
        `)
        .all(groupId) as any[];

      return rows.map((row) => VersionService.mapDbToResumeData(row));
    } catch (error) {
      logger.error('获取简历版本失败:', error);
      throw new Error(`获取简历版本失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取简历组信息
   *
   * @param groupId - 组ID
   * @returns 简历组数据
   */
  static async getResumeGroup(groupId: number): Promise<ResumeGroupData | null> {
    try {
      const db = database.getDatabase();
      const group = db
        .prepare('SELECT * FROM resume_groups WHERE id = ?')
        .get(groupId) as any;

      if (!group) {
        return null;
      }

      // 获取组内所有简历
      const resumes = await VersionService.getResumeVersions(groupId);

      return {
        id: group.id,
        userId: group.user_id,
        groupName: group.group_name,
        primaryResumeId: group.primary_resume_id,
        description: group.description,
        createdAt: group.created_at,
        updatedAt: group.updated_at,
        resumes,
      };
    } catch (error) {
      logger.error('获取简历组失败:', error);
      throw new Error(`获取简历组失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取用户的所有简历组
   *
   * @param userId - 用户ID
   * @returns 简历组列表
   */
  static async getUserResumeGroups(userId: number): Promise<ResumeGroupData[]> {
    try {
      const db = database.getDatabase();
      const groups = db
        .prepare(`
          SELECT * FROM resume_groups
          WHERE user_id = ?
          ORDER BY created_at DESC
        `)
        .all(userId) as any[];

      const result: ResumeGroupData[] = [];
      for (const group of groups) {
        const resumes = await VersionService.getResumeVersions(group.id);
        result.push({
          id: group.id,
          userId: group.user_id,
          groupName: group.group_name,
          primaryResumeId: group.primary_resume_id,
          description: group.description,
          createdAt: group.created_at,
          updatedAt: group.updated_at,
          resumes,
        });
      }

      return result;
    } catch (error) {
      logger.error('获取用户简历组失败:', error);
      throw new Error(`获取用户简历组失败: ${(error as Error).message}`);
    }
  }

  /**
   * 合并简历组
   * 将源组的所有简历移动到目标组
   *
   * @param targetGroupId - 目标组ID
   * @param sourceGroupId - 源组ID
   */
  static async mergeResumeGroups(targetGroupId: number, sourceGroupId: number): Promise<void> {
    try {
      const db = database.getDatabase();

      // 在事务中执行
      db.transaction(() => {
        // 获取源组的所有简历
        const sourceResumes = db
          .prepare('SELECT id FROM resumes WHERE group_id = ?')
          .all(sourceGroupId) as { id: number }[];

        // 移动简历到目标组
        for (const resume of sourceResumes) {
          db
            .prepare('UPDATE resumes SET group_id = ? WHERE id = ?')
            .run(targetGroupId, resume.id);
        }

        // 删除源组
        db.prepare('DELETE FROM resume_groups WHERE id = ?').run(sourceGroupId);
      })();

      logger.info(`合并简历组: source=${sourceGroupId} -> target=${targetGroupId}`);
    } catch (error) {
      logger.error('合并简历组失败:', error);
      throw new Error(`合并简历组失败: ${(error as Error).message}`);
    }
  }

  /**
   * 删除简历组
   *
   * @param groupId - 组ID
   * @param keepPrimaryResume - 是否保留主简历（默认 true）
   */
  static async deleteResumeGroup(groupId: number, keepPrimaryResume: boolean = true): Promise<void> {
    try {
      const db = database.getDatabase();

      db.transaction(() => {
        // 获取组信息
        const group = db
          .prepare('SELECT * FROM resume_groups WHERE id = ?')
          .get(groupId) as any;

        if (!group) {
          return;
        }

        if (keepPrimaryResume) {
          // 保留主简历，只取消其组关联
          db
            .prepare('UPDATE resumes SET group_id = NULL, is_primary = 0 WHERE id = ?')
            .run(group.primary_resume_id);
        } else {
          // 删除组内所有简历
          db.prepare('DELETE FROM resumes WHERE group_id = ?').run(groupId);
        }

        // 删除组
        db.prepare('DELETE FROM resume_groups WHERE id = ?').run(groupId);
      })();

      logger.info(`删除简历组: groupId=${groupId}, keepPrimary=${keepPrimaryResume}`);
    } catch (error) {
      logger.error('删除简历组失败:', error);
      throw new Error(`删除简历组失败: ${(error as Error).message}`);
    }
  }

  /**
   * 更新简历组信息
   *
   * @param groupId - 组ID
   * @param updates - 更新数据
   */
  static async updateResumeGroup(
    groupId: number,
    updates: {
      groupName?: string;
      description?: string;
    },
  ): Promise<void> {
    try {
      const db = database.getDatabase();
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.groupName !== undefined) {
        fields.push('group_name = ?');
        values.push(updates.groupName);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description || null);
      }

      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(groupId);

        db
          .prepare(`UPDATE resume_groups SET ${fields.join(', ')} WHERE id = ?`)
          .run(...values);

        logger.info(`更新简历组: groupId=${groupId}`);
      }
    } catch (error) {
      logger.error('更新简历组失败:', error);
      throw new Error(`更新简历组失败: ${(error as Error).message}`);
    }
  }

  /**
   * 将数据库行映射为 ResumeData 类型
   */
  private static mapDbToResumeData(row: any): ResumeData {
    const resume: ResumeData = {
      id: row.id,
      userId: row.user_id,
      originalFilename: row.original_filename,
      originalPath: row.original_path,
      originalSize: row.original_size,
      originalMimetype: row.original_mimetype,
      processedContent: row.processed_content,
      jobDescription: row.job_description,
      optimizationResult: row.optimization_result,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // 可选字段
    if (row.evaluation) {
      try {
        resume.evaluation = JSON.parse(row.evaluation);
      } catch {}
    }

    if (row.interview_questions) {
      try {
        resume.interviewQuestions = JSON.parse(row.interview_questions);
      } catch {}
    }

    if (row.parsed_info) {
      try {
        resume.parsedInfo = JSON.parse(row.parsed_info);
      } catch {}
    }

    // 去重和版本管理字段
    resume.contentHash = row.content_hash;
    resume.personHash = row.person_hash;
    resume.groupId = row.group_id;
    resume.isPrimary = row.is_primary === 1;
    resume.versionLabel = row.version_label;
    resume.versionNotes = row.version_notes;

    return resume;
  }
}
