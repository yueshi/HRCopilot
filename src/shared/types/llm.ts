/**
 * LLM (大语言模型) 供应商相关类型定义
 */

// ============ 供应商类型 ============

export type LLMProviderType =
  | 'openai'
  | 'glm'
  | 'ollama'
  | 'anthropic'
  | 'azure'
  | 'custom';

// ============ 消息类型 ============

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ============ 参数类型 ============

export interface LLMParameters {
  temperature?: number;
  max_tokens?: number;
  timeout_ms?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  stop?: string[] | string;
  // Azure 特定参数
  api_version?: string;
}

// ============ Token 使用情况 ============

export interface LLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// ============ 供应商配置 ============

export interface LLMProvider {
  id: number;
  provider_id: string;           // 唯一标识 (uuid)
  name: string;                  // 供应商名称
  type: LLMProviderType;         // 供应商类型
  base_url: string;              // API 基础 URL
  api_key?: string;              // API 密钥 (返回时脱敏)
  models: string[];              // 支持的模型列表
  is_enabled: boolean;           // 是否启用
  is_default: boolean;           // 是否为默认
  parameters: LLMParameters;      // 默认参数
  sort_order: number;            // 排序序号
  created_at: string;            // 创建时间
  updated_at: string;            // 更新时间
}

// ============ 供应商创建请求 ============

export interface LLMProviderCreateRequest {
  name: string;
  type: LLMProviderType;
  base_url: string;
  api_key?: string;
  models?: string[];
  is_enabled?: boolean;
  is_default?: boolean;
  parameters?: LLMParameters;
}

// ============ 供应商更新请求 ============

export interface LLMProviderUpdateRequest extends Partial<LLMProviderCreateRequest> {
  provider_id: string;
}

// ============ 连接测试请求 ============

export interface LLMProviderTestRequest {
  provider_id: string;
  model?: string;                // 可选，指定测试的模型
}

// ============ 连接测试结果 ============

export interface LLMProviderTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
    available_models?: string[];    // 可用模型列表
}

// ============ 模型同步请求 ============

export interface LLMModelsSyncRequest {
  provider_id: string;
}

// ============ 模型同步结果 ============

export interface LLMModelsSyncResult {
  success: boolean;
  models: string[];
  message?: string;
}

// ============ 任务名称类型 ============

export type LLMTaskName = 'resume_analysis' | 'resume_optimization' | 'question_generation';

// ============ 任务配置 ============

export interface LLMTaskConfig {
  task_name: LLMTaskName;
  provider_id?: string;
  model?: string;
  parameters: LLMParameters;
}

// ============ LLM 调用请求 ============

export interface LLMCallRequest {
  task_name?: LLMTaskName;       // 任务名称，用于自动选择配置
  provider_id?: string;          // 覆盖配置的供应商 ID
  model?: string;                // 覆盖配置的模型名称
  messages: LLMMessage[];        // 消息列表
  parameters?: LLMParameters;   // 覆盖配置的参数
}

// ============ LLM 调用响应 ============

export interface LLMCallResponseResult {
  content: string;
  model: string;
  provider_id: string;
  usage?: LLMUsage;
}

// ============ 预设配置 ============

export interface LLMProviderPreset {
  type: LLMProviderType;
  name: string;
  base_url: string;
  default_models: string[];
  description: string;
}

// 预设供应商模板
export const LLM_PROVIDER_PRESETS: LLMProviderPreset[] = [
  {
    type: 'openai',
    name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    default_models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
    description: 'OpenAI 官方 API',
  },
  {
    type: 'glm',
    name: 'GLM (智谱 AI)',
    base_url: 'https://open.bigmodel.cn/api/paas/v4',
    default_models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
    description: '智谱 AI GLM 系列模型'
  },
  {
    type: 'ollama',
    name: 'Ollama (本地)',
    base_url: 'http://localhost:11434/v1',
    default_models: ['llama2', 'mistral', 'codellama', 'phi'],
    description: '本地 Ollama 部署服务'
  },
  {
    type: 'anthropic',
    name: 'Anthropic (Claude)',
    base_url: 'https://api.anthropic.com/v1',
    default_models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    description: 'Anthropic Claude 系列模型'
  },
  {
    type: 'azure',
    name: 'Azure OpenAI',
    base_url: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions',
    default_models: ['gpt-4', 'gpt-35-turbo'],
    description: 'Azure OpenAI 服务'
  },
  {
    type: 'custom',
    name: '自定义兼容',
    base_url: '',
    default_models: [],
    description: '兼容 OpenAI API 格式的自定义服务'
  },
];

// ============ API Key 加密相关 ============

export interface ApiKeyEncryption {
  encrypted_key: string;
  iv: string;                    // 初始化向量
  key_id: string;                // 密钥标识（用于验证）
}

// ============ 配置导入导出 ============

export interface LLMConfigExport {
  version: string;               // 配置版本
  exported_at: string;           // 导出时间
  providers: LLMProvider[];      // 供应商配置 (API Key 已加密)
  task_configs: LLMTaskConfig[]; // 任务配置
}
