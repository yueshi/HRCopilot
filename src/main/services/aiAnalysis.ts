import { logger } from '../utils/logger';
import { database } from '../database/sqlite';
import { llmProviderController } from '../controllers/LLMProviderController';

/**
 * AI 分析请求接口
 */
export interface AnalyzeResumeRequest {
  resumeContent: string;
  jobDescription: string;
}

/**
 * 流式回调接口
 */
export interface StreamCallback {
  (chunk: string): void;
}

/**
 * HR 助手请求接口
 */
export interface HRAssistantRequest {
  resumeId: number;
  userId: number;
  message: string;
  context?: string;
  model?: string;
}

/**
 * HR 助手请求接口（流式）
 */
export interface HRAssistantStreamRequest extends HRAssistantRequest {
  onChunk?: StreamCallback;
}

/**
 * 获取建议请求接口
 */
export interface GenerateSuggestionRequest {
  resumeId: number;
  userId: number;
  type?: 'question' | 'analysis' | 'evaluation';
}

/**
 * 对话消息接口
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
 * 使用配置的 LLM 供应商进行简历分析和面试问题生成
 */
export class AIAnalysisService {
  // 默认 API 配置（作为后备）
  private defaultApiUrl: string;
  private defaultApiKey: string;

  constructor() {
    // base_url 应该是基础地址，不包含 /chat/completions 端点
    this.defaultApiUrl = process.env.GLM_API_URL || 'https://open.bigmodel.cn/api/paas/v4';
    this.defaultApiKey = process.env.GLM_API_KEY || '';
  }

  /**
   * 获取可用的 LLM 供应商配置
   */
  private async getLLMConfig(): Promise<{ apiUrl: string; apiKey: string; model: string }> {
    try {
      const provider = await database.getDefaultLLMProviderFull();
      if (provider && provider.is_enabled && provider.api_key) {
        return {
          apiUrl: provider.base_url,
          apiKey: provider.api_key,
          model: provider.models?.[0] || 'glm-4',
        };
      }
    } catch (error) {
      logger.warn('获取 LLM 供应商配置失败，使用默认配置:', error);
    }

    // 回退到环境变量配置
    return {
      apiUrl: this.defaultApiUrl,
      apiKey: this.defaultApiKey,
      model: 'glm-4',
    };
  }

  /**
   * 构建对话上下文提示词
   */
  private buildContextPrompt(context?: string): string {
    if (!context) {
      return '';
    }
    return `以下是相关的上下文信息，请参考这些信息回答：

${context}

---
`;
  }

