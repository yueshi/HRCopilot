# AI HR 助手功能设计文档 v2.0

## 1. 功能概述

AI HR 助手是一个智能对话助手，用户在选择某份简历后，可以与AI助手进行交互式对话。AI助手基于职位描述（JD）和简历的详细信息（个人信息、技能、项目经历、教育背景等）提供智能分析和建议。

## 2. 核心需求

1.**上下文感知对话**：AI助手只考虑当前选中的简历及其JD
2. **多维度分析**：涵盖简历匹配度、技能亮点、改进建议、面试准备等
3. **智能建议**：主动提供简历优化建议、面试技巧、行业洞察
4. **对话历史**：保存对话历史，支持上下文连续对话
5. **流式响应**：支持打字机效果，提升用户体验
6. **智能上下文压缩**：自动压缩长对话历史，避免token超限

## 3. 技术架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         渲染进程 (Renderer)                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  AIHRAssistant组件                          │ │
│  │  - 聊天界面显示                                             │ │
│  │  - 用户输入处理                                             │ │
│  │  - 消息渲染（支持流式）                                     │ │
│  └──────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                     │                                          │ │
│  ┌──────────────────▼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  aiHrAssistantStore.ts (Zustand)                            │ │
│  │  - 对话历史管理                                             │ │
│  │  - 流式消息处理                                             │ │
│  │  - 加载/发送消息状态                                        │ │
│  └──────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                     │                                          │ │
│  ┌──────────────────▼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  aiHrAssistantIpcService.ts                               │ │
│  │  - sendMessage(resumeId, message)  [注意：只需传递ID和消息] │ │
│  │  - getHistory(resumeId)                                     │ │
│  │  - clearHistory(resumeId)                                    │ │
│  │  - onStreamMessage(resumeId, callback)  [流式响应回调]        │ │
│  └──────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                       │
                       │ IPC 通信
                       │
┌──────────────────────▼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                      Preload 层                                │
│  - 新增 AI_HR_ASSISTANT 通道                                    │ │
│  - 支持 IPC Renderer (流式通信)                                    │ │
└──────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                       │
                       │ IPC 通信
                       │
┌──────────────────────▼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                      主进程 (Main)                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  AIHRAssistantHandler                                      │ │
│  │  - handleSendMessage(resumeId, message)  [从数据库获取简历数据]     │ │
│  │  - handleGetHistory(resumeId)                                │ │
│  │  - handleClearHistory(resumeId)                              │ │
│  └──────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                     │                                          │ │
│  ┌──────────────────▼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  AIHRAssistantService                                       │ │
│  │  - 从数据库构建 ResumeContext                                │ │
│  │  - 智能上下文压缩                                           │ │
│  │  - 流式调用 GLM API                                        │ │
│  └──────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                     │                                          │ │
│  ┌──────────────────▼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  ResumeParserService (新增)                                  │ │
│  │  - parseResumeContent(text) → ParsedResumeInfo                 │ │
│  │  - 从 processed_content 解析结构化数据                           │ │
│  └──────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                     │                                          │ │
│  ┌──────────────────▼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  SQLite数据库                                              │ │
│  │  - ai_conversations表 (对话消息存储)                        │ │
│  │  - resumes表 (简历数据)                                     │ │
│  └───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 数据流（优化后）

1. 用户选择简历 → 渲染进程显示简历详情
2. 用户打开AI助手 → 发送 `getHistory(resumeId)` 获取历史对话
3. 用户发送消息 → 发送 `sendMessage(resumeId, message)`
4. **主进程从数据库获取完整简历数据**（修复点：不从前端传递）
5. 主进程解析 `processed_content` 为结构化数据（新增解析服务）
6. 主进程构建上下文（JD + 解析后的简历信息 + 压缩后的历史）→ 调用GLM API
7. AI流式返回响应 → 通过 IPC Renderer 推送到前端 → 实时更新界面
8. 响应完成后 → 保存完整消息到数据库

## 4. 数据库设计

### 4.1 新增表：ai_conversations

```sql
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resume_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'suggestion', 'analysis')),
  metadata TEXT,  -- JSON格式的额外信息
  token_count INTEGER,  -- 消息的token数（用于压缩）
  is_summary INTEGER DEFAULT 0,  -- 是否为压缩摘要
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_ai_conversations_resume_id ON ai_conversations(resume_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations(created_at);
```

## 5. IPC 通道定义

### 5.1 通道定义（src/shared/types/ipc.ts）

```typescript
// ============ AI HR Assistant 相关 ============
AI_HR_ASSISTANT: {
  SEND_MESSAGE: 'ai-hr-assistant:send-message',      // 发送消息
  STREAM_MESSAGE: 'ai-hr-assistant:stream-message',  // 流式消息推送（从主进程到渲染进程）
  GET_HISTORY: 'ai-hr-assistant:get-history',         // 获取对话历史
  CLEAR_HISTORY: 'ai-hr-assistant:clear-history',     // 清空对话历史
  GENERATE_SUGGESTION: 'ai-hr-assistant:generate-suggestion', // 生成智能建议
},
```

