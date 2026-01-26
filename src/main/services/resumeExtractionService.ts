import { llmService } from './LLMService';
import { logger } from '../utils/logger';
import type { LLMMessage, LLMTaskName } from '../../shared/types/llm';

export interface ExtractedResumeInfo {
  name?: string;
  gender?: string;
  birthYear?: string;
  phone?: string;
  email?: string;
  address?: string;
  expectedSalary?: string;
  workYears?: string;
  skills: string[];
  languages?: string[];
  education: Array<{
    school?: string;
    degree?: string;
    major?: string;
    period?: string;
  }>;
  experience: Array<{
    company?: string;
    position?: string;
    period?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  projects?: Array<{
    name?: string;
    role?: string;
    period?: string;
    description?: string;
    technologies?: string[];
  }>;
  certifications?: string[];
  honors?: string[];
  selfAssessment?: string;
}

export interface ExtractOptions {
  useAI?: boolean;
  fallbackToRegex?: boolean;
}

export class ResumeExtractionService {
  private static instance: ResumeExtractionService;
  private readonly processingResumes = new Set<number>();

  private constructor() {}

  static getInstance(): ResumeExtractionService {
    if (!ResumeExtractionService.instance) {
      ResumeExtractionService.instance = new ResumeExtractionService();
    }
    return ResumeExtractionService.instance;
  }

  async extractResume(
    resumeContent: string,
    options: ExtractOptions = {}
  ): Promise<ExtractedResumeInfo> {
    const useAI = options.useAI ?? true;
    const fallbackToRegex = options.fallbackToRegex ?? true;

    if (useAI) {
      try {
        const result = await this.extractResumeWithAI(resumeContent);
        if (result) {
          return result;
        }
      } catch (error) {
        logger.warn('AI 提取失败，尝试降级方案:', error);
      }
    }

    if (fallbackToRegex) {
      return this.fallbackExtract(resumeContent);
    }

    throw new Error('简历提取失败');
  }

  private async extractResumeWithAI(
    resumeContent: string
  ): Promise<ExtractedResumeInfo | null> {
    const prompt = this.buildExtractionPrompt(resumeContent);

    try {
      const response = await llmService.call({
        task_name: 'resume_analysis' as LLMTaskName,
        messages: [
          {
            role: 'system',
            content: '你是一个专业的简历解析专家。请从简历文本中提取结构化信息，并以 JSON 格式返回。',
          } as LLMMessage,
          {
            role: 'user',
            content: prompt,
          } as LLMMessage,
        ],
        parameters: {
          temperature: 0.3,
        },
      });

      if (!response) {
        throw new Error('LLM 服务未返回响应');
      }

      logger.info('LLM 原始响应:', {
        responseType: typeof response,
        hasContent: 'content' in response,
        hasResponse: 'response' in response,
        keys: Object.keys(response),
      });

      let content = '';

      if ((response as any).content) {
        content = (response as any).content;
      } else if ((response as any).response?.content) {
        content = (response as any).response.content;
      }

      if (!content) {
        throw new Error('LLM 响应内容为空，无法提取');
      }

      logger.info('LLM 响应内容提取:', {
        contentLength: content.length,
        contentPreview: content.substring(0, 200),
      });

      const result = this.parseLLMResponse(content);
      return this.validateAndCleanData(result);
    } catch (error) {
      logger.error('AI 提取简历失败:', error);
      return null;
    }
  }

  private buildExtractionPrompt(resumeContent: string): string {
    return (
      '请从以下简历文本中提取结构化信息，并以 JSON 格式返回：' +
      '\n\n' +
      '必需字段：' +
      '\n- name: 姓名' +
      '- email: 邮箱' +
      '- phone: 电话号码' +
      '- skills: 技能列表（数组）' +
      '- education: 教育经历数组，每个元素包含 school, degree, major, period' +
      '- experience: 工作经历数组，每个元素包含 company, position, startDate, endDate, period, description' +
      '\n\n' +
      '可选字段：' +
      '\n- gender: 性别' +
      '- birthYear: 出生年' +
      '- address: 地址' +
      '- expectedSalary: 期望薪资' +
      '- workYears: 工作年限' +
      '- languages: 语言能力数组' +
      '- projects: 项目经验数组，每个元素包含 name, role, period, description, technologies' +
      '- certifications: 证书数组' +
      '- honors: 荣誉奖项数组' +
      '- selfAssessment: 自我评价' +
      '\n\n' +
      '简历内容：' +
      '\n' +
      resumeContent +
      '\n\n' +
      '请只返回 JSON 对象，不要包含其他解释文字。'
    );
  }

