/**
 * 统一的 API 响应格式
 * 所有 IPC 调用的响应都使用此格式
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: ErrorCode;
  timestamp?: string;
}

/**
 * 错误码枚举
 */
export enum ErrorCode {
  UNKNOWN = 'UNKNOWN_ERROR',
  INVALID_PARAMS = 'INVALID_PARAMS',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_EXISTS = 'USER_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  PASSWORD_MISMATCH = 'PASSWORD_MISMATCH',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RESUME_NOT_FOUND = 'RESUME_NOT_FOUND',
  RESUME_UPLOAD_FAILED = 'RESUME_UPLOAD_FAILED',
  RESUME_PARSE_FAILED = 'RESUME_PARSE_FAILED',
  RESUME_ANALYSIS_FAILED = 'RESUME_ANALYSIS_FAILED',
  RESUME_OPTIMIZATION_FAILED = 'RESUME_OPTIMIZATION_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  AI_QUOTA_EXCEEDED = 'AI_QUOTA_EXCEEDED',
  AI_TIMEOUT = 'AI_TIMEOUT',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
}

export type UserType = 'free' | 'vip' | 'admin';
export type ResumeStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'technical' | 'behavioral' | 'situational';

// 去重操作类型
export type DeduplicationAction = 'skip' | 'overwrite' | 'new_version' | 'proceed';

export interface UserRegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface UserLoginRequest {
  email: string;
  password: string;
}

export interface UserUpdateProfileRequest {
  name?: string;
  email?: string;
}

export interface UserChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResumeUploadRequest {
  // 文件数据（Buffer 转换后的 Uint8Array）
  fileData: Uint8Array;
  fileName: string;
  fileSize: number;
  mimeType: string;
  jobDescription?: string;
  // 去重操作（可选，默认为 'proceed'）
  deduplicationAction?: DeduplicationAction;
  // 目标简历组ID（当操作为 'new_version' 时使用）
  targetGroupId?: number;
  // 版本标签（当操作为 'new_version' 时使用）
  versionLabel?: string;
  // 版本备注（当操作为 'new_version' 时使用）
  versionNotes?: string;
}

export interface ResumeListRequest {
  page?: number;
  limit?: number;
}

export interface ResumeGetRequest {
  id: number;
}

export interface ResumeUpdateRequest {
  id: number;
  jobDescription?: string;
  status?: ResumeStatus;
}

export interface ResumeAnalyzeRequest {
  id: number;
  jobDescription: string;
}

export interface ResumeOptimizeRequest {
  id: number;
  job: string;
  options?: {
    focusAreas?: string[];
    tone?: 'professional' | 'enthusiastic' | 'confident';
    length?: 'short' | 'medium' | 'long';
  };
}

export interface ResumeGetStatusRequest {
  id: number;
}

export interface ResumeGenerateQuestionsRequest {
  id: number;
  count?: number;
  type?: QuestionType;
}

export interface ResumeDeleteRequest {
  id: number;
}

export interface FileParseRequest {
  filePath: string;
  mimeType: string;
}

export interface FileValidateRequest {
  filePath: string;
  fileName: string;
  maxSize?: number;
}

export interface DatabaseExportRequest {
  filePath?: string;
}

export interface DatabaseImportRequest {
  filePath: string;
}

export interface UserData {
  id: number;
  email: string;
  name: string;
  userType: UserType;
  createdAt: string;
  updatedAt: string;
}

export interface UserStatsData {
  totalResumes: number;
  completedResumes: number;
  processingResumes: number;
  failedResumes: number;
  totalAnalysisCount: number;
  lastActiveAt?: string;
}

export interface ParsedResumeInfo {
  name?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  skills?: string[];
  education?: Array<{
    school?: string;
    degree?: string;
    major?: string;
    period?: string;
  }>;
  experience?: Array<{
    company?: string;
    position?: string;
    period?: string;
    description?: string;
  }>;
}

