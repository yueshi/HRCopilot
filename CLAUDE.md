# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

HRCopilot 是一个基于 Electron + TypeScript 的桌面应用程序，专注于智能 JD（职位描述）与简历匹配分析。项目采用 Electron 三层架构，支持多 LLM 供应商（GLM、OpenAI、Ollama、Anthropic、Azure、自定义），为求职者提供简历优化、匹配度评估、面试问题生成和 AI HR 助手等功能。

## 核心功能

1. **JD-简历匹配分析** - 智能分析简历与职位描述的匹配程度
2. **多 LLM 供应商支持** - 支持 GLM、OpenAI、Ollama、Anthropic、Azure、自定义 API
3. **AI HR 助手** - 基于简历的智能对话助手，支持流式对话
4. **简历去重和版本管理** - 自动检测重复简历，支持简历分组和版本管理
5. **Minibar 窗口** - 悬浮工具栏，快速访问常用功能
6. **用户认证系统** - 用户注册、登录、个人信息管理

## 常用开发命令

### 开发和构建
```bash
# 开发模式 (同时启动主进程和渲染进程)
npm run dev

# 构建所有代码
npm run build
npm run build:main      # 仅构建主进程
npm run build:preload    # 仅构建 preload
npm run build:renderer   # 仅构建渲染进程

# 运行测试
npm test

# 代码检查和格式化
npm run lint
npm run format
```

### 打包发布
```bash
# 完整打包 (生成安装包)
npm run dist

# 打包为目录 (不生成安装包，用于测试)
npm run dist:dir

# Electron 重建原生模块 (安装依赖后运行)
npm run electron-rebuild
```

### 依赖安装注意
由于 Electron 二进制文件下载较慢，建议使用淘宝镜像源：
```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
```

## 架构和技术栈

### Electron 三层架构

**Main Process** (`src/main/`)
- Electron 主进程，管理应用生命周期和窗口
- 负责系统 API 访问、数据库操作、文件系统交互
- 提供 IPC (Inter-Process Communication) 服务接口
- 核心：`ResumerHelperApp`、`WindowManager`、`AppLifecycleManager`、`WindowStateManager`

**Preload Script** (`src/preload/`)
- 安全桥接层，通过 contextBridge 暴露 API
- 隔离渲染进程与主进程的直接访问

**Renderer Process** (`src/renderer/`)
- React 19 应用，负责 UI 渲染和用户交互
- 通过 preload 暴露的 API 与主进程通信
- 支持两种窗口类型：主窗口 (MainWindow) 和 Minibar 窗口

### 技术栈

**主进程**:
- Electron 28.3.3
- TypeScript 5.6.3
- better-sqlite3 9.6.0 (SQLite 数据库)
- Winston 3.17.0 (日志)
- axios 1.7.7 (HTTP 请求)
- bcryptjs 3.0.3 (密码加密)

**渲染进程**:
- React 19.0.0
- TypeScript 5.6.3
- Vite 6.0.7 (构建工具)
- Ant Design 5.22.2 (UI 组件库)
- Zustand 5.0.1 (状态管理)
- React Router 7.1.1 (路由)

## 核心目录结构

