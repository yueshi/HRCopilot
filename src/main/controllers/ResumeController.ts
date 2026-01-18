import { Context } from 'koa';
import { DatabaseService } from '../database/sqlite';
import { FileParserService } from '../services/fileParser';
import { AIAnalysisService, aiAnalysisService } from '../services/aiAnalysis';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

/**
 * 简历控制器
 * 处理简历相关的业务逻辑
 */
export class ResumeController {
  private database: DatabaseService;
  private aiAnalysis: AIAnalysisService;

  constructor() {
    this.database = new DatabaseService();
    this.aiAnalysis = aiAnalysisService;
  }

  /**
   * 上传简历
   */
  async upload(ctx: Context) {
    try {
      const { file, jobDescription } = ctx.request.body as any;
      const userId = ctx.state.user?.id || 1; // 默认用户ID为1

      if (!file) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: '请上传简历文件'
        };
        return;
      }

      await this.database.init();

      // 保存文件信息到数据库
      const resumeId = await this.database.createResume({
        userId,
        originalFilename: file.originalname || file.name,
        originalPath: file.path,
        originalSize: file.size,
        originalMimetype: file.mimetype,
        jobDescription,
        status: 'uploaded'
      });

      ctx.body = {
        success: true,
        data: {
          id: resumeId,
          message: '简历上传成功'
        }
      };
    } catch (error) {
      logger.error('简历上传失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '简历上传失败'
      };
    } finally {
      await this.database.close();
    }
  }

  /**
   * 获取简历列表
   */
  async list(ctx: Context) {
    try {
      const userId = ctx.state.user?.id || 1;
      const page = parseInt(ctx.query.page as string) || 1;
      const limit = parseInt(ctx.query.limit as string) || 10;

      await this.database.init();

      const resumes = await this.database.getResumesByUserId(userId, page, limit);
      const total = await this.database.getResumeCount(userId);

      ctx.body = {
        success: true,
        data: {
          items: resumes,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('获取简历列表失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '获取简历列表失败'
      };
    } finally {
      await this.database.close();
    }
  }

  /**
   * 获取简历详情
   */
  async getDetail(ctx: Context) {
    try {
      const { id } = ctx.params;
      const userId = ctx.state.user?.id || 1;

      await this.database.init();

      const resume = await this.database.getResumeById(parseInt(id));

      if (!resume) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: '简历不存在'
        };
        return;
      }

      // 验证权限
      if (resume.userId !== userId) {
        ctx.status = 403;
        ctx.body = {
          success: false,
          error: '无权访问此简历'
        };
        return;
      }

      ctx.body = {
        success: true,
        data: resume
      };
    } catch (error) {
      logger.error('获取简历详情失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '获取简历详情失败'
      };
    } finally {
      await this.database.close();
    }
  }

  /**
   * 启动简历分析
   */
  async analyze(ctx: Context) {
    try {
      const { id } = ctx.params;
      const userId = ctx.state.user?.id || 1;

      await this.database.init();

      const resume = await this.database.getResumeById(parseInt(id));

      if (!resume) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: '简历不存在'
        };
        return;
      }

      if (resume.userId !== userId) {
        ctx.status = 403;
        ctx.body = {
          success: false,
          error: '无权操作此简历'
        };
        return;
      }

      if (!resume.jobDescription) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: '请先提供职位描述(JD)'
        };
        return;
      }

      // 更新状态为处理中
      await this.database.updateResumeStatus(parseInt(id), 'processing');

      // 异步处理分析（实际项目中可能需要使用任务队列）
      this.processAnalysis(parseInt(id), resume).catch(error => {
        logger.error('简历分析失败:', error);
        this.database.updateResumeStatus(parseInt(id), 'failed');
      });

      ctx.body = {
        success: true,
        data: {
          message: '简历分析已启动',
          status: 'processing'
        }
      };
    } catch (error) {
      logger.error('启动简历分析失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '启动简历分析失败'
      };
    } finally {
      await this.database.close();
    }
  }

  /**
   * 获取分析状态
   */
  async getStatus(ctx: Context) {
    try {
      const { id } = ctx.params;
      const userId = ctx.state.user?.id || 1;

      await this.database.init();

      const resume = await this.database.getResumeById(parseInt(id));

      if (!resume || resume.userId !== userId) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: '简历不存在'
        };
        return;
      }

      ctx.body = {
        success: true,
        data: {
          id: resume.id,
          status: resume.status,
          evaluation: resume.evaluation,
          interviewQuestions: resume.interviewQuestions
        }
      };
    } catch (error) {
      logger.error('获取分析状态失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '获取分析状态失败'
      };
    } finally {
      await this.database.close();
    }
  }

  /**
   * 生成面试问题
   */
  async generateQuestions(ctx: Context) {
    try {
      const { id } = ctx.params;
      const { questionType, count } = ctx.request.body as any;
      const userId = ctx.state.user?.id || 1;

      await this.database.init();

      const resume = await this.database.getResumeById(parseInt(id));

      if (!resume || resume.userId !== userId) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: '简历不存在'
        };
        return;
      }

      if (resume.status !== 'completed') {
        ctx.status = 400;
        ctx.body = {
          success: false,
          error: '请先完成简历分析'
        };
        return;
      }

      // 生成面试问题
      const questions = await this.aiAnalysis.generateInterviewQuestions({
        resumeContent: resume.processedContent || '',
        jobDescription: resume.jobDescription || '',
        questionType: questionType || 'all',
        count: count || 10
      });

      // 保存到数据库
      await this.database.updateResumeInterviewQuestions(parseInt(id), questions);

      ctx.body = {
        success: true,
        data: {
          questions
        }
      };
    } catch (error) {
      logger.error('生成面试问题失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '生成面试问题失败'
      };
    } finally {
      await this.database.close();
    }
  }

  /**
   * 删除简历
   */
  async delete(ctx: Context) {
    try {
      const { id } = ctx.params;
      const userId = ctx.state.user?.id || 1;

      await this.database.init();

      const resume = await this.database.getResumeById(parseInt(id));

      if (!resume) {
        ctx.status = 404;
        ctx.body = {
          success: false,
          error: '简历不存在'
        };
        return;
      }

      if (resume.userId !== userId) {
        ctx.status = 403;
        ctx.body = {
          success: false,
          error: '无权删除此简历'
        };
        return;
      }

      // 删除文件
      try {
        await fs.unlink(resume.originalPath);
      } catch (error) {
        logger.warn('删除文件失败:', error);
      }

      // 删除数据库记录
      await this.database.deleteResume(parseInt(id));

      ctx.body = {
        success: true,
        data: {
          message: '简历删除成功'
        }
      };
    } catch (error) {
      logger.error('删除简历失败:', error);
      ctx.status = 500;
      ctx.body = {
        success: false,
        error: '删除简历失败'
      };
    } finally {
      await this.database.close();
    }
  }

  /**
   * 处理简历分析（异步）
   */
  private async processAnalysis(resumeId: number, resume: any): Promise<void> {
    try {
      // 解析文件内容
      const parseResult = await FileParserService.parseFile(
        resume.originalPath,
        resume.originalMimetype
      );

      // 使用AI分析
      const analysisResult = await this.aiAnalysis.analyzeResume({
        resumeContent: parseResult.text,
        jobDescription: resume.jobDescription || ''
      });

      // 更新数据库
      await this.database.updateResumeAnalysis(resumeId, {
        processedContent: parseResult.text,
        evaluation: analysisResult.evaluation
      });
      await this.database.updateResumeStatus(resumeId, 'completed');
    } catch (error) {
      logger.error('处理简历分析失败:', error);
      await this.database.updateResumeStatus(resumeId, 'failed');
      throw error;
    }
  }
}

// 导出单例实例
export const resumeController = new ResumeController();