  private parseLLMResponse(response: string): any {
    try {
      const result = JSON.parse(response);
      logger.info('直接 JSON 解析成功');
      return result;
    } catch (directError) {
      logger.info('直接解析失败，尝试提取代码块', {
        error: (directError as Error).message,
      });
    }

    const codeBlockStart = '```json';
    const codeBlockEnd = '```';
    const startIndex = response.indexOf(codeBlockStart);
    const endIndex = response.lastIndexOf(codeBlockEnd);

    if (startIndex >= 0 && endIndex > startIndex + codeBlockStart.length) {
      const jsonContent = response
        .substring(startIndex + codeBlockStart.length, endIndex)
        .trim();
      logger.info('提取到的 JSON 代码块内容:', {
        length: jsonContent.length,
        preview: jsonContent.substring(0, 200),
      });

      try {
        const parsed = JSON.parse(jsonContent);
        logger.info('代码块解析成功');
        return parsed;
      } catch (codeBlockError) {
        logger.warn('代码块内容解析失败', {
          error: (codeBlockError as Error).message,
        });
      }
    }

    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const jsonStr = response.substring(firstBrace, lastBrace + 1);
      logger.info('提取到大括号内容:', {
        length: jsonStr.length,
        preview: jsonStr.substring(0, 200),
      });

      try {
        const parsed = JSON.parse(jsonStr);
        logger.info('大括号内容解析成功');
        return parsed;
      } catch (braceError) {
        logger.warn('大括号内容解析失败', {
          error: (braceError as Error).message,
        });
      }
    }

    logger.error('无法解析 LLM 响应为 JSON，响应内容:', {
      responseLength: response.length,
      responsePreview: response.substring(0, 500),
      first100Chars: response.substring(0, 100),
      last100Chars: response.substring(Math.max(0, response.length - 100)),
    });

    throw new Error('无法解析 LLM 响应为 JSON');
  }

  private validateAndCleanData(data: any): ExtractedResumeInfo {
    const result: ExtractedResumeInfo = {
      skills: data.skills || [],
      education: Array.isArray(data.education) ? data.education : [],
      experience: Array.isArray(data.experience) ? data.experience : [],
    };

    if (data.name) {
      result.name = this.normalizeString(data.name);
    }
    if (data.gender) {
      result.gender = this.normalizeString(data.gender);
    }
    if (data.birthYear) {
      result.birthYear = this.normalizeString(data.birthYear);
    }
    if (data.phone) {
      result.phone = this.normalizePhone(data.phone);
    }
    if (data.email) {
      result.email = this.normalizeEmail(data.email);
    }
    if (data.address) {
      result.address = this.normalizeString(data.address);
    }
    if (data.expectedSalary) {
      result.expectedSalary = this.normalizeString(data.expectedSalary);
    }
    if (data.workYears) {
      result.workYears = this.normalizeString(data.workYears);
    }
    if (data.languages && Array.isArray(data.languages)) {
      result.languages = data.languages.map((s: any) => this.normalizeString(s));
    }
    if (data.projects && Array.isArray(data.projects)) {
      result.projects = data.projects.map((p: any) => ({
        name: p.name ? this.normalizeString(p.name) : undefined,
        role: p.role ? this.normalizeString(p.role) : undefined,
        period: p.period ? this.normalizePeriod(p.period) : undefined,
        description: p.description ? this.normalizeString(p.description) : undefined,
        technologies: Array.isArray(p.technologies)
          ? p.technologies.map((t: any) => this.normalizeString(t))
          : undefined,
      }));
    }
    if (data.certifications && Array.isArray(data.certifications)) {
      result.certifications = data.certifications.map((s: any) => this.normalizeString(s));
    }
    if (data.honors && Array.isArray(data.honors)) {
      result.honors = data.honors.map((s: any) => this.normalizeString(s));
    }
    if (data.selfAssessment) {
      result.selfAssessment = this.normalizeString(data.selfAssessment);
    }

    result.education = result.education.map((e: any) => ({
      school: e.school ? this.normalizeString(e.school) : undefined,
      degree: e.degree ? this.normalizeString(e.degree) : undefined,
      major: e.major ? this.normalizeString(e.major) : undefined,
      period: e.period ? this.normalizePeriod(e.period) : undefined,
    }));

    result.experience = result.experience.map((e: any) => ({
      company: e.company ? this.normalizeString(e.company) : undefined,
      position: e.position ? this.normalizeString(e.position) : undefined,
      period: e.period ? this.normalizePeriod(e.period) : undefined,
      startDate: e.startDate ? this.normalizeString(e.startDate) : undefined,
      endDate: e.endDate ? this.normalizeString(e.endDate) : undefined,
      description: e.description ? this.normalizeString(e.description) : undefined,
    }));

    return result;
  }

