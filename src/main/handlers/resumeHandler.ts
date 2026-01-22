import { ipcMain, IpcMainInvokeEvent, app } from 'electron';
import { BaseHandler } from './base';
import { IPC_CHANNELS, ErrorCode } from '../../shared/types';
import type {
  ResumeUploadRequest,
  ResumeUploadResponse,
  ResumeListRequest,
  ResumeListData,
  ResumeGetRequest,
  ResumeData,
  ResumeAnalyzeRequest,
  ResumeAnalyzeResponse,
  ResumeOptimizeRequest,
  OptimizationResultData,
  ResumeGetStatusRequest,
  ResumeStatusData,
  ResumeGenerateQuestionsRequest,
  ResumeGenerateQuestionsResponse,
  InterviewQuestionData,
  ResumeDeleteRequest,
  ResumeUpdateRequest,
  ApiResponse,
} from '../../shared/types';
import { database } from '../database/sqlite';
import { FileParserService } from '../services/fileParser';
import { ResumeParserService } from '../services/resumeParserService';
import { HashService } from '../services/hashService';
import { DeduplicationService } from '../services/deduplicationService';
import { VersionService } from '../services/versionService';
import { aiAnalysisService } from '../services/aiAnalysis';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export class ResumeHandler extends BaseHandler {
  constructor() {
    super();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register(IPC_CHANNELS.RESUME.UPLOAD, this.upload.bind(this));
    this.register(IPC_CHANNELS.RESUME.LIST, this.list.bind(this));
    this.register(IPC_CHANNELS.RESUME.GET, this.get.bind(this));
    this.register(IPC_CHANNELS.RESUME.UPDATE, this.update.bind(this));
    this.register(IPC_CHANNELS.RESUME.DELETE, this.delete.bind(this));
    this.register(IPC_CHANNELS.RESUME.ANALYZE, this.analyze.bind(this));
    this.register(IPC_CHANNELS.RESUME.OPTIMIZE, this.optimize.bind(this));
    this.register(IPC_CHANNELS.RESUME.GET_STATUS, this.getStatus.bind(this));
    this.register(IPC_CHANNELS.RESUME.GENERATE_QUESTIONS, this.generateQuestions.bind(this));
  }

  private async upload(
    event: IpcMainInvokeEvent,
    request: ResumeUploadRequest
  ): Promise<ApiResponse<ResumeUploadResponse>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 上传简历: ${request.fileName}, 大小: ${request.fileSize} bytes`);

    let tempFilePath: string | null = null;
    let resumeId: number | null = null;

    try {
      // 1. 验证文件大小
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (request.fileSize > maxSize) {
        return {
          success: false,
          error: `文件大小超过限制 (${Math.round(maxSize / 1024 / 1024)}MB)`,
          code: ErrorCode.FILE_TOO_LARGE,
        };
      }

      // 2. 验证文件类型
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedMimeTypes.includes(request.mimeType)) {
        return {
          success: false,
          error: `不支持的文件类型: ${request.mimeType}`,
          code: ErrorCode.INVALID_FILE_TYPE,
        };
      }

      // 3. 将 Uint8Array 保存到临时文件
      const uploadsDir = path.join(app.getPath('userData'), 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true });

      const fileExtension = path.extname(request.fileName);
      const uniqueFileName = `${randomUUID()}${fileExtension}`;
      tempFilePath = path.join(uploadsDir, uniqueFileName);

      await fs.writeFile(tempFilePath, Buffer.from(request.fileData));
      logger.info(`临时文件已保存: ${tempFilePath}`);

      // 4. 解析文件内容
      let parsedContent: string;
      let parsedInfo: any = null;
      try {
        const parseResult = await FileParserService.parseFile(tempFilePath, request.mimeType);
        parsedContent = FileParserService.cleanText(parseResult.text);

        // 使用完整的简历解析服务提取结构化信息
        try {
          parsedInfo = ResumeParserService.parseResumeContent(parsedContent);
          logger.info('简历结构化解析完成', {
            name: parsedInfo.name,
            email: parsedInfo.email,
            skillsCount: parsedInfo.skills?.length || 0,
            educationCount: parsedInfo.education?.length || 0,
            experienceCount: parsedInfo.experience?.length || 0,
          });
        } catch (error) {
          logger.warn('简历结构化解析失败，尝试基础信息提取:', error);
          // 降级方案：使用简单正则提取
          try {
            parsedInfo = this.extractPersonalInfo(parsedContent);
          } catch (fallbackError) {
            logger.warn('基础信息提取也失败:', fallbackError);
          }
        }

        logger.info(`文件解析成功，内容长度: ${parsedContent.length} 字符`);
      } catch (error: any) {
        logger.error('文件解析失败:', error);
        return {
          success: false,
          error: error.message || '文件解析失败',
          code: ErrorCode.RESUME_PARSE_FAILED,
        };
      }

      // 5. 计算哈希值和检测去重
      const contentHash = HashService.calculateContentHash(Buffer.from(request.fileData));
      const personHash = HashService.calculatePersonHash(parsedInfo);

      // 6. 检测去重
      let groupId: number | null = null;
      let isPrimary = 1;
      let versionLabel: string | null = null;

      if (personHash) {
        const dedupeResult = await DeduplicationService.detectDuplicates(userId, {
          contentHash,
          personHash,
          filename: request.fileName,
        });

        if (dedupeResult.exactDuplicate) {
          if (request.deduplicationAction === 'skip') {
            return {
              success: false,
              error: '检测到完全相同的文件，已跳过上传',
              code: ErrorCode.ALREADY_EXISTS,
              timestamp: new Date().toISOString(),
            };
          }
        } else if (dedupeResult.samePersonResumes && dedupeResult.samePersonResumes.length > 0) {
          if (request.deduplicationAction === 'new_version' && request.targetGroupId) {
            groupId = request.targetGroupId;
            isPrimary = 0;
            versionLabel = request.versionLabel || 'v1.0';
          }
        }
      }

      // 7. 确定初始状态（有 JD 则设为 processing 以触发分析）
      const initialStatus = request.jobDescription && request.jobDescription.trim().length > 0
        ? 'processing'
        : 'pending';

      // 8. 保存简历到数据库
      resumeId = await database.createResumeWithDedup({
        userId,
        originalFilename: request.fileName,
        originalPath: tempFilePath,
        originalSize: request.fileSize,
        originalMimetype: request.mimeType,
        jobDescription: request.jobDescription,
        status: initialStatus,
        contentHash,
        personHash,
        groupId,
        isPrimary,
        versionLabel,
        versionNotes: request.versionNotes,
      });

      // 更新 processedContent 和 parsed_info
      const db = database.getDatabase();
      const parsedInfoJson = JSON.stringify(parsedInfo || {});
      logger.info("准备保存解析信息到数据库", {
        resumeId,
        parsedInfoJsonLength: parsedInfoJson.length,
        parsedInfoString: parsedInfoJson.substring(0, 500) + (parsedInfoJson.length > 500 ? "..." : ""),
      });
      db.prepare(
        'UPDATE resumes SET processed_content = ?, parsed_info = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(parsedContent, parsedInfoJson, resumeId);

      // 如果创建了新组，更新简历组
      if (groupId && isPrimary === 1) {
        try {
          await VersionService.createResumeGroup(userId, resumeId, parsedInfo?.name || '默认简历组');
          logger.info(`创建简历组成功: ${resumeId}`);
        } catch (error) {
          logger.warn('创建简历组失败:', error);
        }
      }

      logger.info(`简历上传成功，ID: ${resumeId}, 状态: ${initialStatus}`);

      // 7. 如果有职位描述，自动触发 AI 分析
      if (initialStatus === 'processing' && resumeId) {
        this.performAnalysisAsync(
          Number(resumeId),
          parsedContent,
          request.jobDescription || ''
        );
      }

      // 8. 获取完整的简历数据返回给前端
      const resume = await database.getResumeById(Number(resumeId));
      if (!resume) {
        throw new Error('简历创建后无法获取');
      }

      return {
        success: true,
        data: this.convertToResumeData(resume),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('简历上传失败:', error);

      // 清理临时文件
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
          logger.info(`临时文件已清理: ${tempFilePath}`);
        } catch (cleanupError) {
          logger.warn(`清理临时文件失败: ${tempFilePath}`, cleanupError);
        }
      }

      // 如果数据库中已创建记录，删除它
      if (resumeId) {
        try {
          await database.deleteResume(Number(resumeId));
          logger.info(`数据库记录已清理: ${resumeId}`);
        } catch (cleanupError) {
          logger.warn(`清理数据库记录失败: ${resumeId}`, cleanupError);
        }
      }

      return {
        success: false,
        error: error.message || '简历上传失败',
        code: error.code || ErrorCode.RESUME_UPLOAD_FAILED,
      };
    }
  }

  // 简单的个人信息提取（用于去重检测）
  private extractPersonalInfo(text: string): any {
    const info: any = {};

    // 尝试提取姓名（简单正则）
    const namePattern = /(?:姓名|Name)[:\s]*([^\s\n,]+)/i;
    const nameMatch = text.match(namePattern);
    if (nameMatch && nameMatch[1]) {
      const names = nameMatch[1].trim().split(/[,，]/);
      info.name = names[0]?.trim();
    }

    // 尝试提取手机号
    const phonePattern = /(?:电话|手机|Phone|Mobile)[:\s]*(1[3-9]\d{9,10})/i;
    const phoneMatch = text.match(phonePattern);
    if (phoneMatch && phoneMatch[1]) {
      info.phone = phoneMatch[1];
    }

    // 尝试提取邮箱
    const emailPattern = /[\w.-]+@[\w.-]+\.\w+/i;
    const emailMatch = text.match(emailPattern);
    if (emailMatch && emailMatch[0]) {
      info.email = emailMatch[0];
    }

    return info;
  }

  private async list(
    event: IpcMainInvokeEvent,
    request?: ResumeListRequest
  ): Promise<ApiResponse<ResumeListData>> {
    const userId = this.getCurrentUserId(event);
    const page = request?.page || 1;
    const limit = request?.limit || 10;

    logger.info(`用户 ${userId} 获取简历列表，页码: ${page}`);

    try {
      const resumes = await database.getResumesByUserId(userId, page, limit);
      const totalCount = await database.getResumeCount(userId);
      const totalPages = Math.ceil(totalCount / limit);

      const resumeDataList = resumes.map(r => this.convertToResumeData(r));

      return {
        success: true,
        data: {
          resumes: resumeDataList,
          pagination: {
            current: page,
            pageSize: limit,
            total: totalCount,
            pages: totalPages,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('获取简历列表失败:', error);
      throw new Error(`获取简历列表失败: ${error.message}`);
    }
  }

  private async get(
    event: IpcMainInvokeEvent,
    request: ResumeGetRequest
  ): Promise<ApiResponse<ResumeData>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 获取简历 ID: ${request.id}`);

    try {
      const resume = await database.getResumeById(request.id);

      if (!resume) {
        return {
          success: false,
          error: '简历不存在',
          code: ErrorCode.RESUME_NOT_FOUND,
        };
      }

      if (resume.user_id !== userId) {
        return {
          success: false,
          error: '无权访问此简历',
          code: ErrorCode.FORBIDDEN,
        };
      }

      // 调试日志：显示数据库中的原始数据
      logger.info("从数据库获取的简历原始数据", {
        resumeId: request.id,
        hasProcessedContent: !!resume.processed_content,
        processedContentLength: resume.processed_content?.length || 0,
        hasParsedInfo: !!resume.parsed_info,
        parsedInfo: resume.parsed_info
          ? resume.parsed_info.toString().substring(0, 500) + (resume.parsed_info.toString().length > 500 ? "..." : "")
          : "null",
        parsedInfoType: typeof resume.parsed_info,
      });

      const convertedData = this.convertToResumeData(resume);

      // 调试日志：显示转换后的数据
      logger.info("简历数据转换完成", {
        resumeId: request.id,
        parsedInfoName: convertedData.parsedInfo?.name,
        parsedInfoEmail: convertedData.parsedInfo?.email,
        parsedInfoPhone: convertedData.parsedInfo?.phone,
        skillsCount: convertedData.parsedInfo?.skills?.length || 0,
        educationCount: convertedData.parsedInfo?.education?.length || 0,
        experienceCount: convertedData.parsedInfo?.experience?.length || 0,
      });

      return {
        success: true,
        data: convertedData,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('获取简历失败:', error);
      throw new Error(`获取简历失败: ${error.message}`);
    }
  }

  private async update(
    event: IpcMainInvokeEvent,
    request: ResumeUpdateRequest
  ): Promise<ApiResponse<ResumeData>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 更新简历 ID: ${request.id}`);

    try {
      const resume = await database.getResumeById(request.id);

      if (!resume || resume.user_id !== userId) {
        return {
          success: false,
          error: '简历不存在或无权访问',
          code: ErrorCode.RESUME_NOT_FOUND,
        };
      }

      if (request.jobDescription !== undefined) {
        await this.updateResumeJobDescription(request.id, request.jobDescription);
      }

      if (request.status !== undefined) {
        await database.updateResumeStatus(request.id, request.status);
      }

      const updatedResume = await database.getResumeById(request.id);
      return {
        success: true,
        data: this.convertToResumeData(updatedResume),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('更新简历失败:', error);
      throw new Error(`更新简历失败: ${error.message}`);
    }
  }

  private async delete(
    event: IpcMainInvokeEvent,
    request: ResumeDeleteRequest
  ): Promise<ApiResponse<void>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 删除简历 ID: ${request.id}`);

    try {
      const resume = await database.getResumeById(request.id);

      if (!resume || resume.user_id !== userId) {
        return {
          success: false,
          error: '简历不存在或无权访问',
          code: ErrorCode.RESUME_NOT_FOUND,
        };
      }

      await database.deleteResume(request.id);

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('删除简历失败:', error);
      throw new Error(`删除简历失败: ${error.message}`);
    }
  }

  private async analyze(
    event: IpcMainInvokeEvent,
    request: ResumeAnalyzeRequest
  ): Promise<ApiResponse<ResumeAnalyzeResponse>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 分析简历 ID: ${request.id}`);

    try {
      const resume = await database.getResumeById(request.id);

      if (!resume || resume.user_id !== userId) {
        return {
          success: false,
          error: '简历不存在或无权访问',
          code: ErrorCode.RESUME_NOT_FOUND,
        };
      }

      await database.updateResumeStatus(request.id, 'processing');
      await this.updateResumeJobDescription(request.id, request.jobDescription);

      this.performAnalysisAsync(request.id, resume.processed_content || '', request.jobDescription);

      return {
        success: true,
        data: {
          id: request.id,
          status: 'processing',
          message: '分析已开始',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('启动分析失败:', error);
      throw new Error(`启动分析失败: ${error.message}`);
    }
  }

  private async optimize(
    event: IpcMainInvokeEvent,
    request: ResumeOptimizeRequest
  ): Promise<ApiResponse<OptimizationResultData>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 优化简历 ID: ${request.id}`);

    try {
      const resume = await database.getResumeById(request.id);

      if (!resume || resume.user_id !== userId) {
        return {
          success: false,
          error: '简历不存在或无权访问',
          code: ErrorCode.RESUME_NOT_FOUND,
        };
      }

      await database.updateResumeStatus(request.id, 'processing');
      await this.updateResumeJobDescription(request.id, request.job);

      this.performOptimizationAsync(request.id, resume.processed_content || '', request);

      return {
        success: true,
        data: {
          optimizedContent: '',
          changes: [],
          improvements: [],
          score: { before: 0, after: 0 },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('启动优化失败:', error);
      throw new Error(`启动优化失败: ${error.message}`);
    }
  }

  private async getStatus(
    event: IpcMainInvokeEvent,
    request: ResumeGetStatusRequest
  ): Promise<ApiResponse<ResumeStatusData>> {
    try {
      const resume = await database.getResumeById(request.id);

      if (!resume) {
        return {
          success: false,
          error: '简历不存在',
          code: ErrorCode.RESUME_NOT_FOUND,
        };
      }

      const statusData = this.calculateStatusData(resume.status);

      return {
        success: true,
        data: statusData,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('获取状态失败:', error);
      throw new Error(`获取状态失败: ${error.message}`);
    }
  }

  private async generateQuestions(
    event: IpcMainInvokeEvent,
    request: ResumeGenerateQuestionsRequest
  ): Promise<ApiResponse<ResumeGenerateQuestionsResponse>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 生成面试问题，简历 ID: ${request.id}`);

    try {
      const resume = await database.getResumeById(request.id);

      if (!resume || resume.user_id !== userId) {
        return {
          success: false,
          error: '简历不存在或无权访问',
          code: ErrorCode.RESUME_NOT_FOUND,
        };
      }

      const jobDescription = resume.job_description || '';
      const content = resume.processed_content || '';

      if (resume.interview_questions) {
        const existingQuestions = JSON.parse(resume.interview_questions);
        return {
          success: true,
          data: {
            questions: this.convertToInterviewQuestions(existingQuestions),
            count: existingQuestions.length,
          },
          timestamp: new Date().toISOString(),
        };
      }

      const questions = await aiAnalysisService.generateInterviewQuestions({
        resumeContent: content,
        jobDescription,
        questionType: request.type || 'all',
        count: request.count || 5,
      });

      await this.updateResumeInterviewQuestions(request.id, questions);

      return {
        success: true,
        data: {
          questions: this.convertToInterviewQuestions(questions),
          count: questions.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('生成面试问题失败:', error);
      throw new Error(`生成面试问题失败: ${error.message}`);
    }
  }

  private async performAnalysisAsync(
    resumeId: number,
    content: string,
    jobDescription: string
  ): Promise<void> {
    setTimeout(async () => {
      try {
        const result = await aiAnalysisService.analyzeResume({
          resumeContent: content,
          jobDescription,
        });

        await database.updateResumeAnalysis(resumeId, {
          processedContent: content,
          evaluation: result.evaluation,
        });

        await database.updateResumeStatus(resumeId, 'completed');

        logger.info(`简历 ${resumeId} 分析完成`);
      } catch (error: any) {
        logger.error(`简历 ${resumeId} 分析失败:`, error);
        await database.updateResumeStatus(resumeId, 'failed');
      }
    }, 100);
  }

  private async performOptimizationAsync(
    resumeId: number,
    content: string,
    request: ResumeOptimizeRequest
  ): Promise<void> {
    setTimeout(async () => {
      try {
        await database.updateResumeStatus(resumeId, 'completed');
        logger.info(`简历 ${resumeId} 优化完成`);
      } catch (error: any) {
        logger.error(`简历 ${resumeId} 优化失败:`, error);
        await database.updateResumeStatus(resumeId, 'failed');
      }
    }, 100);
  }

  private calculateStatusData(status: string): ResumeStatusData {
    const steps = ['文件上传', '内容解析', 'AI分析', '生成报告'];

    switch (status) {
      case 'pending':
        return {
          status: 'pending',
          progress: '0',
          completedSteps: [],
          totalSteps: steps,
        };
      case 'processing':
        return {
          status: 'processing',
          progress: '50',
          completedSteps: steps.slice(0, 2),
          totalSteps: steps,
        };
      case 'completed':
        return {
          status: 'completed',
          progress: '100',
          completedSteps: steps,
          totalSteps: steps,
        };
      case 'failed':
        return {
          status: 'failed',
          progress: '0',
          completedSteps: [],
          totalSteps: steps,
          error: '处理失败',
        };
      default:
        return {
          status: 'pending',
          progress: '0',
          completedSteps: [],
          totalSteps: steps,
        };
    }
  }

  private convertToResumeData(resume: any): ResumeData {
    let evaluation = undefined;
    if (resume.evaluation) {
      try {
        evaluation = typeof resume.evaluation === 'string' ? JSON.parse(resume.evaluation) : resume.evaluation;
      } catch {
        evaluation = resume.evaluation;
      }
    }

    let interviewQuestions = undefined;
    if (resume.interview_questions) {
      try {
        interviewQuestions = typeof resume.interview_questions === 'string' ? JSON.parse(resume.interview_questions) : resume.interview_questions;
      } catch {
        interviewQuestions = resume.interview_questions;
      }
    }

    let parsedInfo = undefined;
    if (resume.parsed_info) {
      try {
        parsedInfo = typeof resume.parsed_info === 'string' ? JSON.parse(resume.parsed_info) : resume.parsed_info;
      } catch {
        parsedInfo = resume.parsed_info;
      }
    }

    return {
      id: parseInt(resume.id),
      userId: parseInt(resume.user_id),
      originalFilename: resume.original_filename,
      originalPath: resume.original_path,
      originalSize: parseInt(resume.original_size),
      originalMimetype: resume.original_mimetype,
      processedContent: resume.processed_content,
      parsedInfo,
      jobDescription: resume.job_description,
      optimizationResult: resume.optimization_result,
      evaluation,
      interviewQuestions,
      status: resume.status,
      createdAt: resume.created_at,
      updatedAt: resume.updated_at,
      // 去重和版本管理字段
      contentHash: resume.content_hash,
      personHash: resume.person_hash,
      groupId: resume.group_id,
      isPrimary: !!resume.is_primary,
      versionLabel: resume.version_label,
      versionNotes: resume.version_notes,
    };
  }

  private convertToInterviewQuestions(questions: any[]): InterviewQuestionData[] {
    return questions.map((q: any) => ({
      question: q.question || q,
      type: q.type || 'technical',
      category: q.category || '通用',
      difficulty: q.difficulty || 'medium',
      suggestedAnswer: q.suggestedAnswer,
    }));
  }

  private async updateResumeJobDescription(id: number, jobDescription: string): Promise<void> {
    const db = database.getDatabase();
    db.prepare(
      'UPDATE resumes SET job_description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(jobDescription, id);
  }

  private async updateResumeInterviewQuestions(id: number, questions: any[]): Promise<void> {
    const db = database.getDatabase();
    db.prepare(
      'UPDATE resumes SET interview_questions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(JSON.stringify(questions), id);
  }

  private async updateResumeAnalysis(
    id: number,
    data: {
      processedContent?: string;
      evaluation?: any;
    }
  ): Promise<void> {
    const db = database.getDatabase();

    const fields: string[] = [];
    const values: any[] = [];

    if (data.processedContent !== undefined) {
      fields.push('processed_content = ?');
      values.push(data.processedContent);
    }

    if (data.evaluation !== undefined) {
      fields.push('evaluation = ?');
      values.push(JSON.stringify(data.evaluation));
    }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      db.prepare(
        `UPDATE resumes SET ${fields.join(', ')} WHERE id = ?`
      ).run(...values);
    }
  }
}