### 5.2 API类型定义（src/shared/types/api.ts）

```typescript
// AI HR Assistant 相关接口
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

// 请求：前端只需传递 resumeId 和 message（修复点）
export interface AIHRAssistantSendMessageRequest {
  resumeId: number;
  message: string;
}

// 响应：完整的消息数据
export interface AIHRAssistantSendMessageResponse {
  message: AIHRAssistantMessage;
}

// 流式消息推送结构（从主进程到渲染进程）
export interface AIHRAssistantStreamChunk {
  resumeId: number;
  messageId: number;  // 正在生成的消息ID
  chunk: string;       // 文本块
  isComplete: boolean; // 是否完成
  finalMessage?: AIHRAssistantMessage;  // 完成后的完整消息
}

export interface AIHRAssistantGetHistoryRequest {
  resumeId: number;
  limit?: number;
}

export interface AIHRAssistantGetHistoryResponse {
  messages: AIHRAssistantMessage[];
  resumeId: number;
  total: number;
}

export interface AIHRAssistantClearHistoryRequest {
  resumeId: number;
}

export interface AIHRAssistantGenerateSuggestionRequest {
  resumeId: number;
  type?: 'improvement' | 'interview' | 'career' | 'all';
}

export interface AIHRAssistantGenerateSuggestionResponse {
  suggestion: string;
  category: string;
  actionable: boolean;
}
```

## 6. 服务层设计

### 6.1 ResumeParserService（新增）

位置：`src/main/services/resumeParserService.ts`

**作用**：从 `processed_content`（纯文本）中解析出结构化的候选人信息

```typescript
/**
 * 简历解析服务
 * 从 processed_content 文本中提取结构化信息
 */
export class ResumeParserService {
  /**
   * 解析简历内容
   */
  static parseResumeContent(content: string): ParsedResumeInfo {
    const result: ParsedResumeInfo = {
      name: undefined,
      gender: undefined,
      phone: undefined,
      email: undefined,
      address: undefined,
      skills: [],
      education: [],
      experience: [],
    };

    const lines = content.split('\n');
    let currentSection = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 检测章节
      if (this.isEducationSection(line)) {
        currentSection = 'education';
        continue;
      }
      if (this.isExperienceSection(line)) {
        currentSection = 'experience';
        continue;
      }
      if (this.isSkillsSection(line)) {
        currentSection = 'skills';
        continue;
      }

      // 提取基本信息
      if (!result.name && this.mightBeName(line)) {
        result.name = line;
      }
      if (!result.email) {
        const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) result.email = emailMatch[0];
      }
      if (!result.phone) {
        const phoneMatch = line.match(/1[3-9]\d{9}|\d{3,4}-\d{7,8}/);
        if (phoneMatch) result.phone = phoneMatch[0];
      }

      // 根据当前章节解析内容
      switch (currentSection) {
        case 'education':
          this.parseEducationLine(line, result.education);
          break;
        case 'experience':
          this.parseExperienceLine(line, result.experience);
          break;
        case 'skills':
          this.parseSkillsLine(line, result.skills);
          break;
      }
    }

    return result;
  }

  private static isEducationSection(line: string): boolean {
    return /教育|学历|学校|毕业/i.test(line);
  }

  private static isExperienceSection(line: string): boolean {
    return /工作|经历|实习|公司/i.test(line);
  }

  private static isSkillsSection(line: string): boolean {
    return /技能|能力|专长/i.test(line);
  }

  private static mightBeName(line: string): boolean {
    // 简单判断：2-4个中文字符，且不包含特殊符号
    return /^[\u4e00-\u9fa5]{2,4}$/.test(line);
  }

  private static parseEducationLine(line: string, educations: any[]): void {
    // 简化的教育经历解析逻辑
    if (line.length > 3) {
      educations.push({ description: line });
    }
  }

  private static parseExperienceLine(line: string, experiences: any[]): void {
    if (line.length > 3) {
      experiences.push({ description: line });
    }
  }

  private static parseSkillsLine(line: string, skills: string[]): void {
    // 提取技能关键词
    const keywords = line.split(/[,，、;；|]/);
    keywords.forEach(kw => {
      const skill = kw.trim();
      if (skill && skill.length > 1 && !skills.includes(skill)) {
        skills.push(skill);
      }
    });
  }
}
```

### 6.2 AIHRAssistantService（优化）

位置：`src/main/services/aiHrAssistantService.ts`

**优化点**：
1. 从数据库获取简历数据（不再依赖前端传递）
2. 使用 ResumeParserService 解析简历
3. 智能上下文压缩
4. 流式响应支持

