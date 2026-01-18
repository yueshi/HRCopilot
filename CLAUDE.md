# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

ResumerHelper 是一个基于 Electron + TypeScript 的桌面应用程序，专注于智能 JD（职位描述）与简历匹配分析。项目采用 Electron 三层架构，集成 GLM 4.6 大语言模型，为求职者提供简历优化、匹配度评估和面试问题生成等功能。

## 核心功能

1. **JD-简历匹配分析** - 智能分析简历与职位描述的匹配程度
2. **匹配度评估系统** - 关键词覆盖度、技能匹配度、整体匹配度评分
3. **智能面试问题生成** - 基于简历和JD生成针对性面试问题
4. **简历解析处理** - 支持 PDF/Word 简历文件解析和结构化
5. **用户认证系统** - 用户注册、登录、个人信息管理

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

## 架构和技术栈

### Electron 三层架构

**Main Process** (`src/main/`)
- Electron 主进程，管理应用生命周期和窗口
- 负责系统 API 访问、数据库操作、文件系统交互
- 提供 IPC (Inter-Process Communication) 服务接口

**Preload Script** (`src/preload/`)
- 安全桥接层，通过 contextBridge 暴露 API
- 隔离渲染进程与主进程的直接访问

**Renderer Process** (`src/renderer/`)
- React 19 应用，负责 UI 渲染和用户交互
- 通过 preload 暴露的 API 与主进程通信

### 技术栈

**主进程**:
- Electron 28.3.3
- TypeScript 5.6.3
- better-sqlite3 9.6.0 (SQLite 数据库)
- GLM 4.6 API (智谱 AI)
- Winston 3.17.0 (日志)
- pdf-parse, mammoth (文件解析)
- bcryptjs (密码加密)

**渲染进程**:
- React 19.0.0
- TypeScript 5.6.3
- Vite 6.0.7 (构建工具)
- Ant Design 5.22.2 (UI 组件库)
- Zustand 5.0.1 (状态管理)
- React Router 7.1.1 (路由)

## 核心目录结构

```
ResumerHelper/
├── src/
│   ├── main/                  # Electron 主进程
│   │   ├── main.ts           # 主进程入口
│   │   ├── controllers/       # 业务控制器
│   │   ├── handlers/         # IPC 请求处理器
│   │   ├── services/         # 业务服务 (AI、文件解析)
│   │   ├── database/         # 数据库层 (SQLite)
│   │   ├── middleware/       # 中间件 (认证、上传)
│   │   └── utils/           # 工具函数 (日志、加密)
│   ├── preload/              # Preload 脚本
│   ├── renderer/             # 渲染进程 (React 应用)
│   │   ├── src/
│   │   │   ├── components/  # React 组件
│   │   │   ├── pages/       # 页面组件
│   │   │   ├── hooks/       # 自定义 Hooks
│   │   │   ├── services/    # IPC API 服务封装
│   │   │   ├── store/       # Zustand 状态管理
│   │   │   └── styles/      # 样式文件
│   │   └── index.html       # HTML 入口
│   └── shared/               # 共享类型和常量
├── dist/                     # 构建输出目录
├── docs/                     # 项目文档
├── design/                   # 设计文档
└── test/                     # 测试文件
```

## IPC 通信架构

所有通信通过 IPC 进行，通道定义在 `src/shared/types/ipc.ts`：

**IPC 通道分类**:
- `SYSTEM`: 系统相关 (get-version, get-health)
- `USER`: 用户相关 (register, login, get-profile, update-profile, change-password, get-stats, logout)
- `RESUME`: 简历相关 (upload, list, get, update, delete, analyze, optimize, get-status, generate-questions)
- `FILE`: 文件相关 (parse, validate)
- `DATABASE`: 数据库相关 (get-path, export, import, get-stats)

IPC 调用通过 `window.electronAPI` 暴露，例如：
```typescript
const result = await window.electronAPI.resume.list({ page: 1, limit: 10 });
```

## 环境配置

### .env 文件配置
```bash
# GLM 4.6 API 配置 (必需)
GLM_API_KEY=your_glm_api_key_here
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions

# 应用配置
PORT=3001
SQLITE_DB_PATH=./data/resumer_helper.db
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
ELECTRON_APP_NAME=ResumerHelper

# AI 分析配置
AI_TEMPERATURE=0.3
AI_MAX_TOKENS=2000
AI_TIMEOUT_MS=30000
```

## 数据库架构

**数据库类型**: SQLite (better-sqlite3)
**数据库位置**: `{app.getPath('userData')}/resumerhelper.db`

**核心数据表**:

1. **users** - 用户表
   - id, email (UNIQUE), name, password_hash, user_type, created_at, updated_at

2. **resumes** - 简历表
   - id, user_id (FK), original_filename, original_path, processed_content (JSON),
     job_description, optimization_result (JSON), evaluation (JSON),
     interview_questions (JSON array), status, created_at, updated_at

3. **analyses** - 分析记录表
   - id, resume_id (FK), analysis_type, result_data (JSON), created_at

4. **settings** - 配置表
   - key (PRIMARY KEY), value, updated_at

## AI 服务集成

**GLM 4.6 服务配置**:
- 模型: `glm-4.6`
- 温度: `0.3` (保证输出稳定性)
- 最大 token: `2000`

**AI 功能**:
1. **简历分析**: 分析简历与 JD 匹配度，返回评分和建议
2. **面试问题生成**: 基于简历和 JD 生成针对性面试问题

## 前端路由结构

```
/              -> 重定向到 /home
/login         -> LoginPage
/register      -> RegisterPage
/home          -> HomePage
/resumes       -> ResumeListPage
/resumes/:id   -> ResumeDetailPage
/upload        -> ResumeUploadPage
```

所有主页面都需要登录保护 (`ProtectedRoute` 组件)。

## 状态管理

**Zustand Store**:
- `authStore.ts`: 用户认证状态 (user, isLoggedIn, login, logout, register...)
- `resumeStore.ts`: 简历数据状态

## TypeScript 配置

项目使用三个独立的 TypeScript 配置:
- `tsconfig.json`: 渲染进程 (React, ESNext 模块)
- `tsconfig.main.json`: 主进程 (CommonJS 模块)
- `tsconfig.preload.json`: Preload 脚本 (CommonJS 模块)

## 开发注意事项

1. **IPC 通信**: 所有主进程与渲染进程通信必须通过 IPC，使用定义好的通道
2. **异步处理**: JD-简历匹配分析是异步过程，使用状态轮询获取结果
3. **JD必需性**: 匹配分析需要提供职位描述(JD)，否则只能进行基础的简历解析
4. **文件安全**: 严格的文件类型和大小验证
5. **类型安全**: 全栈 TypeScript，严格的类型检查
6. **原生模块**: better-sqlite3 需要为当前平台编译，安装后运行 `npm run electron-rebuild`
7. **数据库路径**: SQLite 数据库存储在 Electron 的 userData 目录中，路径与平台相关

## 当前开发状态

✅ **已完成**:
- 完整的 Electron 应用架构
- IPC 通信系统
- SQLite 数据库集成
- 文件上传和解析 (PDF/Word)
- GLM 4.6 AI 分析集成
- 用户认证系统
- 简历 CRUD 操作
- 前端 React 界面

🔄 **待完善**:
- 单元测试
- 完善的缓存机制
- 数据库备份和迁移策略
- 错误处理增强
- 性能优化
