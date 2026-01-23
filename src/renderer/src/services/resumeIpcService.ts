import { invokeIPC } from './ipcApi';
import { IPC_CHANNELS } from '@/shared/types';
import type {
  ResumeData,
  ResumeListData,
  ResumeUploadResponse,
  ResumeAnalyzeResponse,
  OptimizationResultData,
  ResumeStatusData,
  ResumeGenerateQuestionsResponse,
  ResumeUploadRequest,
  ResumeListRequest,
  ResumeUpdateRequest,
  ResumeAnalyzeRequest,
  ResumeOptimizeRequest,
  ResumeGetStatusRequest,
  ResumeGenerateQuestionsRequest,
  ResumeDeleteRequest,
  ResumeGetRequest,
  ResumeExtractRequest,
  ResumeExtractResponse,
} from '@/shared/types';

/**
 * 简历 IPC 服务
 * 替代原来的 api.ts
 */
export const resumeApi = {
  /**
   * 上传简历
   * @param file File 对象
   * @param jobDescription 职位描述
   */
  uploadResume: async (
    file: File,
    jobDescription?: string
  ): Promise<ResumeUploadResponse> => {
    const { electronAPI } = window as any;

    // 将 File 转换为 Uint8Array 以便通过 IPC 传输
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    const response = await invokeIPC<ResumeUploadResponse>(
      IPC_CHANNELS.RESUME.UPLOAD,
      {
        fileData,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        jobDescription,
      } as ResumeUploadRequest
    );

    return response;
  },

  /**
   * 获取简历列表
   */
  getResumes: async (
    page: number = 1,
    limit: number = 10
  ): Promise<ResumeListData> => {
    return invokeIPC<ResumeListData>(
      IPC_CHANNELS.RESUME.LIST,
      { page, limit } as ResumeListRequest
    );
  },

  /**
   * 获取单个简历
   */
  getResume: async (id: number): Promise<ResumeData> => {
    return invokeIPC<ResumeData>(
      IPC_CHANNELS.RESUME.GET,
      { id } as ResumeGetRequest
    );
  },

  /**
   * 分析简历
   */
  analyzeResume: async (
    id: number,
    jobDescription: string
  ): Promise<ResumeAnalyzeResponse> => {
    return invokeIPC<ResumeAnalyzeResponse>(
      IPC_CHANNELS.RESUME.ANALYZE,
      { id, jobDescription } as ResumeAnalyzeRequest
    );
  },

  /**
   * 优化简历
   */
  optimizeResume: async (
    id: number,
    job: string,
    options?: {
      focusAreas?: string[];
      tone?: 'professional' | 'enthusiastic' | 'confident';
      length?: 'short' | 'medium' | 'long';
    }
  ): Promise<OptimizationResultData> => {
    return invokeIPC<OptimizationResultData>(
      IPC_CHANNELS.RESUME.OPTIMIZE,
      { id, job, options } as ResumeOptimizeRequest
    );
  },

  /**
   * 获取处理状态
   */
  getResumeStatus: async (id: number): Promise<ResumeStatusData> => {
    return invokeIPC<ResumeStatusData>(
      IPC_CHANNELS.RESUME.GET_STATUS,
      { id } as ResumeGetStatusRequest
    );
  },

  /**
   * 生成面试问题
   */
  generateQuestions: async (
    id: number,
    count: number = 5,
    type: 'technical' | 'behavioral' | 'situational' | 'all' = 'all'
  ): Promise<ResumeGenerateQuestionsResponse> => {
    return invokeIPC<ResumeGenerateQuestionsResponse>(
      IPC_CHANNELS.RESUME.GENERATE_QUESTIONS,
      { id, count, type } as ResumeGenerateQuestionsRequest
    );
  },

  /**
   * 删除简历
   */
  deleteResume: async (id: number): Promise<void> => {
    return invokeIPC<void>(
      IPC_CHANNELS.RESUME.DELETE,
      { id } as ResumeDeleteRequest
    );
  },

  /**
   * 更新简历
   */
  updateResume: async (
    id: number,
    updates: {
      jobDescription?: string;
      status?: string;
    }
  ): Promise<ResumeData> => {
    return invokeIPC<ResumeData>(
      IPC_CHANNELS.RESUME.UPDATE,
      { id, ...updates } as ResumeUpdateRequest
    );
  },

  /**
   * 提取简历信息（使用 AI 增强）
   */
  extractResumeInfo: async (
    id: number
  ): Promise<ResumeExtractResponse> => {
    return invokeIPC<ResumeExtractResponse>(
      IPC_CHANNELS.RESUME.EXTRACT,
      { id } as ResumeExtractRequest
    );
  },
};