  /**
   * 构建 HR 助手系统提示词
   */
  private buildHRSystemPrompt(): string {
    return `你是一位专业的 HR 助手，专门帮助 HR 分析候选人简历、提供面试建议、回答招聘相关问题。

你的职责包括：
1. 分析候选人简历与职位要求的匹配度
2. 生成针对性的面试问题
3. 提供招聘建议和最佳实践
4. 回答 HR 相关的专业问题

请以专业、客观、有用的方式回答。`;
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
   * 分析 HR 查询（同步）
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
   * HR 助手对话（流式）
   */
  async streamHRAssistantQuery(request: HRAssistantStreamRequest): Promise<string> {
    try {
      // 获取对话历史作为上下文
      const conversationHistory = await database.getLastNConversations({
        resumeId: request.resumeId,
        userId: request.userId,
        count: 10, // 获取最近10条消息作为上下文
      });

      // 构建消息列表
      const messages: ConversationMessage[] = [
        { role: 'system', content: this.buildHRSystemPrompt() },
        ...conversationHistory,
        { role: 'user', content: request.message },
      ];

      // 获取 LLM 配置
      const config = await this.getLLMConfig();

      // 调用流式 API
      const response = await this.streamGLM(messages, config, request.onChunk);

      // 保存用户消息到数据库
      await database.insertConversation({
        resumeId: request.resumeId,
      userId: request.userId,
        role: 'user',
        content: request.message,
        messageType: 'chat',
      });

      // 保存助手回复到数据库
      await database.insertConversation({
        resumeId: request.resumeId,
        userId: request.userId,
        role: 'assistant',
        content: response,
        messageType: 'chat',
      });

      return response;
    } catch (error) {
      logger.error('HR 助手流式查询失败:', error);
      throw new Error(`HR 助手查询失败: ${(error as Error).message}`);
    }
  }

  /**
   * 生成智能建议
   */
  async generateHRAssistantSuggestion(request: GenerateSuggestionRequest): Promise<string> {
    try {
      // 获取简历信息
      const resume = await database.getResumeById(request.resumeId);
      if (!resume) {
        throw new Error('简历不存在');
      }

      // 根据类型生成不同的提示词
      let prompt = '';
      switch (request.type) {
        case 'question':
          prompt = `基于以下简历内容，请生成3-5个有针对性的面试问题建议：

简历内容：
${resume.processed_content || '无解析内容'}

请提供具体的面试问题，每个问题一行。`;
          break;

        case 'analysis':
          prompt = `基于以下简历内容，请提供2-3个可能想要询问的分析问题建议：

简历内容：
${resume.processed_content || '无解析内容'}

请提供用户可能感兴趣的分析问题。`;
          break;

        case 'evaluation':
        default:
          prompt = `基于以下简历内容，请提供2-3个可能想要询问的评估问题建议：

简历内容：
${resume.processed_content || '无解析内容'}
职位描述：
${resume.job_description || '无'}

请提供用户可能感兴趣的评估问题。`;
          break;
      }

      // 获取 LLM 配置
      const config = await this.getLLMConfig();

      const response = await this.callGLMWithConfig(prompt, config);

      // 保存建议到数据库
      await database.insertConversation({
        resumeId: request.resumeId,
        userId: request.userId,
        role: 'system',
        content: response,
        messageType: 'suggestion',
      });

      return response;
    } catch (error) {
      logger.error('生成 HR 助手建议失败:', error);
      throw new Error(`生成建议失败: ${(error as Error).message}`);
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
   * 调用 GLM API（带配置）
   */
  private async callGLMWithConfig(
    prompt: string,
    config: { apiUrl: string; apiKey: string; model: string }
  ): Promise<string> {
    if (!config.apiKey) {
      throw new Error('API Key 未配置');
    }

    try {
      // 构建完整的 API URL，添加 /chat/completions 端点
      const fullApiUrl = config.apiUrl.endsWith('/chat/completions')
        ? config.apiUrl
        : `${config.apiUrl}/chat/completions`;

      const response = await fetch(fullApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
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
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      logger.error('API 调用失败:', error);
      throw error;
    }
  }

  /**
   * 调用 GLM API（兼容旧代码）
   */
  private async callGLM(prompt: string): Promise<string> {
    const config = await this.getLLMConfig();
    return this.callGLMWithConfig(prompt, config);
  }

  /**
   * 流式调用 LLM API
   */
  private async streamGLM(
    messages: ConversationMessage[],
    config: { apiUrl: string; apiKey: string; model: string },
    onChunk?: StreamCallback
  ): Promise<string> {
    if (!config.apiKey) {
      throw new Error('API Key 未配置');
    }

    try {
      // 构建完整的 API URL，添加 /chat/completions 端点
      const fullApiUrl = config.apiUrl.endsWith('/chat/completions')
        ? config.apiUrl
        : `${config.apiUrl}/chat/completions`;

      const response = await fetch(fullApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          temperature: 0.3,
          max_tokens: 2000,
          stream: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                if (onChunk) {
                  onChunk(content);
                }
              }
            } catch (e) {
              // 忽略解析错误，继续处理
            }
          }
        }
      }

      return fullResponse;
    } catch (error) {
      logger.error('流式 API 调用失败:', error);
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