```typescript
import { database } from '../database/sqlite';
import { ResumeParserService } from './resumeParserService';

/**
 * AI HR 助手服务
 */
export class AIHRAssistantService {
  private readonly MAX_CONTEXT_TOKENS = 2500;  // 上下文最大token数
  private readonly RESERVE_TOKENS = 500;       // 预留token给系统提示词和响应

  /**
   * 从数据库构建 ResumeContext（关键优化：不依赖前端传递）
   */
  private async buildResumeContext(
    userId: number,
    resumeId: number
  ): Promise<ResumeContext> {
    // 1. 从数据库获取完整简历数据
    const resume = await database.getResumeById(resumeId);

    if (!resume) {
      throw new Error('简历不存在');
    }

    if (resume.user_id !== userId) {
      throw new Error('无权访问此简历');
    }

    // 2. 解析 processed_content 为结构化数据
    const parsedInfo = ResumeParserService.parseResumeContent(
      resume.processed_content || ''
    );

    // 3. 解析评估结果
    let evaluation = undefined;
    if (resume.evaluation) {
      try {
        evaluation = JSON.parse(resume.evaluation);
      } catch (e) {
        logger.warn('解析评估结果失败:', e);
      }
    }

    // 4. 解析面试问题
    let interviewQuestions = undefined;
    if (resume.interview_questions) {
      try {
        interviewQuestions = JSON.parse(resume.interview_questions);
      } catch (e) {
        logger.warn('解析面试问题失败:', e);
      }
    }

    return {
      resumeId: resume.id,
As userId: resume.user_id,
      jobDescription: resume.job_description || '',
      candidateName: parsedInfo.name,
      candidateEmail: parsedInfo.email,
      candidatePhone: parsedInfo.phone,
      candidateAddress: parsedInfo.address,
      educations: parsedInfo.education || [],
      skills: parsedInfo.skills || [],
      experiences: parsedInfo.experience || [],
      evaluation,
      interviewQuestions,
    };
  }

  /**
   * 发送消息并获取AI响应
   */
  async sendMessage(
    userId: number,
    resumeId: number,
    userMessage: string,
    onStreamChunk?: (chunk: string, isComplete: boolean, message?: AIHRAssistantMessage) => void
  ): Promise<AIHRAssistantMessage> {
    // 1. 保存用户消息
    const userMsgId = await this.saveMessage(userId, resumeId, 'user', userMessage);

    // 2. 获取对话历史（智能压缩）
    const compressedHistory = await this.getCompressedHistory(resumeId);

    // 3. 构建上下文
    const resumeContext = await this.buildResumeContext(userId, resumeId);
    const systemPrompt = this.buildSystemPrompt(resumeContext);

    // 4. 构建消息数组
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...this.formatHistoryForLLM(compressedHistory),
      { role: 'user', content: userMessage }
    ];

    // 5. 调用LLM（流式）
    const fullResponse = await this.callLLMStream(messages, onStreamChunk);

    // 6. 保存AI响应
    const assistantMessage = await this.saveMessage(
      userId,
      resumeId,
      'assistant',
      fullResponse,
      'chat',
      { type: 'response' }
    );

    return assistantMessage;
  }

  /**
   * 智能上下文压缩
   * 优先保留最近的对话，对早期对话进行摘要
   */
  private async getCompressedHistory(
    resumeId: number
  ): Promise<AIHRAssistantMessage[]> {
    // 获取所有历史消息
    const messages = await this.getRecentMessages(resumeId, 50);

    // 计算token数并标记
    const messagesWithTokens = messages.map(msg => ({
      ...msg,
      tokenCount: this.estimateTokens(msg.content)
    }));

    // 从旧到新检查，如果token超限，则压缩
    let totalTokens = 0;
    const result: AIHRAssistantMessage[] = [];
    const maxTokens = this.MAX_CONTEXT_TOKENS - this.RESERVE_TOKENS;

    // 倒序处理（从最新开始）
    for (let i = messagesWithTokens.length - 1; i >= 0; i--) {
      const msg = messagesWithTokens[i];

      // 尝试添加此消息
      if (totalTokens + msg.tokenCount <= maxTokens) {
        result.unshift(msg);
        totalTokens += msg.tokenCount;
      } else if (result.length > 0) {
        // 如果当前消息放不下，且已有消息
        // 检查是否需要添加摘要
        if (i > 0 && !result[0].isSummary) {
          // 生成早期对话的摘要
          const summary = await this.generateSummary(
            messagesWithTokens.slice(0, i)
          );
          const summaryMessage: AIHRAssistantMessage = {
            id: -1,
            resumeId,
            userId: 0,
            role: 'system',
            content: `[早期对话摘要]: ${summary}`,
            messageType: 'chat',
            tokenCount: this.estimateTokens(summary),
            isSummary: true,
            createdAt: messagesWithTokens[0].createdAt,
          };
          result.unshift(summaryMessage);
          break;
        }
        break;
      }
    }

    return result;
  }

  /**
   * 简单的token估算（中文≈1.5token，英文≈0.25token）
   */
  private estimateTokens(text: string): number {
    let tokens = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code > 0x4e00 && code < 0x9fff) {
        tokens += 1.5; // 中文字符
      } else {
        tokens += 0.25; // 其他字符
      }
    }
    return Math.ceil(tokens);
  }

  /**
   * 生成对话摘要（使用LLM）
   */
  private async generateSummary(messages: AIHRAssistantMessage[]): Promise<string> {
    const summaryContent = messages
      .filter(m => !m.isSummary)
      .map(m => { return `${m.role}: ${m.content}`; })
      .join('\n\n');

    const prompt = `请用简练的语言总结以下对话的核心内容，不超过100字：\n\n${summaryContent}`;

    const response = await this.callLLMNonStream([
      { role: 'user', content: prompt }
    ]);

    return response;
  }

  /**
   * 流构建系统提示词（优化：处理空数据）
   */
  private buildSystemPrompt(context: ResumeContext): string {
    const sections: string[] = [];

    sections.push(`你是一位专业的HR招聘助手。你正在帮助用户分析简历与目标职位的匹配情况。`);

    // 职位描述
    if (context.jobDescription) {
      sections.push(`【职位描述 (JD)】\n${context.jobDescription}`);
    } else {
      sections.push(`【职位描述】未提供职位描述`);
    }

    // 候选人信息
    const candidateInfo: string[] = [];
    if (context.candidateName) candidateInfo.push(`姓名：${context.candidateName}`);
    if (context.candidateEmail) candidateInfo.push(`邮箱：${context.candidateEmail}`);
    if (context.candidatePhone) candidateInfo.push(`电话：${context.candidatePhone}`);
    if (candidateInfo.length > 0) {
      sections.push(`【候选人信息】\n${candidateInfo.join('\n')}`);
    }

    // 教育背景
    if (context.educations && context.educations.length > 0) {
      sections.push(`【教育背景】\n${context.educations.map(edu =>
        `- ${edu.school || ''} ${edu.degree || ''} ${edu.major || ''} ${edu.period || ''}`
      ).join('\n')}`);
    }

    // 技能列表
    if (context.skills && context.skills.length > 0) {
      sections.push(`【技能列表】\n${context.skills.join(', ')}`);
    }

    // 工作经历
    if (context.experiences && context.experiences.length > 0) {
      sections.push(`【工作经历】\n${context.experiences.map(exp =>
        `- ${exp.company || ''} ${exp.position || ''} (${exp.period || ''})\n  ${exp.description || ''}`
      ).join('\n\n')}`);
    }

    // 匹配度评估
    if (context.evaluation) {
      sections.push(`【匹配度评估】
