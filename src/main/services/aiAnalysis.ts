import { logger } from '../utils/logger';

/**
 * AI 分析请求接口
 */
export interface AnalyzeResumeRequest {
  resumeContent: string;
  jobDescription: string;
}

/**
 * AI 分析结果接口
 */
export interface AnalyzeResumeResult {
  evaluation: {
    keywordMatch: number;
    skillMatch: number;
    experienceMatch: number;
    overallScore: number;
    suggestions: string[];
    missingKeywords: string[];
  };
}

/**
 * 生成面试问题请求
 */
export interface GenerateInterviewQuestionsRequest {
  resumeContent: string;
  jobDescription: string;
  questionType?: 'technical' | 'behavioral' | 'situational' | 'all';
  count?: number;
}

/**
 * 面试问题接口
 */
export interface InterviewQuestion {
  id: string;
  question: string;
  type: 'technical' | 'behavioral' | 'situational';
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  suggestedAnswer?: string;
}

/**
 * AI 分析服务
 * 使用 GLM 4.6 进行简历分析和面试问题生成
 */
export class AIAnalysisService {
  private apiUrl: string;
  private apiKey: string;

  constructor() {
    this.apiUrl = process.env.GLM_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    this.apiKey = process.env.GLM_API_KEY || '';
  }

  /**
   * 分析简历与职位的匹配度
   */
  async analyzeResume(request: AnalyzeResumeRequest): Promise<AnalyzeResumeResult> {
    try {
      const prompt = this.buildAnalysisPrompt(request.resumeContent, request.jobDescription);

      const response = await this.callGLM(prompt);

      // 解析 AI 返回的结果
      const evaluation = this.parseEvaluationResponse(response);

      return { evaluation };
    } catch (error) {
      logger.error('AI 分析失败:', error);
      throw new Error(`AI 分析失败: ${(error as Error).message}`);
    }
  }

  /**
   * 分析 HR 查询
   */
  async analyzeHRQuery(request: any): Promise<any> {
    try {
      const prompt = `请作为专业的 HR 助手，回答以下问题或提供建议。

用户提问: ${request.message || ''}
上下文信息: ${request.context ? JSON.stringify(request.context) : '无'}

请提供专业、实用的建议或回答。`;

      const response = await this.callGLM(prompt);
      return {
        response,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('HR 查询分析失败:', error);
      throw new Error(`HR 查询分析失败: ${(error as Error).message}`);
    }
  }

  /**
   * 生成面试问题
   */
  async generateInterviewQuestions(request: GenerateInterviewQuestionsRequest): Promise<InterviewQuestion[]> {
    try {
      const prompt = this.buildQuestionsPrompt(
        request.resumeContent,
        request.jobDescription,
        request.questionType || 'all',
        request.count || 10
      );

      const response = await this.callGLM(prompt);

      return this.parseQuestionsResponse(response);
    } catch (error) {
      logger.error('生成面试问题失败:', error);
      throw new Error(`生成面试问题失败: ${(error as Error).message}`);
    }
  }

  /**
   * 调用 GLM API
   */
  private async callGLM(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GLM API Key 未配置');
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'glm-4.6',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`GLM API 请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      logger.error('GLM API 调用失败:', error);
      throw error;
    }
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(resumeContent: string, jobDescription: string): string {
    return `请分析以下简历与职位描述的匹配度。

职位描述 (JD):
${jobDescription}

简历内容:
${resumeContent}

请以 JSON 格式返回分析结果，包含以下字段:
{
  "keywordMatch": 数字 (0-100),
  "skillMatch": 数字 (0-100),
  "experienceMatch": 数字 (0-100),
  "overallScore": 数字 (0-100),
  "suggestions": ["建议1", "建议2", ...],
  "missingKeywords": ["缺失关键词1", "缺失关键词2", ...]
}`;
  }

  /**
   * 构建面试问题提示词
   */
  private buildQuestionsPrompt(
    resumeContent: string,
    jobDescription: string,
    questionType: string,
    count: number
  ): string {
    return `根据以下职位描述和简历，生成 ${count} 个面试问题。

职位描述 (JD):
${jobDescription}

简历内容:
${resumeContent}

问题类型: ${questionType}

请以 JSON 数组格式返回问题，每个问题包含:
{
  "id": "唯一ID",
  "question": "问题内容",
  "type": "technical/behavioral/situational",
  "category": "问题分类",
  "difficulty": "easy/medium/hard",
  "suggestedAnswer": "建议答案（可选）"
}`;
  }

  /**
   * 解析评估结果
   */
  private parseEvaluationResponse(response: string): AnalyzeResumeResult['evaluation'] {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('无法解析 AI 响应');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        keywordMatch: parsed.keywordMatch || 0,
        skillMatch: parsed.skillMatch || 0,
        experienceMatch: parsed.experienceMatch || 0,
        overallScore: parsed.overallScore || 0,
        suggestions: parsed.suggestions || [],
        missingKeywords: parsed.missingKeywords || []
      };
    } catch (error) {
      logger.error('解析评估结果失败:', error);
      // 返回默认值
      return {
        keywordMatch: 0,
        skillMatch: 0,
        experienceMatch: 0,
        overallScore: 0,
        suggestions: [],
        missingKeywords: []
      };
    }
  }

  /**
   * 解析面试问题结果
   */
  private parseQuestionsResponse(response: string): InterviewQuestion[] {
    try {
      // 尝试提取 JSON 数组
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('无法解析 AI 响应');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return (parsed || []).map((q: any) => ({
        id: q.id || `q_${Date.now()}_${Math.random()}`,
        question: q.question || '',
        type: q.type || 'technical',
        category: q.category || '通用',
        difficulty: q.difficulty || 'medium',
        suggestedAnswer: q.suggestedAnswer
      }));
    } catch (error) {
      logger.error('解析面试问题失败:', error);
      return [];
    }
  }
}

// 导出单例
export const aiAnalysisService = new AIAnalysisService();