  private normalizeString(value: any): string {
    if (!value || typeof value !== 'string') {
      return '';
    }
    return value.trim();
  }

  private normalizePhone(value: any): string | undefined {
    if (!value || typeof value !== 'string') {
      return undefined;
    }
    const cleaned = value.replace(/\D/g, '');
    if (this.isValidPhone(cleaned)) {
      return cleaned;
    }
    return undefined;
  }

  private isValidPhone(phone: string): boolean {
    return /^1[3-9]\d{9}$/.test(phone);
  }

  private normalizeEmail(value: any): string | undefined {
    if (!value || typeof value !== 'string') {
      return undefined;
    }
    const cleaned = value.trim().toLowerCase();
    if (this.isValidEmail(cleaned)) {
      return cleaned;
    }
    return undefined;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private normalizePeriod(value: any): string | undefined {
    if (!value || typeof value !== 'string') {
      return undefined;
    }
    const cleaned = value.trim();
    if (cleaned.length > 0) {
      return cleaned;
    }
    return undefined;
  }

  private fallbackExtract(resumeContent: string): ExtractedResumeInfo {
    const result: ExtractedResumeInfo = {
      skills: [],
      education: [],
      experience: [],
    };

    const namePatterns = [
      /(?:姓名|Name)[:\s]*([^\s\n,]+)/i,
      /^([^\s\n,，]{2,4})\s*(?:性别|男|女|出生|电话|手机|邮箱)/m,
    ];
    for (const pattern of namePatterns) {
      const match = resumeContent.match(pattern);
      if (match && match[1]) {
        result.name = this.normalizeString(match[1]);
        break;
      }
    }

    const phonePattern = /(?:电话|手机|Phone|Mobile|Tel)[:\s]*(1[3-9]\d{9,10})/i;
    const phoneMatch = resumeContent.match(phonePattern);
    if (phoneMatch && phoneMatch[1]) {
      result.phone = this.normalizePhone(phoneMatch[1]);
    }

    const emailPattern = /[\w.-]+@[\w.-]+\.\w+/i;
    const emailMatch = resumeContent.match(emailPattern);
    if (emailMatch && emailMatch[0]) {
      result.email = this.normalizeEmail(emailMatch[0]);
    }

    const skillKeywords = [
      'JavaScript',
      'TypeScript',
      'Python',
      'Java',
      'Cplus',
      'Csharp',
      'Go',
      'Rust',
      'React',
      'Vue',
      'Angular',
      'Node.js',
      'Express',
      'Spring Boot',
      'MySQL',
      'PostgreSQL',
      'MongoDB',
      'Redis',
      'Docker',
      'Kubernetes',
      'Git',
      'Linux',
      'AWS',
      'Azure',
      'GCP',
    ];
    const foundSkills = skillKeywords.filter((skill) => {
      try {
        return new RegExp(skill, 'i').test(resumeContent);
      } catch {
        return false;
      }
    });
    result.skills = [...new Set(foundSkills)];

    logger.info('使用正则降级提取完成', {
      name: result.name,
      email: result.email,
      phone: result.phone,
      skillsCount: result.skills.length,
    });

    return result;
  }
}

export const resumeExtractionService = ResumeExtractionService.getInstance();