- 综合匹配度：${context.evaluation.overallScore || 0}%
- 关键词匹配：${context.evaluation.keywordMatch || 0}%
- 技能匹配：${context.evaluation.skillMatch || 0}%
- 经历匹配：${context.evaluation.experienceMatch || 0}%`);
    }

    // 改进建议
    if (context.evaluation?.suggestions && context.evaluation.suggestions.length > 0) {
      sections.push(`【改进建议】\n${context.evaluation.suggestions.join('\n')}`);
    }

    sections.push(`你的职责：
1. 基于上述信息回答用户的问题
2. 提供专业的简历优化建议
3. 针对职位要求指出候选人的优势和不足
4. 协助准备面试问题
5. 保持专业、客观、鼓励的语气

回答要求：
- 直接、简洁、有针对性
- 具体到简历中的内容
- 提供可操作的建议
- 如需引用简历内容，请注明出处`);

    return sections.join('\n\n');
  }

  /**
   * 非流式调用LLM（用于摘要生成）
   */
  private async callLLMNonStream(messages: Array<{ role: string; content: string }>): Promise<string> {
    // 实现参考 aiAnalysis.ts
    // 这里简化处理
    return '';
  }

  /**
   * 流式调用LLM（带回调）
   */
  private async callLLMStream(
    messages: Array<{ role: string; content: string }>,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    // TODO: 实现流式调用
    // GLM 4.6 支持流式响应
    const response = '';

    // 伪代码示意
    // const stream = await this.glmClient.chat.completions.create({
    //   model: 'glm-4.6',
    //   messages,
    //   stream: true,
    // });
    //
    // for await (const chunk of stream) {
    //   const content = chunk.choices[0]?.delta?.content || '';
    //   if (onChunk) onChunk(content);
    //   response += content;
    // }

    return response;
  }

  /**
   * 保存消息到数据库
   */
  private async saveMessage(
    userId: number,
    resumeId: number,
    role: 'user' | 'assistant' | 'system',
    content: string,
    messageType: 'chat' | 'suggestion' | 'analysis' = 'chat',
    metadata?: any
  ): Promise<AIHRAssistantMessage> {
    const db = database.getDatabase();

    const result = db.prepare(`
      INSERT INTO ai_conversations
      (resume_id, user_id, role, content, message_type, metadata, token_count, is_summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      resumeId,
      userId,
      role,
      content,
      messageType,
      metadata ? JSON.stringify(metadata) : null,
      this.estimateTokens(content),
      0
    );

    return {
      id: result.lastInsertRowid as number,
      resumeId,
      userId,
      role,
      content,
      messageType,
      metadata,
      tokenCount: this.estimateTokens(content),
      isSummary: false,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 获取历史消息
   */
  private async getRecentMessages(resumeId: number, limit: number = 20): Promise<AIHRAssistantMessage[]> {
    const db = database.getDatabase();

    const rows = db.prepare(`
      SELECT * FROM ai_conversations
      WHERE resume_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(resumeId, limit);

    return (rows as any[]).map(row => ({
      id: row.id,
      resumeId: row.resume_id,
      userId: row.user_id,
      role: row.role,
      content: row.content,
      messageType: row.message_type,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      tokenCount: row.token_count,
      isSummary: row.is_summary === 1,
      createdAt: row.created_at,
    }));
  }

  /**
   * 格式化历史消息为LLM输入格式
   */
  private formatHistoryForLLM(messages: AIHRAssistantMessage[]): Array<{ role: string; content: string }> {
    return messages
      .filter(m => !m.isSummary) // 不包含系统摘要消息
      .map(m => ({
        role: m.role === 'system' ? 'system' : (m.role === 'assistant' ? 'assistant' : 'user'),
        content: m.content,
      }));
  }
}
```

### 6.3 ResumeContext 类型定义

```typescript
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
```

## 7. 前端组件设计

### 7.1 aiHrAssistantStore.ts（优化）

**优化点**：
1. 简化 sendMessage 参数（只需 resumeId 和 message）
2. 支持流式消息更新
3. 移除前端传递 context 的逻辑

```typescript
import { aiHrAssistantApi } from '../services/aiHrAssistantIpcService';
import { ipcRenderer } from 'electron';

export interface ChatMessage {
  id: number;
  resumeId: number;
  userId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageType: 'chat' | 'suggestion' | 'analysis';
  metadata?: any;
  tokenCount?: number;
  isSummary?: boolean;
  createdAt: string;
}

interface AIHRAssistantState {
  // 当前对话上下文
  currentResumeId: number | null;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;

  // Actions
  setCurrentResume: (resumeId: number) => void;
  loadHistory: (resumeId: number) => Promise<void>;
  sendMessage: (resumeId: number, message: string) => Promise<void>;  // 简化参数
  appendStreamChunk: (resumeId: number, chunk: string) => void;      // 新增：流式追加
  clearHistory: (resumeId: number) => Promise<void>;
  setError: (error: string | null) => void;
}

export const useAIHRAssistantStore = create<AIHRAssistantState>((set, get) => ({
  currentResumeId: null,
  messages: [],
  loading: false,
  error: null,

  setCurrentResume: (resumeId) => {
    set({ currentResumeId: resumeId, messages: [] });
  },

  loadHistory: async (resumeId) => {
    set({ loading: true, error: null });
    try {
      const response = await aiHrAssistantApi.getHistory(resumeId);
      set({ messages: response.messages, currentResumeId: resumeId });
    } catch (error) {
      set({ error: '加载对话历史失败' });
    } finally {
      set({ loading: false });
    }
  },

  sendMessage: async (resumeId, message) => {
    set({ loading: true, error: null });

    // 添加用户消息到本地状态
    const tempUserMessage: ChatMessage = {
      id: Date.now(),
      resumeId,
      userId: 0,
      role: 'user',
      content: message,
      messageType: 'chat',
      createdAt: new Date().toISOString(),
    };
    set({ messages: [...get().messages, tempUserMessage] });

    // 添加临时的AI消息占位符
    const tempAssistantMessage: ChatMessage = {
      id: Date.now() + 1,
      resumeId,
      userId: 0,
      role: 'assistant',
      content: '',
      messageType: 'chat',
      createdAt: new Date().toISOString(),
    };
    set({ messages: [...get().messages, tempAssistantMessage] });

    // 注册流式回调
    const streamHandler = (_event: any, chunk: any) => {
      if (chunk.resumeId === resumeId && chunk.messageId === tempAssistantMessage.id) {
        get().appendStreamChunk(resumeId, chunk.chunk);
      }
    };

    ipcRenderer.on('ai-hr-assistant:stream-message', streamHandler);

    try {
      // 调用后端（只需传递 resumeId 和 message）
      const response = await aiHrAssistantApi.sendMessage(resumeId, message);

      // 用完整的消息替换临时消息
      set({
        messages: get().messages.map(m =>
          m.id === tempAssistantMessage.id ? response.message : m
        ),
        loading: false,
      });
    } catch (error) {
      set({ error: '发送消息失败', loading: false });
      // 移除失败的消息
      set({ messages: get().messages.filter(m => m.id !== tempUserMessage.id && m.id !== tempAssistantMessage.id) });
    } finally {
      // 移除监听器
      ipcRenderer.removeListener('ai-hr-assistant:stream-message', streamHandler);
    }
  },

  // 流式追加内容
  appendStreamChunk: (resumeId, chunk) => {
    set(state => ({
      messages: state.messages.map(msg => {
        // 找到最后一个 assistant 消息并追加内容
        if (msg.resumeId === resumeId && msg.role === 'assistant' && msg.id === state.messages[state.messages.length - 1]?.id) {
          return {
            ...msg,
            content: msg.content + chunk,
          };
        }
        return msg;
      }),
    }));
  },

  clearHistory: async (resumeId) => {
    try {
      await aiHrAssistantApi.clearHistory(resumeId);
      set({ messages: [] });
    } catch (error) {
      set({ error: '清空对话历史失败' });
    }
  }
}));
```

### 7.2 AIHRAssistant 组件（优化）

**优化点**：
1. 简化 handleSend 调用
2. 支持打字机效果

```typescript
interface AIHRAssistantProps {
  resumeId: number;
  resumeData: ResumeData;
  visible: boolean;
  onClose: () => void;
}

const AIHRAssistant: React.FC<AIHRAssistantProps> = ({
  resumeId,
  resumeData,
  visible,
  onClose
}) => {
  const [inputValue, setInputValue] = useState('');
  const { messages, loading, sendMessage, clearHistory } = useAIHRAssistantStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载历史消息
  useEffect(() => {
    if (visible && resumeId) {
      loadHistory(resumeId);
    }
  }, [visible, resumeId]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue;
    setInputValue('');

    // 简化调用：只需传递 resumeId 和 message
    await sendMessage(resumeId, userMessage);
  };

  return (
    <Drawer
      title={
        <Space>
          <RobotOutlined />
          <span>AI HR 助手</span>
          <Tag color="blue">{resumeData.originalFilename}</Tag>
        </Space>
      }
      placement="right"
      width={500}
      open={visible}
      onClose={onClose}
      extra={
        <Button
          icon={<DeleteOutlined />}
          danger
          onClick={() => clearHistory(resumeId)}
        >
          清空对话
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 消息列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 0' }}>
          {messages.length === 0 ? (
            <Empty
              description="开始与AI助手对话"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <SuggestionCards onQuestionSelect={setInputValue} />
            </Empty>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
          {loading && <LoadingMessage />}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Input.TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入问题，按 Enter 发送（Shift+Enter 换行）"
            autoSize={{ minRows: 2, maxRows: 6 }}
            disabled={loading}
          />
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={loading}
              disabled={!inputValue.trim()}
            >
              发送
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
};
```

### 7.3 SuggestionCards 组件

智能建议卡片组件（保持原有设计）：

```typescript
const SuggestionCards: React.FC<{ onQuestionSelect: (question: string) => void }> = ({
  onQuestionSelect
}) => {
  const suggestions = [
    {
      icon: <TrophyOutlined />,
      title: '匹配度分析',
      description: '分析简历与职位的匹配程度',
      question: '请分析这份简历与目标职位的匹配程度，重点指出优势和不足'
    },
    {
      icon: <EditOutlined />,
      title: '改进建议',
      description: '提供简历优化建议',
      question: '请提供具体的简历优化建议，特别是如何更好地突出与职位相关的经验'
    },
    {
      icon: <QuestionCircleOutlined />,
      title: '面试准备',
      description: '生成面试问题及回答要点',
      question: '根据这份简历和职位描述，生成可能的面试问题及回答要点'
    },
    {
      icon: <StarOutlined />,
      title: '技能亮点',
      description: '挖掘候选人的核心技能',
      question: '请挖掘候选人的核心技能优势，说明如何与职位要求契合'
    }
  ];

  return (
    <div style={{ padding: '0 16px' }}>
      <Title level={5} style={{ marginBottom: 16 }}>您可以问我：</Title>
      <Row gutter={[16, 16]}>
        {suggestions.map((s, i) => (
          <Col span={12} key={i}>
            <Card
              hoverable
              onClick={() => onQuestionSelect(s.question)}
              bodyStyle={{ padding: 12 }}
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space>
                  <span style={{ color: '#1890ff', fontSize: 18 }}>{s.icon}</span>
                  <Text strong>{s.title}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>{s.description}</Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};
```

### 7.4 MessageBubble 组件

消息气泡组件（保持原有设计）：

```typescript
const MessageBubble: React.FC<{ message: AIHRAssistantMessage }> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 16,
      }}
    >
      <Card
        bodyStyle={{
          padding: '12px 16px',
          maxWidth: '85%',
          background: isUser ? '#e6f7ff' : '#f5f5f5',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        }}
        bordered={false}
      >
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space size={8}>
            {!isUser && <RobotOutlined style={{ color: '#1890ff' }} />}
            <Text type={isUser ? 'secondary' : undefined} style={{ fontSize: 12 }}>
              {isUser ? '我' : 'AI HR 助手'}
            </Text>
            <Text type="secondary" style={{={{ fontSize: 11 }}>
              {formatTime(message.createdAt)}
            </Text>
          </Space>
          <MarkdownContent content={message.content} />
        </Space>
      </Card>
    </div>
  );
};
```

## 8. Handler 设计

### 8.1 AIHRAssistantHandler

位置：`src/main/handlers/aiHrAssistantHandler.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { BaseHandler } from './base';
import { IPC_CHANNELS, ErrorCode } from '../../shared/types';
import type {
  AIHRAssistantSendMessageRequest,
  AIHRAssistantSendMessageResponse,
  AIHRAssistantGetHistoryRequest,
  AIHRAssistantGetHistoryResponse,
  AIHRAssistantClearHistoryRequest,
  ApiResponse,
  AIHRAssistantMessage,
  AIHRAssistantStreamChunk,
} from '../../shared/types';
import { AIHRAssistantService } from '../services/aiHrAssistantService';
import { database } from '../database/sqlite';
import { logger } from '../utils/logger';

export class AIHRAssistantHandler extends BaseHandler {
  private aiService: AIHRAssistantService;

  constructor() {
    super();
    this.aiService = new AIHRAssistantService();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register(IPC_CHANNELS.AI_HR_ASSISTANT.SEND_MESSAGE, this.sendMessage.bind(this));
    this.register(IPC_CHANNELS.AI_HR_ASSISTANT.GET_HISTORY, this.getHistory.bind(this));
    this.register(IPC_CHANNELS.AI_HR_ASSISTANT.CLEAR_HISTORY, this.clearHistory.bind(this));
  }

  /**
   * 处理发送消息请求
   */
  private async sendMessage(
    event: IpcMainInvokeEvent,
    request: AIHRAssssistantSendMessageRequest
  ): Promise<ApiResponse<AIHRAssistantSendMessageResponse>> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 发送AI助手消息，简历ID: ${request.resumeId}`);

    try {
      // 生成临时消息ID（用于流式推送）
      const tempMessageId = Date.now();

      // 调用服务处理（带流式回调）
      const message = await this.aiService.sendMessage(
        userId,
        request.resumeId,
        request.message,
        // 流式回调
        (chunk: string, isComplete: boolean, finalMessage?: AIHRAssistantMessage) => {
          // 通过 IPC Renderer 推送流式消息
          event.sender.send(IPC_CHANNELS.AI_HR_ASSISTANT.STREAM_MESSAGE, {
            resumeId: request.resumeId,
            messageId: tempMessageId,
            chunk,
            isComplete,
            finalMessage: isComplete ? finalMessage : undefined,
          } as AIHRAssistantStreamChunk);
        }
      );

      return {
        success: true,
        data: { message },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('AI助手消息处理失败:', error);
      return {
        success: false,
        error: error.message || '消息处理失败',
        code: ErrorCode.AI_SERVICE_ERROR,
      };
    }
  }

  /**
   * 获取对话历史
   */
  private async getHistory(
    event: IpcMainInvokeEvent,
    request: AIHRAssistantGetHistoryRequest
  ): Promise<ApiResponse<AIHRAssistantGetHistoryResponse>> {
    const userId = this.getCurrentUserId(event);

    try {
      const limit = request.limit || 50;
      const db = database.getDatabase();

      const rows = db.prepare(`
        SELECT * FROM ai_conversations
        WHERE resume_id = ? AND user_id = ?
        ORDER BY created_at ASC
        LIMIT ?
      `).all(request.resumeId, userId, limit);

      const messages: AIHRAssistantMessage[] = (rows as any[]).map(row => ({
        id: row.id,
        resumeId: row.resume_id,
        userId: row.user_id,
        role: row.role,
        content: row.content,
        messageType: row.message_type,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        tokenCount: row.token_count,
        isSummary: row.is_summary === 1,
        createdAt: row.created_at,
      }));

      return {
        success: true,
        data: {
          messages,
          resumeId: request.resumeId,
          total: messages.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('获取对话历史失败:', error);
      return {
        success: false,
        error: error.message || '获取对话历史失败',
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }

  /**
   * 清空对话历史
   */
  private async clearHistory(
    event: IpcMainInvokeEvent,
    request: AIHRAssistantClearHistoryRequest
  ): Promise<ApiResponse<void>> {
    const userId = this.getCurrentUserId(event);

    try {
      const db = database.getDatabase();
      db.prepare(`
        DELETE FROM ai_conversations
        WHERE resume_id = ? AND user_id = ?
      `).run(request.resumeId, userId);

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('清空对话历史失败:', error);
      return {
        success: false,
        error: error.message || '清空对话历史失败',
        code: ErrorCode.INTERNAL_ERROR,
      };
    }
  }
}
```

### 8.2 注册 Handler

在 `src/main/handlers/index.ts` 中新增：

```typescript
import { UserHandler } from './userHandler';
import { ResumeHandler } from './resumeHandler';
import { AIHRAssistantHandler } from './aiHrAssistantHandler';  // 新增
import { logger } from '../utils/logger';

export function registerAllHandlers(): void {
  try {
    new UserHandler();
    logger.info('用户 IPC 处理器已注册');

    new ResumeHandler();
    logger.info('简历 IPC 处理器已注册');

    new AIHRAssistantHandler();  // 新增
    logger.info('AI HR 助手 IPC 处理器已注册');  // 新增

    logger.info('所有 IPC 处理器注册完成');
  } catch (error) {
    logger.error('注册 IPC 处理器失败:', error);
    throw error;
  }
}
```

## 9. 集成到简历详情页

### 9.1 ResumeDetailPage 修改

```typescript
const ResumeDetailPage: React.FC = () => {
  const [aiAssistantVisible, setAiAssistantVisible] = useState(false);

  return (
    <div>
      {/* 原有内容 */}

      {/* AI 助手按钮 */}
      <FloatButton.Group
        shape="circle"
        style={{ right: 24, bottom: 24 }}
      >
        <FloatButton
          icon={<RobotOutlined />}
          type="primary"
          tooltip="AI HR 助手"
          onClick={() => setAiAssistantVisible(true)}
        />
      </FloatButton.Group>

      {/* AI HR 助手抽屉 */}
      <AIHRAssistant
        resumeId={resume.id}
        resumeData={resume}
        visible={aiAssistantVisible}
        onClose={() => setAiAssistantVisible(false)}
      />
    </div>
  );
};
```

## 10. 实施计划

### 阶段1：基础架构（优先级：高）
1. 数据库表设计和迁移（ai_conversations 表）
2. IPC 通道定义（AI_HR_ASSISTANT）
3. AIHRAssistantHandler 实现
4. 数据库方法（saveMessage, getRecentMessages）

### 阶段2：简历解析（优先级：高）
1. ResumeParserService 实现
2. 从 processed_content 解析结构化数据
3. 单元测试

### 阶段3：AI服务（优先级：高）
1. AIHRAssistantService - buildResumeContext（从数据库获取）
2. buildSystemPrompt 优化（处理空数据）
3. 上下文压缩逻辑
4. Token 估算
5. LLM 调用（先非流式）

### 阶段4：前端基础组件（优先级：中）
1. aiHrAssistantIpcService 封装
2. aiHrAssistantStore（简化参数）
3. AIHRAssistant 组件
4. MessageBubble 组件
5. SuggestionCards 组件

### 阶段5：流式响应（优先级：中）
1. GLM API 流式调用实现
2. IPC Renderer 消息推送
3. 前端流式消息处理
4. 打字机效果

### 阶段6：优化和测试（优先级：低）
1. 缓存机制
2. 性能优化
3. 错误处理增强
4. 端到端测试

## 11. 关键改进点总结

| 问题 | 原设计 | 优化后 |
|------|--------|--------|
| 数据来源 | 前端传递 context | 主进程从数据库获取简历数据 |
| 简历解析 | 假设已解析为结构化字段 | 新增 ResumeParserService 解析 processed_content |
| Token 管理 | 固定限制消息数量 | 智能上下文压缩，动态计算 token |
| 响应方式 | 等待完整响应 | 支持流式响应，打字机效果 |
| 空数据处理 | 可能导致模板报错 | 安全处理空值 |
| 请求参数 | resumeId + message + context | 仅需 resumeId + message |

## 12. 注意事项

1. **隐私保护**：对话数据仅存储本地，不上传云端
2. **Token管理**：智能压缩上下文，避免超限
3. **错误处理**：提供友好的错误提示和重试机制
4. **性能优化**：对话历史分页加载
5. **用户体验**：加载状态提示、流式响应、快捷操作
6. **数据一致性**：主进程控制所有简历数据获取

## 13. 扩展性考虑

1. **多模型支持**：预留接口支持切换不同的 LLM
2. **知识库**：未来集成企业知识库
3. **分析报告**：基于对话生成结构化报告
4. **多语言**：支持中英文对话等
5. **多轮对话摘要**：更精细的对话压缩策略