export interface ResumeData {
  id: number;
  userId: number;
  originalFilename: string;
  originalPath: string;
  originalSize: number;
  originalMimetype: string;
  processedContent?: string;
  parsedInfo?: ParsedResumeInfo;
  jobDescription?: string;
  optimizationResult?: string;
  evaluation?: EvaluationResultData;
  interviewQuestions?: InterviewQuestionData[];
  status: ResumeStatus;
  createdAt: string;
  updatedAt: string;
  // 去重和版本管理相关字段
  contentHash?: string;
  personHash?: string;
  groupId?: number | null;
  isPrimary?: boolean;
  versionLabel?: string | null;
  versionNotes?: string | null;
}

export interface EvaluationResultData {
  keywordMatch: number;
  skillMatch: number;
  experienceMatch: number;
  overallScore: number;
  suggestions: string[];
  missingKeywords: string[];
}

export interface OptimizationResultData {
  optimizedContent: string;
  changes: string[];
  improvements: string[];
  score: {
    before: number;
    after: number;
  };
}

export interface InterviewQuestionData {
  question: string;
  type: QuestionType;
  category: string;
  difficulty: QuestionDifficulty;
  suggestedAnswer?: string;
}

export interface ResumeListData {
  resumes: ResumeData[];
  pagination: {
    current: number;
    pageSize: number;
    total: number;
    pages: number;
  };
}

export interface ResumeStatusData {
  status: ResumeStatus;
  progress: string;
  completedSteps: string[];
  totalSteps: string[];
  error?: string;
}

export interface FileParseResult {
  text: string;
  metadata?: {
    pageCount?: number;
    title?: string;
    author?: string;
    creationDate?: string;
    modificationDate?: string;
  };
}

export interface FileValidateResult {
  valid: boolean;
  error?: string;
  maxSize?: number;
  supportedTypes?: string[];
}

export interface DatabaseStatsData {
  totalUsers: number;
  totalResumes: number;
  totalAnalyses: number;
  databaseSize: number;
  lastBackupAt?: string;
}

export interface User extends UserData {}
export interface Resume extends ResumeData {}
export interface EvaluationResult extends EvaluationResultData {}
export interface Question extends InterviewQuestionData {
  id?: string;
}

export interface OptimizeRequest {
  resumeId: number;
  jobDescription: string;
  options?: {
    focusAreas?: string[];
    tone?: string;
    length?: 'short' | 'medium' | 'long';
  };
}

export interface OptimizeResult {
  optimizedContent: string;
  changes: string[];
  improvements: string[];
  score: {
    before: number;
    after: number;
  };
}

export interface QuestionRequest {
  resumeId: number;
  jobDescription?: string;
  questionType?: 'technical' | 'behavioral' | 'situational' | 'all';
  count?: number;
}