```
HRCopilot/
├── src/
│   ├── main/                      # Electron 主进程
│   │   ├── main.ts               # 主进程入口，ResumerHelperApp 类
│   │   ├── windowManager.ts       # 窗口管理器 (单例)
│   │   ├── windowState.ts         # 窗口状态机 (单例)
│   │   ├── appLifecycle.ts        # 应用生命周期管理器 (单例)
│   │   ├── controllers/          # 业务控制器
│   │   │   └── LLMProviderController.ts  # LLM 供应商控制器
│   │   ├── handlers/            # IPC 请求处理器
│   │   │   ├── base.ts         # 处理器基类
│   │   │   ├── index.ts        # 注册所有处理器
│   │   │   ├── userHandler.ts   # 用户相关
│   │   │   ├── resumeHandler.ts # 简历相关
│   │   │   ├── settingHandler.ts # 设置/LLM 相关
│   │   │   ├── aiHrAssistantHandler.ts # AI 助手相关
│   │   │   └── windowHandler.ts # 窗口管理相关
│   │   ├── services/            # 业务服务
│   │   ├── database/            # 数据库层 (SQLite)
│   │   │   └── sqlite.ts       # DatabaseService 单例
│   │   ├── middleware/          # 中间件
│   │   └── utils/              # 工具函数 (日志、加密)
│   ├── preload/                 # Preload 脚本
│   ├── renderer/                # 渲染进程 (React 应用)
│   │   ├── src/
│   │   │   ├── App.tsx          # 应用入口，根据窗口类型路由
│   │   │   ├── components/      # React 组件
│   │   │   ├── pages/          # 页面组件
│   │   │   ├── hooks/          # 自定义 Hooks
│   │   │   ├── services/        # IPC API 服务封装
│   │   │     ├── store/         # Zustand 状态管理
│   │   │   └── styles/         # 样式文件
│   │   └── index.html          # HTML 入口
│   └── shared/                  # 共享类型和常量
│       └── types/
│           └── ipc.ts           # IPC 通道常量和类型定义
├── dist/                        # 构建输出目录
├── docs/                        # 项目文档
├── design/                      # 设计文档
├── test/                        # 测试文件
└── scripts/                     # 构建脚本
    └── electron-rebuild.js       # 原生模块重建脚本
```

## 窗口管理架构

应用支持两种窗口类型，通过状态机管理切换：

### 窗口状态机 (WindowStateManager)
- **MAIN_ONLY**: 仅主窗口 - 应用启动或主窗口正常显示时
- **MAIN_WITH_MINIBAR**: 主窗口 + Minibar 窗口 - Minibar 菜单被点击时
- **MINIBAR_ONLY**: 仅 Minibar 窗口 - 主窗口隐藏时

### WindowManager (单例)
- `showMainWindow(targetPath?)`: 显示主窗口，可选传入导航路径
- `hideMainWindow()`: 隐藏主窗口
- `showMinibarWindow()`: 显示 Minibar 窗口
- `hideMinibarWindow()`: 隐藏 Minibar 窗口
- `getMainWindow()`, `getMinibarWindow()`: 获取窗口实例
- `saveWindowState()`: 保存窗口位置和大小到文件

### 窗口检测
通过 URL hash 检测窗口类型：
- `#/?window=minibar` -> Minibar 窗口
- 其他 -> 主窗口

## IPC 通信架构

所有通信通过 IPC 进行，通道定义在 `src/shared/types/ipc.ts`：

### IPC 通道分类
- `SYSTEM`: 系统相关 (get-version, get-health)
- `USER`: 用户相关 (register, login, get-profile, update-profile, change-password, get-stats, logout)
- `RESUME`: 简历相关 (upload, list, get, update, delete, analyze, optimize, get-status, generate-questions)
- `FILE`: 文件相关 (parse, validate)
- `DATABASE`: 数据库相关 (get-path, export, import, get-stats)
- `SETTING`: 设置相关 (LLM 供应商、任务配置、模型同步)
- `AI_HR_ASSISTANT`: AI HR 助手相关 (send-message, stream-message, get-history, clear-history, generate-suggestion)
- `DEDEUPE`: 去重相关 (detect)
- `VERSION`: 版本管理相关 (create-group, add-variant, set-primary, get-versions, merge-groups, delete-group)
- `WINDOW`: 窗口管理相关 (show-main, hide-main, show-minibar, hide-minibar, set-hidden-path, get-hidden-path, clear-hidden-path, get-state, transition-state, logout)

### Handler 架构
所有 Handler 继承自 `BaseHandler`，使用 `register()` 方法注册 IPC 处理器：
```typescript
export class SettingHandler extends BaseHandler {
  constructor() {
    super();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register(IPC_CHANNELS.SETTING.PROVIDER_LIST, async () => {
      return await llmProviderController.listProviders();
    });
    // ...
  }
}
```

## 环境配置

