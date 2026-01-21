import type { ResumeData, DeduplicationResult, DeduplicationAction } from '../../shared/types';
import { database } from '../database/sqlite';
import { logger } from '../utils/logger';

/**
 * 去重检测请求
 */
export interface DeduplicationDetectRequest {
  contentHash: string;
  personHash?: string;
  filename: string;
}

/**
 * 简历去重服务
 * 用于检测重复简历和同一人的多个简历
 */
export class DeduplicationService {
  /**
   * 检测重复简历
   *
   * @param userId - 用户ID
   * @param request - 检测请求
   * @returns 去重检测结果
   */
  static async detectDuplicates(
    userId: number,
    request: DeduplicationDetectRequest
  ): Promise<DeduplicationResult> {
    try {
      const db = database.getDatabase();
      const result: DeduplicationResult = {};

      // 1. 检测完全相同的文件（基于 content_hash）
      const exactDuplicate = db
        .prepare(
          'SELECT * FROM resumes WHERE user_id = ? AND content_hash = ?'
        ).get(userId, request.contentHash) as any;

      if (exactDuplicate) {
        result.exactDuplicate = DeduplicationService.mapDbToResumeData(exactDuplicate);
        result.suggestedAction = 'skip';
        logger.info('检测到完全相同的简历: resumeId=' + exactDuplicate.id + ', filename=' + request.filename);
        return result;
      }

      // 2. 如果有 personHash，检测同一人的其他简历
      if (request.personHash) {
        const samePersonResumes = db
          .prepare(
            'SELECT * FROM resumes WHERE user_id = ? AND person_hash = ? AND content_hash != ? ORDER BY created_at DESC'
          ).all(userId, request.personHash, request.contentHash) as any[];

        if (samePersonResumes.length > 0) {
          result.samePersonResumes = samePersonResumes.map((row) =>
            DeduplicationService.mapDbToResumeData(row)
          );
          result.suggestedAction = 'new_version';
          logger.info(
            '检测到同一人的 ' + samePersonResumes.length + ' 份简历: filename=' + request.filename
          );
        }
      }

      return result;
    } catch (error) {
      logger.error('检测重复简历失败:', error);
      throw new Error('检测重复简历失败: ' + (error as Error).message);
    }
  }

  /**
   * 根据去重结果处理上传
   *
   * @param userId - 用户ID
   * @param resumeId - 简历ID
   * @param result - 去重检测结果
   * @param action - 用户选择的行为
   * @returns 处理后的结果
   */
  static async handleDeduplicationAction(
    userId: number,
    resumeId: number,
    result: DeduplicationResult,
    action: DeduplicationAction
  ): Promise<void> {
    try {
      switch (action) {
        case 'skip':
          // 跳过，不创建新简历
          logger.info('用户选择跳过重复简历');
          break;

        case 'overwrite':
          // 覆盖原有简历
          if (result.exactDuplicate) {
            await DeduplicationService.deleteResume(result.exactDuplicate.id);
            logger.info('已覆盖原有简历: ' + result.exactDuplicate.id);
          }
          break;

        case 'new_version':
          // 添加为新版本（需要组ID）
          if (result.samePersonResumes && result.samePersonResumes.length > 0) {
            const firstResume = result.samePersonResumes[0];
            if (firstResume.groupId) {
              await DeduplicationService.addResumeToGroup(firstResume.groupId, resumeId);
              logger.info('已添加为新版本到组: ' + firstResume.groupId);
            }
          }
          break;

        case 'proceed':
          // 继续创建新简历
          logger.info('用户选择继续创建新简历');
          break;

        default:
          logger.warn('未知的去重操作: ' + action);
      }
    } catch (error) {
      logger.error('处理去重操作失败:', error);
      throw new Error('处理去重操作失败: ' + (error as Error).message);
    }
  }

  /**
   * 删除简历
   */
  private static async deleteResume(resumeId: number): Promise<void> {
    const db = database.getDatabase();
    db.prepare('DELETE FROM resumes WHERE id = ?').run(resumeId);
  }

  /**
   * 添加简历到组
   */
  private static async addResumeToGroup(
    groupId: number,
    resumeId: number
  ): Promise<void> {
    const db = database.getDatabase();

    // 获取组中已有的版本标签
    const existingVersions = db
      .prepare(
        'SELECT version_label FROM resumes WHERE group_id = ? AND version_label IS NOT NULL ORDER BY created_at DESC'
      ).all(groupId) as { version_label: string }[];

    // 导入 HashService 生成版本标签
    const { HashService } = await import('./hashService');
    const versionLabel = HashService.generateVersionLabel(
      existingVersions.map((v) => v.version_label)
    );

    // 更新简历记录
    db
      .prepare(
        'UPDATE resumes SET group_id = ?, is_primary = 0, version_label = ? WHERE id = ?'
      ).run(groupId, versionLabel, resumeId);
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

export default DeduplicationService;
