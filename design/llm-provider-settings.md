# LLM 供应商设置功能设计方案

## 1. 功能概述

为 ResumerHelper 项目添加 LLM（大语言模型）供应商配置功能，支持用户灵活配置多个 AI 服务提供商，包括主流商业 API、本地部署模型以及第三方兼容服务。

## 2. 核心需求

### 2.1 支持的供应商类型

| 供应商类型 | 支持的模型 | 默认配置 |
|-----------|-----------|---------|
| **OpenAI** | gpt-4, gpt-4-turbo, gpt-3.5-turbo, o1, o1-mini | `https://api.openai.com/v1` |
| **GLM (智谱)** | glm-4, glm-4-flash, glm-3-turbo | `https://open.bigmodel.cn/api/paas/v4` |
| **Ollama (本地)** | llama2, mistral, codellama 等本地模型 | `http://localhost:11434/v1` |
| **Anthropic** | claude-3-opus, claude-3-sonnet, claude-3-haiku | `https://api.anthropic.com/v1` |
| **Azure OpenAI** | gpt-4, gpt-35-turbo 等 | `https://{resource}.openai.azure.com` |
| **自定义兼容** | 任何兼容 OpenAI API 格式的服务 | 用户自定义 |

### 2.2 核心功能

1. **供应商管理**
   - 添加、编辑、删除供应商配置
   - 设置默认供应商
   - 启用/禁用供应商
   - 测试连接有效性

2. **模型配置**
   - 每个供应商可配置多个模型
   - 为不同用途（分析、优化、生成）配置不同模型
   - 设置模型参数（温度、最大 token、超时时间）

3. LLM 服务抽象层
   - 统一的调用接口
   - 自动降级机制（主供应商失败时尝试备用供应商）
   - 请求重试和错误处理

## 3. 数据库设计

### 3.1 表结构

```sql
-- LLM 供应商配置表
CREATE TABLE IF NOT EXISTS llm_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL UNIQUE,        -- 供应商唯一标识 (uuid)
  name TEXT NOT NULL,                      -- 供应商名称 (显示用)
  type TEXT NOT NULL,                      -- 供应商类型 (openai, glm, ollama, anthropic, azure, custom)
  base_url TEXT NOT NULL,                  -- API 基础 URL
  api_key TEXT,                            -- API 密钥 (加密存储)
  models TEXT NOT NULL DEFAULT '[]',      -- 支持的模型列表 (JSON)
  is_enabled INTEGER DEFAULT 1,            -- 是否启用 (0/1)
  is_default INTEGER DEFAULT 0,            -- 是否为默认 (0/1)
  parameters TEXT NOT NULL DEFAULT '{}',    -- 默认参数配置 (JSON: temperature, max_tokens, timeout)
  sort_order INTEGER DEFAULT 0,             -- 排序序号
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- LLM 使用任务配置表 (不同功能使用哪个模型)
CREATE TABLE IF NOT EXISTS llm_task_config (
  task_name TEXT PRIMARY KEY,              -- 任务名称: resume_analysis, resume_optimization, question_generation
  provider_id TEXT,                        -- 使用的供应商 ID
  model TEXT,                              -- 使用的模型名称
  parameters TEXT NOT NULL DEFAULT '{}',    -- 任务特定参数 (覆盖供应商默认值)
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES llm_providers(provider_id) ON DELETE SET NULL
);

-- LLM 调用日志表 (可选，用于监控和调试)
CREATE TABLE IF NOT EXISTS llm_call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT,                        -- 供应商 ID
  model TEXT,                              -- 使用的模型
  task_name TEXT,                          -- 任务名称
  request_tokens INTEGER,                  -- 请求 token 数
  response_tokens INTEGER,                 -- 响应 token 数
  status TEXT NOT NULL,                    -- 状态: success, failed
  error_message TEXT,                     -- 错误信息
  duration_ms INTEGER,                     -- 调用耗时 (毫秒)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 默认数据

应用初始化时插入默认供应商配置：

```typescript
const DEFAULT_PROVIDERS = [
  {
    provider_id: 'glm-default',
    name: 'GLM (智谱 AI)',
    type: 'glm',
    base_url: 'https://open.bigmodel.cn/api/paas/v4',
    api_key: process.env.GLM_API_KEY, // 从环境变量读取
    models: ['glm-4', 'glm-4-flash', 'glm-3-turbo'],
    is_enabled: true,
'is_default': true,
    parameters: {
      temperature: 0.3,
      max_tokens: 2000,
      timeout_ms: 30000
    }
  }
];
```

## 4. IPC 通道设计

### 4.1 新增 IPC 通道

```typescript
// src/shared/types/ipc.ts
export const IPC_CHANNELS = {
  // ... 现有通道 ...

  SETTING: {
    // LLM 供应商相关
    PROVIDER_LIST: 'setting:provider:list',
    PROVIDER_GET: 'setting:provider:get',
    PROVIDER_CREATE: 'setting:provider:create',
    PROVIDER_UPDATE: 'setting:provider:update',
    PROVIDER_DELETE: 'setting:provider:delete',
    PROVIDER_TEST: 'setting:provider:test',
    PROVIDER_SET_DEFAULT: 'setting:provider:set-default',

    // 任务配置相关
    TASK_CONFIG_GET: 'setting:task-config:get',
    TASK_CONFIG_UPDATE: 'setting:task-config:update',

    // 模型列表相关
    MODELS_LIST: 'setting:models:list',
    MODELS_SYNC: 'setting:models:sync', // 从供应商获取可用模型列表
  } as const,
};
```

### 4.2 请求/响应类型定义

```typescript
// src/shared/types/llm.ts