### .env 文件配置
```bash
# GLM 4.6 API 配置 (可选，用于初始化默认供应商)
GLM_API_KEY=your_glm_api_key_here
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4

# 应用配置
PORT=3001
SQLITE_DB_PATH=./data/resumerhelper.db
UPLOAD_MAX_SIZE=10485760
UPLOAD_PATH=./uploads

# JWT 配置
JWT_SECRET=resumer-helper-secret-key-2024
JWT_EXPIRE_DAYS=30

# 日志配置
LOG_LEVEL=info
NODE_ENV=development

# Electron 配置
ELECTRON_APP_ID=com.resumerhelper.desktop
ELECTRON_APP_NAME=HRCopilot

# AI 分析配置
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=2000
AI_TIMEOUT_MS=30000
```

## 数据库架构

**数据库类型**: SQLite (better-sqlite3)
**数据库位置**: `{app.getPath('userData')}/resumerhelper.db`

### 数据库迁移
使用 `migrations` 表管理版本，当前版本 5：
- v1: initial_schema
- v2: add_user_indexes
- v3: add_deduplication_and_version_fields (resume_groups, resumes 扩展字段)
- v4: add_llm_provider_support (llm_providers, llm_task_config, llm_call_logs)
- v5: add_ai_hr_assistant_support (ai_conversations)

### 核心数据表

1. **users** - 用户表
   - id, email (UNIQUE), name, password_hash, user_type (free/vip/admin), created_at, updated_at

2. **resumes** - 简历表
   - id, user_id (FK), original_filename, original_path, original_size, original_mimetype
   - processed_content, job_description, optimization_result (JSON), evaluation (JSON)
   - interview_questions (JSON array), status (pending/processing/completed/failed)
   - content_hash (去重用), person_hash (去重用), group_id (FK)
   - is_primary, version_label, version_notes, parsed_info (JSON)
   - created_at, updated_at

3. **analyses** - 分析记录表
   - id, resume_id (FK), analysis_type, result_data (JSON), created_at

4. **settings** - 配置表
   - key (PRIMARY KEY), value, updated_at

5. **resume_groups** - 简历组表 (去重和版本管理)
   - id, user_id (FK), group_name, primary_resume_id (FK), description
   - created_at, updated_at

6. **llm_providers** - LLM 供应商配置表
   - id, provider_id (UNIQUE), name, type (openai/glm/ollama/anthropic/azure/custom)
   - base_url, api_key (加密存储), models (JSON), is_enabled, is_default
   - parameters (JSON), sort_order, created_at, updated_at

7. **llm_task_config** - LLM 任务配置表
   - task_name (PRIMARY KEY), provider_id (FK), model, parameters (JSON), updated_at
   - task_name in: resume_analysis, resume_optimization, question_generation

8. **llm_call_logs** - LLM 调用日志表
   - id, provider_id, model, task_name, request_tokens, response_tokens
   - status (success/failed), error_message, duration_ms, created_at

9. **ai_conversations** - AI 对话消息表
   - id, resume_id (FK), user_id (FK), role (user/assistant/system)
   - content, message_type (chat/suggestion/analysis), metadata (JSON)
   - token_count, is_summary, created_at

### 数据库初始化
- 自动从环境变量 `GLM_API_KEY` 初始化默认 GLM 供应商
- API Key 加密存储 (使用 `utils/encryption.ts`)
- 数据库路径存储在 `app.getPath('userData')` 目录

## LLM 服务集成

### 支持的 LLM 类型
- **openai**: OpenAI API
- **glm**: 智谱 AI (GLM-4, GLM-4-Flash, GLM-3-Turbo)
- **ollama**: Ollama 本地模型
- **anthropic**: Anthropic Claude
- **azure**: Azure OpenAI
- **custom**: 自定义 API

