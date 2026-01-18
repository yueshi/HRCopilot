# HRCopilot

HRCopilot 是一款基于 Electron + TypeScript 的智能 HR 桌面应用程序，专注于 JD（职位描述）与简历的智能匹配分析。支持多 LLM 供应商，为求职者和 HR 提供简历优化、匹配度评估、面试问题生成和 AI HR 助手等强大功能。

## 核心功能

- **JD-简历匹配分析** - 智能分析简历与职位描述的匹配程度，提供详细评分和建议
- **多 LLM 供应商支持** - 集成 GLM、OpenAI、Ollama、Anthropic、Azure、自定义 API
- **AI HR 助手** - 基于简历的智能对话助手，支持流式对话
- **简历去重和版本管理** - 自动检测重复简历，支持简历分组和版本管理
- **Minibar 悬浮窗口** - 桌面悬浮工具栏，快速访问常用功能
- **用户认证系统** - 用户注册、登录、个人信息管理
- **简历解析处理** - 支持 PDF/Word 简历文件解析和结构化

## 技术栈

### 主进程
- **Electron** 28.3.3 - 跨平台桌面应用框架
- **TypeScript** 5.6.3 - 类型安全的 JavaScript
- **better-sqlite3** 9.6.0 - SQLite 数据库
- **Winston** 3.17.0 - 日志系统
- **Axios** 1.7.7 - HTTP 客户端

### 渲染进程
- **React** 19.0.0 - UI 框架
- **Vite** 6.0.7 - 构建工具
- **Ant Design** 5.22.2 - UI 组件库
- **Zustand** 5.0.1 - 状态管理
- **React Router** 7.1.1 - 路由管理

## 系统要求

- Node.js >= 18.0.0
- npm >= 8.0.0
- 支持平台：macOS、Windows、Linux

## 安装

### 1. 克隆项目

```bash
git clone <repository-url>
cd HRCopilot
```

### 2. 安装依赖

由于 Electron 二进制文件下载较慢，建议使用淘宝镜像源：

```bash
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
```

### 3. 配置环境变量

创建 `.env` 文件并配置：

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

## 开发

### 启动开发模式

```bash
npm run dev
```

这将同时启动主进程和渲染进程开发服务器。

### 代码检查和格式化

```bash
# 代码检查
npm run lint

# 代码格式化
npm run format
```

### 运行测试

```bash
npm test
```

## 构建

### 构建所有代码

```bash
npm run build
```

### 单独构建

```bash
npm run build:main      # 仅构建主进程
npm run build:preload    # 仅构建 preload
npm run build:renderer   # 仅构建渲染进程
```

### 打包应用

```bash
# 完整打包 (生成安装包)
npm run dist

# 打包为目录 (不生成安装包，用于测试)
npm run dist:dir
```

### Electron 原生模块重建

```bash
npm run electron-rebuild
```

## 项目结构

```
HRCopilot/
├── src/
│   ├── main/                      # Electron 主进程
│   │   ├── main.ts               # 主进程入口
│   │   ├── windowManager.ts       # 窗口管理器
│   │   ├── windowState.ts         # 窗口状态机
│   │   ├── appLifecycle.ts        # 应用生命周期管理
│   │   ├── controllers/          # 业务控制器
│   │   ├── handlers/            # IPC 请求处理器
│   │   ├── services/            # 业务服务
│   │   ├── database/            # 数据库层
│   │   └── utils/              # 工具函数
│   ├── preload/                 # Preload 脚本
│   ├── renderer/                # 渲染进程 (React)
│   ├── shared/                  # 共享类型和常量
├── dist/                        # 构建输出目录
├── docs/                        # 项目文档
├── design/                      # 设计文档
├── test/                        # 测试文件
├── package.json
├── tsconfig.json
└── README.md
```

## 数据库

项目使用 SQLite 数据库 (better-sqlite3)，数据存储位置：

- **开发环境**: `./data/resumerhelper.db`
- **生产环境**: `{app.getPath('userData')}/resumerhelper.db`

### 核心数据表

- `users` - 用户表
- `resumes` - 简历表
- `resume`_groups - 简历组表
- `analyses` - 分析记录表
- `settings` - 配置表
- `llm_providers` - LLM 供应商配置表
- `llm_task_config` - LLM 任务配置表
- `llm_call_logs` - LLM 调用日志表
- `ai_conversations` - AI 对话消息表

## 窗口管理

应用支持两种窗口类型，通过状态机管理切换：

1. **主窗口** - 主要功能界面
2. **Minibar 窗口** - 悬浮工具栏，提供快速访问

### 窗口状态

- `MAIN_ONLY` - 仅主窗口
- `MAIN_WITH_MINIBAR` - 主窗口 + Minibar 窗口
- `MINIBAR_ONLY` - 仅 Minibar 窗口

## LLM 供应商配置

### 支持的 LLM 类型

- **OpenAI** - OpenAI API
- **GLM** - 智谱 AI (GLM-4, GLM-4-Flash, GLM-3-Turbo)
- **Ollama** - 本地模型
- **Anthropic** - Anthropic Claude
- **Azure** - Azure OpenAI
- **Custom** - 自定义 API

### 任务配置

每个 AI 任务可以配置独立的供应商和模型：

- `resume_analysis` - 简历分析
- `resume_optimization` - 简历优化
- `question_generation` - 面试问题生成

## 开发注意事项

1. **IPC 通信** - 所有主进程与渲染进程通信必须通过 IPC
2. **Handler 注册** - 新增 Handler 需在 `handlers/index.ts` 中注册
3. **数据库迁移** - 新增表或字段需在 `sqlite.ts` 添加迁移脚本
4. **API Key 安全** - LLM API Key 使用加密存储
5. **原生模块** - better-sqlite3 需要为当前平台编译

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请提交 Issue。