export interface FileParseResultLegacy {
  text: string;
  metadata?: {
    pageCount?: number;
    title?: string;
    author?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

export interface DatabaseStats {
  totalResumes: number;
  totalUsers: number;
  recentActivity: Array<{
    type: 'upload' | 'optimize' | 'evaluate';
    timestamp: Date;
    details: string;
  }>;
}

export interface UserRegisterResponse {
  userId: number;
  email: string;
  name: string;
  userType: UserType;
}

export interface UserLoginResponse {
  user: UserData;
  token?: string;
}

export interface ResumeUploadResponse extends ResumeData {}

export interface ResumeAnalyzeResponse {
  id: number;
  status: ResumeStatus;
  message?: string;
}

export interface ResumeGenerateQuestionsResponse {
  questions: InterviewQuestionData[];
  count: number;
}

// ============ 去重和版本管理相关接口 ============

/**
 * 简历组数据
 */
export interface ResumeGroupData {
  id: number;
  userId: number;
  groupName: string;
  primaryResumeId: number;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  resumes?: ResumeData[]; // 关联的简历列表
}

/**
 * 去重检测结果
 */
export interface DeduplicationResult {
  exactDuplicate?: ResumeData;      // 完全相同的文件
  samePersonResumes?: ResumeData[]; // 同一人的其他简历
  suggestedAction?: DeduplicationAction;
}

/**
 * 去重检测请求
 */
export interface DeduplicationDetectRequest {
  fileData: Uint8Array;
  filename: string;
}

/**
 * 创建简历组请求
 */
export interface CreateResumeGroupRequest {
  primaryResumeId: number;
  groupName?: string;
  description?: string;
}

/**
 * 添加简历变体请求
 */
export interface AddResumeVariantRequest {
  groupId: number;
  resumeId: number;
  versionLabel?: string;
  versionNotes?: string;
}

/**
 * 设置主简历请求
 */
export interface SetPrimaryResumeRequest {
  groupId: number;
  resumeId: number;
}

/**
 * 获取简历版本历史请求
 */
export interface GetResumeVersionsRequest {
  groupId: number;
}

/**
 * 合并简历组请求
 */
export interface MergeResumeGroupsRequest {
  targetGroupId: number;
  sourceGroupId: number;
}

/**
 * 删除简历组请求
 */
export interface DeleteResumeGroupRequest {
  groupId: number;
  keepPrimaryResume?: boolean; // 是否保留主简历，默认 true
}

// ============ AI HR Assistant 相关接口 ============

/**
 * AI HR 助手消息
 */
export interface AIHRAssistantMessage {
  id: number;
  resumeId: number;
  userId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageType: 'chat' | 'suggestion' | 'analysis';
  metadata?: {
    type?: string;
    referencedPart?: string;
    confidence?: number;
    suggestions?: string[];
  };
  tokenCount?: number;
  isSummary?: boolean;
  createdAt: string;
}

/**
 * 发送消息请求（前端只需传递 resumeId 和 message）
 */
export interface AIHRAssistantSendMessageRequest {
  resumeId: number;
  message: string;
}

/**
 * 发送消息响应
 */
export interface AIHRAssistantSendMessageResponse {
  message: AIHRAssistantMessage;
}

/**
 * 流式消息推送结构（从主进程到渲染进程）
 */
export interface AIHRAssistantStreamChunk {
  resumeId: number;
  messageId: number; // 正在生成的消息ID
  chunk: string; // 文本块
  isComplete: boolean; // 是否完成
  finalMessage?: AIHRAssistantMessage; // 完成后的完整消息
}

/**
 * 获取对话历史请求
 */
export interface AIHRAssistantGetHistoryRequest {
  resumeId: number;
  limit?: number;
}

/**
 * 获取获取对话历史响应
 */
export interface AIHRAssistantGetHistoryResponse {
  messages: AIHRAssistantMessage[];
  total: number;
}

/**
 * 清空对话历史请求
 */
export interface AIHRAssistantClearHistoryRequest {
  resumeId: number;
}

/**
 * 生成智能建议请求
 */
export interface AIHRAssistantGenerateSuggestionRequest {
  resumeId: number;
  type?: 'improvement' | 'interview' | 'career' | 'all';
}

/**
 * 生成智能建议响应
 */
export interface AIHRAssistantGenerateSuggestionResponse {
  suggestion: string;
  category: string;
}

/**
 * 简历上下文（用于 AI HR 助手）
 */
export interface ResumeContext {
  // 基本信息
  resumeId: number;
  userId: number;
  jobDescription?: string;

  // 候选人信息（从解析中获取）
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  candidateAddress?: string;

  // 教育背景
  educations: Array<{
    school?: string;
    degree?: string;
    major?: string;
    period?: string;
    description?: string;
  }>;

  // 技能
  skills: string[];

  // 工作经历
  experiences: Array<{
    company?: string;
    position?: string;
    period?: string;
    description?: string;
  }>;

  // 评估结果
  evaluation?: {
    overallScore: number;
    keywordMatch: number;
    skillMatch: number;
    experienceMatch: number;
    suggestions: string[];
    missingKeywords: string[];
  };

  // 面试问题
  interviewQuestions?: Array<{
    question: string;
    type: string;
    category: string;
    difficulty: string;
  }>;
}