### LLMProviderController
负责管理 LLM 供应商配置和调用：
- `listProviders()`: 列出所有供应商
- `getProvider(providerId)`: 获取单个供应商
- `createProvider(data)`, `updateProvider(providerId, data)`, `deleteProvider(providerId)`
- `testConnection(request)`: 测试供应商连接
- `setDefaultProvider(providerId)`, `getDefaultProvider()`
- `syncModels(request)`: 同步模型列表
- `getTaskConfig(taskName)`, `updateTaskConfig(config)`, `listTaskConfigs()`

### 任务配置
每个 AI 任务可以配置独立的供应商和模型：
- `resume_analysis`: 简历分析
- `resume_optimization`: 简历优化
- `question_generation`: 面试问题生成

## 前端路由结构

```
/              -> 重定向到 /home
/login         -> LoginPage
/register      -> RegisterPage
/home          -> HomePage
/resumes       -> ResumeListPage
/resumes/:id   -> ResumeDetailPage
/upload        -> ResumeUploadPage
/settings      -> SettingsPage
```

### 窗口类型路由
通过 `window.location.hash` 检测窗口类型：
- 包含 `window=minibar` -> MinibarPage
- 其他 -> MainWindowApp (需要登录保护)

## 应用生命周期管理

### AppLifecycleManager (单例)
管理应用的安全退出流程：

1. **状态**: NORMAL (正常), QUITTING (正在退出), CLEANED (已清理)
2. **退出流程**:
   - 通知所有窗口即将退出 (`app:quitting` 事件)
   - 保存应用状态到文件
   - 保存窗口状态
   - 关闭数据库连接
   - 销毁所有窗口
3. **信号处理**: 处理 SIGINT (Ctrl+C), SIGTERM, SIGBREAK
4. **开发模式特殊处理**: 退出时终止整个进程组 (包括 concurrently 和 Vite)

注册清理回调：
```typescript
appLifecycle.registerCallbacks({
  saveWindowState: async () => { /* ... */ },
  destroyAllWindows: () => { /* ... */ },
  closeDatabase: async () => { /* ... */ },
});
```

## 状态管理

### Zustand Store
- `authStore.ts`: 用户认证状态 (user, isLoggedIn, login, logout, register...)
- `resumeStore.ts`: 简历数据状态

## TypeScript 配置

项目使用三个独立的 TypeScript 配置:
- `tsconfig.json`: 渲染进程 (React, ESNext 模块)
- `tsconfig.main.json`: 主进程 (CommonJS 模块)
- `tsconfig.preload.json`: Preload 脚本 (CommonJS 模块)

## 开发注意事项

1. **IPC 通信**: 所有主进程与渲染进程通信必须通过 IPC，使用定义好的通道
2. **Handler 注册**: 新增 Handler 需在 `handlers/index.ts` 的 `registerAllHandlers()` 中注册
3. **窗口状态切换**: 使用 `windowStateManager.transitionTo(newState)` 切换窗口状态
4. **单例模式**: WindowManager、WindowStateManager、AppLifecycleManager、DatabaseService 都是单例
5. **数据库迁移**: 新增表或字段需在 `sqlite.ts` 的 `migrations` 数组中添加迁移脚本
6. **API Key 安全**: LLM API Key 使用加密存储，返回给前端时脱敏
7. **原生模块**: better-sqlite3 需要为当前平台编译，安装后运行 `npm run electron-rebuild`
8. **开发模式退出**: 开发模式下 Ctrl+C 会终止整个进程组，包括 concurrently 和 Vite
9. **窗口类型检测**: 前端通过 URL hash (`window=minibar`) 检测窗口类型并渲染不同组件

## 当前开发状态

✅ **已完成**:
- 完整的 Electron 应用架构
- 窗口管理 (主窗口 + Minibar 窗口)
- 窗口状态机
- 应用生命周期管理
- IPC 通信系统
- SQLite 数据库集成 (含迁移)
- 多 LLM 供应商支持
- 用户认证系统
- 简历 CRUD 操作
- AI HR 助手 (流式对话)
- 简历去重和版本管理
- 前端 React 界面

🔄 **待完善**:
- 单元测试
- 完善的缓存机制
- 数据库备份和迁移策略
- 错误处理增强
- 性能优化
