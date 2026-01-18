import { database } from '../database/sqlite';
import { logger } from '../utils/logger';

export interface DetectDuplicateRequest {
  contentHash: string;
  personHash?: string;
  filename: string;
}

export interface DetectDuplicateResult {
  exactDuplicate: boolean;
  samePersonResumes?: any[];
  suggestedGroupId?: number;
}

export class DeduplicationService {
  /**
   * 检测重复简历
   */
  static async detectDuplicates(
    userId: number,
    request: DetectDuplicateRequest
  ): Promise<DetectDuplicateResult> {
    try {
      const db = database.getDatabase();

      // 1. 检测完全相同的文件（contentHash 相同）
      const exactDuplicate = db.prepare(
        'SELECT id, original_filename FROM resumes WHERE user_id = ? AND content_hash = ?'
      ).get(userId, request.contentHash) as any;

      if (exactDuplicate) {
        logger.info(`检测到完全重复的简历: ${exactDuplicate.id} - ${exactDuplicate.original_filename}`);
        return {
          exactDuplicate: true,
        };
      }

      // 2. 检测同一个人的简历（personHash 相同）
      let samePersonResumes: any[] = [];
      if (request.personHash) {
        const personMatches = db.prepare(
          'SELECT * FROM resumes WHERE user_id = ? AND person_hash = ? ORDER BY created_at DESC'
        ).all(userId, request.personHash);

        if (personMatches && personMatches.length > 0) {
          samePersonResumes = personMatches.map((r: any) => ({
            id: r.id,
            originalFilename: r.original_filename,
            groupId: r.group_id,
            createdAt: r.created_at,
          }));
          logger.info(`检测到 ${samePersonResumes.length} 个同一个人的简历`);
        }
      }

      return {
        exactDuplicate: false,
        samePersonResumes,
      };
    } catch (error) {
      logger.error('检测重复简历失败:', error);
      throw error;
    }
  }

  /**
   * 获取简历组信息
   */
  static async getResumeGroups(userId: number): Promise<any[]> {
    try {
      const db = database.getDatabase();
      const groups = db.prepare(
        `SELECT DISTINCT g.id, g.name, g.description, g.created_at
         FROM resume_groups g
         WHERE g.user_id = ?
         ORDER BY g.created_at DESC`
      ).all(userId);

      return groups || [];
    } catch (error) {
      logger.error('获取简历组失败:', error);
      throw error;
    }
  }

  /**
   * 获取简历组中的所有简历
   */
  static async getResumesInGroup(groupId: number): Promise<any[]> {
    try {
      const db = database.getDatabase();
      const resumes = db.prepare(
        `SELECT r.id, r.original_filename, r.is_primary, r.version_label, r.created_at
         FROM resumes r
         WHERE r.group_id = ?
         ORDER BY r.created_at DESC`
      ).all(groupId);

      return resumes || [];
    } catch (error) {
      logger.error('获取组内简历失败:', error);
      throw error;
    }
  }
}

export default DeduplicationService;