export type LLMProviderType =
  | 'openai'
  | 'glm'
  | 'ollama'
  | 'anthropic'
  | 'azure'
  | 'custom';

export interface LLMProvider {
  id: number;
  provider_id: string;
  name: string;
  type: LLMProviderType;
  base_url: string;
  api_key?: string; // 返回时只显示部分 (****)
  models: string[];
  is_enabled: boolean;
  is_default: boolean;
  parameters: LLMParameters;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LLMParameters {
  temperature?: number;
  max_tokens?: number;
  timeout_ms?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface LLMTaskConfig {
  task_name: string;
  provider_id?: string;
  model?: string;
  parameters: LLMParameters;
}

export type LLMTaskName = 'resume_analysis' | 'resume_optimization' | 'question_generation';

// 创建/更新供应商请求 (包含完整 api_key)
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

export interface LLMProviderUpdateRequest extends Partial<LLMProviderCreateRequest> {
  provider_id: string;
}

// 测试连接请求
export interface LLMProviderTestRequest {
  provider_id: string;
  model?: string; // 可选，指定测试的模型
}

export interface LLMProviderTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
  available_models?: string[]; // 如果成功，返回可用模型列表
}

// 同步模型列表请求
export interface LLMModelsSyncRequest {
  provider_id: string;
}

export interface LLMModelsSyncResult {
  success: boolean;
  models: string[];
  message?: string;
}

// LLM 调用请求 (统一接口)
export interface LLMCallRequest {
  task_name?: LLMTaskName; // 可选，用于自动选择配置
  provider_id?: string;   // 可选，覆盖配置
  model?: string;          // 可选，覆盖配置
  messages: LLMMessage[];
  parameters?: LLMParameters; // 可选，覆盖配置
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCallResponseResult {
  content: string;
  model: string;
  provider_id: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

## 5. 后端架构设计

### 5.1 目录结构

```
src/main/
├── controllers/
│   └── LLMProviderController.ts      # 供应商配置控制器
├── handlers/
│   └── SettingHandler.ts             # 设置相关 IPC 处理器
├── services/
│   ├── LLMService.ts                  # LLM 服务抽象层
│   ├── providers/
│   │   ├── BaseLLMProvider.ts         # 供应商基类
│   │   ├── OpenAIProvider.ts         # OpenAI 适配器
│   │   ├── GLMProvider.ts             # GLM 适配器
│   │   ├── OllamaProvider.ts         # Ollama 适配器
│   │   ├── AnthropicProvider.ts       # Anthropic 适配器
│   │   └── CustomProvider.ts          # 自定义兼容适配器
│   └── aiAnalysis.ts                  # 重构为使用 LLMService
└── database/
    └── sqlite.ts                      # 添加 LLM 表操作方法
```

### 5.2 核心类设计

#### BaseLLMProvider (抽象基类)

```typescript
// src/main/services/providers/BaseLLMProvider.ts

export abstract class BaseLLMProvider {
  protected providerId: string;
  protected baseUrl: string;
  protected apiKey?: string;
  protected parameters: LLMParameters;

  constructor(config: LLMProvider) {
    this.providerId = config.provider_id;
    this.baseUrl = config.base_url;
    this.apiKey = config.api_key;
    this.parameters = config.parameters;
  }

  // 测试连接
  abstract testConnection(): Promise<LLMProviderTestResult>;

  // 获取可用模型列表
  abstract fetchModels(): Promise<string[]>;

  // 发送消息
  abstract chat(
    messages: LLMMessage[],
    model: string,
    parameters?: LLMParameters
  ): Promise<LLMCallResponseResult>;

  // 获取请求头
  protected abstract getHeaders(): Record<string, string>;

  // 构建请求体
  protected abstract buildRequestBody(
    messages: LLMMessage[],
    model: string,
    parameters?: LLMParameters
  ): any;

  // 处理响应
  protected abstract parseResponse(response: any): LLMCallResponseResult;
}
```

#### OpenAIProvider 示例

```typescript
// src/main/services/providers/OpenAIProvider.ts

export class OpenAIProvider extends BaseLLMProvider {
  async testConnection(): Promise<LLMProviderTestResult> {
    const startTime = Date.now();
    try {
      const models = await this.fetchModels();
      return {
        success: true,
        message: '连接成功',
        latency_ms: Date.now() - startTime,
        available_models: models,
      };
    } catch (error) {
      return {
        success: false,
        message: `连接失败: ${error.message}`,
        latency_ms: Date.now() - startTime,
      };
    }
  }

  async fetchModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: this.getHeaders(),
    });
    const data = await response.json();
    return data.data.map((m: any) => m.id);
  }

  async chat(
    messages: LLMMessage[],
    model: string,
    parameters?: LLMParameters
  ): Promise<LLMCallResponseResult> {
    const body = this.buildRequestBody(messages, model, parameters);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return this.parseResponse(data);
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  protected buildRequestBody(...) {
    // 构建 OpenAI API 格式请求
  }

  protected parseResponse(...): LLMCallResponseResult {
    // 解析 OpenAI API 格式响应
  }
}
```

#### LLMService (服务抽象层)

```typescript
// src/main/services/LLMService.ts

export class LLMService {
  private database: SQLiteDatabase;
  private providerCache = new Map<string, BaseLLMProvider>();
  private taskCache = new Map<string, LLMTaskConfig>();

  constructor(database: SQLiteDatabase) {
    this.database = database;
  }

  // 获取供应商实例 (带缓存)
  private async getProvider(providerId: string): Promise<BaseLLMProvider> {
    if (this.providerCache.has(providerId)) {
      return this.providerCache.get(providerId)!;
    }
    const config = await this.database.getLLMProvider(providerId);
    const provider = this.createProvider(config);
    this.providerCache.set(providerId, provider);
    return provider;
  }

  // 创建供应商实例
  private createProvider(config: LLMProvider): BaseLLMProvider {
    switch (config.type) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'glm':
        return new GLMProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'azure':
        return new AzureProvider(config);
      case 'custom':
        return new CustomProvider(config);
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }

  // 统一调用接口
  async call(request: LLMCallRequest): Promise<LLMCallResponseResult> {
    // 1. 确定使用的配置
    const config = await this.resolveConfig(request);

    // 2. 获取供应商实例
    const provider = await this.getProvider(config.provider_id);

    // 3. 合并参数
    const mergedParams = { ...config.parameters, ...request.parameters };

    // 4. 调用
    return await provider.chat(request.messages, config.model!, mergedParams);
  }

  // 解析配置 (考虑任务配置、默认供应商等)
  private async resolveConfig(request: LLMCallRequest): Promise<{
    provider_id: string;
    model: string;
    parameters: LLMParameters;
  }> {
    // 如果指定了 provider_id，使用指定配置
    if (request.provider_id) {
      const provider = await this.database.getLLMProvider(request.provider_id);
      return {
        provider_id: provider.provider_id,
        model: request.model || provider.models[0],
        parameters: provider.parameters,
      };
    }

    // 如果指定了 task_name，使用任务配置
    if (request.task_name) {
      const taskConfig = await this.database.getLLMTaskConfig(request.task_name);
      if (taskConfig.provider_id) {
        const provider = await this.database.getLLMProvider(taskConfig.provider_id);
        return {
          provider_id: provider.provider_id,
          model: taskConfig.model || provider.models[0],
          parameters: { ...provider.parameters, ...taskConfig.parameters },
        };
      }
    }

    // 使用默认供应商
    const defaultProvider = await this.database.getDefaultLLMProvider();
    return {
      provider_id: defaultProvider.provider_id,
      model: request.model || defaultProvider.models[0],
      parameters: defaultProvider.parameters,
    };
  }

  // 清除缓存
  clearCache(): void {
    this.providerCache.clear();
    this.taskCache.clear();
  }
}
```

### 5.3 数据库操作方法

```typescript
// src/main/database/sqlite.ts

export class SQLiteDatabase {
  // ... 现有方法 ...

  // LLM 供应商相关
  createLLMProvider(provider: LLMProviderCreateRequest): Promise<LLMProvider>
  getLLMProvider(providerId: string): Promise<LLMProvider | null>
  listLLMProviders(): Promise<LLMProvider[]>
  updateLLMProvider(providerId: string, updates: LLMProviderUpdateRequest): Promise<LLMProvider>
  deleteLLMProvider(providerId: string): Promise<void>
  setDefaultLLMProvider(providerId: string): Promise<void>
  getDefaultLLMProvider(): Promise<LLMProvider>

  // 任务配置相关
  getLLMTaskConfig(taskName: string): Promise<LLMTaskConfig | null>
  updateLLMTaskConfig(config: LLMTaskConfig): Promise<void>

  // 初始化默认数据
  private initDefaultLLMProviders(): Promise<void>
}
```

## 6. 前端设计

### 6.1 页面组件结构

```
src/renderer/src/
├── pages/
│   └── SettingsPage.tsx                # 设置主页面
├── components/
│   └── Settings/
│       ├── SettingsLayout.tsx           # 设置页面布局
│       ├── LLMProviderList.tsx          # 供应商列表
│       ├── LLMProviderForm.tsx           # 供应商表单 (添加/编辑)
│       ├── LLMProviderCard.tsx          # 供应商卡片
│       ├── TaskConfigPanel.tsx          # 任务配置面板
│       ├── ConnectionTest.tsx           # 连接测试组件
│       └── ModelSelector.tsx            # 模型选择器
├── services/
│   └── SettingService.ts               # 设置 API 服务
├── store/
│   └── settingStore.ts                 # 设置状态管理
```

### 6.2 设置页面设计

#### 主设置页面 (SettingsPage.tsx)

```typescript
const SettingsPage = () => {
  return (
    <SettingsLayout>
      <Tabs
        items={[
          {
            key: 'providers',
            label: 'LLM 供应商',
            children: <LLMProviderList />,
          },
          {
            key: 'tasks',
            label: '任务配置',
            children: <TaskConfigPanel />,
          },
          {
            key: 'general',
            label: '通用设置',
            children: <GeneralSettingsPanel />,
          },
        ]}
      />
    </SettingsLayout>
  );
};
```

#### 供应商列表组件 (LLMProviderList.tsx)

```typescript
const LLMProviderList = () => {
  const { providers, loading, fetchProviders } = useLLMProviders();

  return (
    <div>
      <Space>
        <Button type="primary" onClick={() => setShowModal(true)}>
          添加供应商
        </Button>
      </Space>

      <List
        dataSource={providers}
        renderItem={(provider) => (
          <LLMProviderCard
            provider={provider}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onTest={handleTest}
            onSetDefault={handleSetDefault}
          />
        )}
      />
    </div>
  );
};
```

#### 供应商表单组件 (LLMProviderForm.tsx)

```typescript
const LLMProviderForm = ({ provider, onSave }) => {
  const [form] = Form.useForm();

  const typeOptions = [
    { label: 'OpenAI', value: 'openai' },
    { label: 'GLM (智谱)', value: 'glm' },
    { label: 'Ollama (本地)', value: 'ollama' },
    { label: 'Anthropic (Claude)', value: 'anthropic' },
    { label: 'Azure OpenAI', value: 'azure' },
    { label: '自定义兼容', value: 'custom' },
  ];

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onSave}
      initialValues={provider}
    >
      <Form.Item label="供应商名称" name="name" required>
        <Input placeholder="如：我的 OpenAI" />
      </Form.Item>

      <Form.Item label="供应商类型" name="type" required>
        <Select options={typeOptions} />
      </Form.Item>

      <Form.Item label="API 地址" name="base_url" required>
        <Input placeholder="https://api.openai.com/v1" />
      </Form.Item>

      <Form.Item label="API Key" name="api_key">
        <Input.Password placeholder="sk-..." />
      </Form.Item>

      {/* 动态显示根据供应商类型的额外配置 */}
    </Form>
  );
};
```

### 6.3 状态管理 (settingStore.ts)

```typescript
interface SettingStore {
Z  // LLM 供应商
  providers: LLMProvider[];
  loading: boolean;
  error: string | null;

  fetchProviders: () => Promise<void>;
  createProvider: (data: LLMProviderCreateRequest) => Promise<void>;
  updateProvider: (id: string, data: LLMProviderUpdateRequest) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  testProvider: (id: string, model?: string) => Promise<LLMProviderTestResult>;
  setDefaultProvider: (id: string) => Promise<void>;

  // 任务配置
  taskConfigs: Record<string, LLMTaskConfig>;
  fetchTaskConfigs: () => Promise<void>;
  updateTaskConfig: (taskName: string, config: Partial<LLMTaskConfig>) => Promise<void>;
}
```

### 6.4 路由更新

```typescript
// src/renderer/src/App.tsx

const routes = [
  // ... 现有路由 ...
  {
    path: '/settings',
    element: <ProtectedRoute><SettingsPage /></ProtectedRoute>,
  },
];
```

### 6.5 布局菜单更新

```typescript
// src/renderer/src/components/Layout.tsx

const menuItems = [
  // ... 现有菜单 ...
  {
    key: 'settings',
    icon: <SettingOutlined />,
    label: '设置',
    path: '/settings',
  },
];
```

## 7. 实施步骤

### Phase 1: 数据库和类型定义
1. 在 `sqlite.ts` 中添加 LLM 相关表结构和操作方法
2. 在 `src/shared/types/llm.ts` 中定义所有类型
3. 更新 IPC 通道定义

### Phase 2: 后端核心服务
1. 创建 `BaseLLMProvider` 抽象基类
2. 实现各供应商适配器 (OpenAI, GLM, Ollama 等)
3. 创建 `LLMService` 服务抽象层
4. 重构现有的 `aiAnalysis.ts` 使用 LLMService

### Phase 3: IPC 处理器
1. 创建 `SettingHandler.ts` 处理设置相关请求
2. 在主进程注册所有 IPC 处理器

### Phase 4: 前端服务和状态
1. 创建 `SettingService.ts` 封装 API 调用
2. 创建 `settingStore.ts` 状态管理
3. 更新 preload 暴露设置相关 API

### Phase 5: 前端 UI 组件
1. 创建设置页面和子组件
2. 添加路由和菜单
3. 实现供应商管理功能

### Phase 6: 测试和优化
1. 单元测试各供应商适配器
2. 集成测试完整流程
3. 性能优化和错误处理完善

## 8. 安全考虑

1. **API Key 加密存储**
   - 使用 AES 加密存储 API Key
   - 密钥从用户主密码派生或使用设备特定密钥

2. **API Key 隐藏**
   - 返回给前端的 API Key 只显示部分 (sk-****...)

3. **输入验证**
   - 验证 URL 格式
   - 验证模型名称格式

4. **错误信息脱敏**
   - 日志和错误响应中不包含敏感信息

## 9. 扩展性考虑

1. **插件式供应商适配器**
   - 未来可支持动态加载供应商适配器

2. **多租户支持**
   - 为不同用户保存独立的 LLM 配置

3. **成本跟踪**
   - 记录每次调用的 token 消耗，计算成本

4. **配额管理**
   - 为不同供应商设置调用频率限制
