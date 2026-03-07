# HRCopilot 项目现状分析报告

> 生成时间：2026-03-07
> 项目版本：1.0.0

---

## 一、项目概况

### 1.1 基本信息

| 属性 | 值 |
|------|-----|
| 项目名称 | HRCopilot / 简历透视镜 (ResumeLens) |
| 类型 | Electron 桌面应用 |
| 版本 | 1.0.0 |
| 许可证 | MIT |
| Node.js 要求 | >= 18.0.0 |

### 1.2 产品定位

面向猎头、HR 的 AI 简历分析工具，将"信息处理"和"初步分析"外包给 AI，让人只保留最终判断权。

**核心价值**：
- 效率提升：替代 3-4 名初级顾问的简历筛选工作
- 判断显性化：将直觉判断转化为结构化输出
- 按价值收费：从"按简历数量"转为"按判断质量"

---

## 二、技术架构

### 2.1 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Electron | 28.3.3 |
| 前端 | React | 19.0.0 |
| 语言 | TypeScript | 5.6.3 |
| 数据库 | better-sqlite3 | 9.6.0 |
| UI 组件 | Ant Design | 5.22.2 |
| 状态管理 | Zustand | 5.0.1 |
| 构建工具 | Vite | 6.0.7 |
| 路由 | React Router DOM | 7.1.1 |

### 2.2 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                     渲染进程 (Renderer)                   │
│  React 19 + Ant Design + Zustand + React Router            │
│  - 页面组件 (pages/)                                      │
│  - 业务组件 (components/)                                  │
│  - 状态管理 (store/)                                      │
│  - IPC 服务封装 (services/)                               │
├─────────────────────────────────────────────────────────────┤
│                    Preload 脚本                          │
│  contextBridge 安全桥接层                                  │
├─────────────────────────────────────────────────────────────┤
│                     主进程 (Main)                         │
│  - Handler (handlers/)      - IPC 请求处理                │
│  - Controller (controllers/) - 业务逻辑控制                │
│  - Service (services/)      - 业务服务                     │
│  - Database (database/)      - SQLite 数据库               │
│  - Utils (utils/)           - 工具函数                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、功能模块现状

### 3.1 已完成功能 ✅

| 模块 | 状态 | 说明 |
|------|------|------|
| 用户认证系统 | ✅ 完成 | 注册、登录、个人信息管理、30分钟免登录 |
| 简历管理 | ✅ 完成 | 上传、列表、详情、删除、解析 |
| LLM 供应商管理 | ✅ 完成 | 支持 OpenAI、GLM、Ollama、Anthropic、Azure、自定义 |
| 任务配置 | ✅ 完成 | 独立配置各任务的供应商和模型 |
| AI HR 助手 | ✅ 完成 | 流式对话、建议生成、历史记录 |
| 简历去重 | ✅ 完成 | 基于内容哈希和人员哈希 |
| 版本管理 | ✅ 完成 | 简历分组、版本标记、主简历设置 |
| 窗口管理 | ✅ 完成 | 主窗口 + Minibar 窗口，状态机管理 |
| 数据库迁移 | ✅ 完成 | 当前版本 v5 |

### 3.2 开发中功能 🔄

| 模块 | 进度 | 完成度 |
|------|------|--------|
| JD 拆解 | 🔄 开发中 | 80% |
| 简历-JD 匹配 | 🔄 开发中 | 80% |

### 3.3 待开发功能 📋

| 模块 | 优先级 | 说明 |
|------|--------|------|
| JD 库管理 | P1 | 保存/复用 JD 模板 |
| 分析历史 | P1 | 查看历史分析记录 |
| 团队协作 | P2 | 多人共享分析结果 |
| API 开放 | P2 | 对外提供分析接口 |

---

## 四、JD 功能开发详情

### 4.1 已完成部分 ✅

#### 类型定义 (`src/shared/types/jd.ts`)
- `JDData` - JD 数据结构
- `JDCreateRequest` - 创建请求
- `JDUpdateRequest` - 更新请求
- `JDFilterParams` - 筛选参数
- `ResumeJDMatch` - 简历-JD 匹配结果
- `JD_TEMPLATES` - 预设 JD 模板

#### 数据库层 (`src/main/database/sqlite.ts`)
```sql
-- JD 表
CREATE TABLE jds (
  id INTEGER PRIMARY KEY,
  jd_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  department TEXT,
  seniority TEXT,
  location TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  description TEXT,
  requirements JSON,
  responsibilities JSON,
  skills JSON,
  status TEXT,
  resume_count INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

-- 简历-JD 匹配表
CREATE TABLE resume_jd_matches (
  id INTEGER PRIMARY KEY,
  resume_id INTEGER NOT NULL,
  jd_id TEXT NOT NULL,
  match_score INTEGER,
  skill_match_score INTEGER,
  experience_match_score INTEGER,
  education_match_score INTEGER,
  overall_assessment TEXT,
  strengths JSON,
  weaknesses JSON,
  recommendation TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE,
  FOREIGN KEY (jd_id) REFERENCES jds(jd_id) ON DELETE CASCADE,
  UNIQUE(resume_id, jd_id)
);
```

#### Handler 层 (`src/main/handlers/jdHandler.ts`)
- `handleList` - 获取 JD 列表
- `handleGet` - 获取单个 JD
- `handleCreate` - 创建 JD
- `handleUpdate` - 更新 JD
- `handleDelete` - 删除 JD
- `handleGetStats` - 获取 JD 统计
- `handleMatchResume` - 匹配简历
- `handleGetMatches` - 获取匹配列表
- `handleGetMatchesByResume` - 获取简历的所有匹配

#### AI 分析服务 (`src/main/services/aiAnalysis.ts`)
- `analyzeJDMatch()` - JD-简历匹配分析
- `buildJDMatchPrompt()` - 构建匹配提示词
- `parseJDMatchResponse()` - 解析匹配结果

#### 前端 IPC 服务 (`src/renderer/src/services/jdIpcService.ts`)
- `listJDs()` - 获取 JD 列表
- `getJD()` - 获取单个 JD
- `createJD()` - 创建 JD
- `updateJD()` - 更新 JD
- `deleteJD()` - 删除 JD
- `getJDStats()` - 获取 JD 统计
- `matchResume()` - 匹配简历
- `getMatchesByJD()` - 获取 JD 的匹配列表
- `getMatchesByResume()` - 获取简历的所有匹配

#### 前端页面和组件
- `JDListPage.tsx` - JD 列表页面
- `JD/JDForm.tsx` - JD 创建/编辑表单组件

### 4.2 需要完成的部分 ⚠️

| 任务 | 文件/位置 | 状态 |
|------|------------|------|
| JD 路由注册 | `App.tsx` | 待添加 |
| JD 详情页面 | `pages/JDDetailPage.tsx` | 待创建 |
| 匹配结果展示 | `pages/` 或 `components/` | 待创建 |
| 组件导出 | `components/index.ts` | 部分未导出 |
| 页面导出 | `pages/index.ts` | JD 相关未导出 |

---

## 五、当前 Git 状态

### 5.1 修改的文件（未提交）

```
M package-lock.json
M src/main/database/sqlite.ts          # 数据库迁移（JD 表）
M src/main/handlers/index.ts           # Handler 注册
M src/main/services/aiAnalysis.ts       # AI 分析服务
M src/preload/preload.ts               # Preload 桥接
M src/renderer/src/App.tsx             # 应用入口
M src/renderer/src/components/Layout.tsx  # 布局组件
M src/renderer/src/components/index.ts  # 组件导出
M src/renderer/src/pages/HomePage.tsx   # 首页
M src/renderer/src/pages/MinibarPage.tsx # Minibar 页面
M src/renderer/src/pages/ResumeDetailPage.tsx # 简历详情页
M src/renderer/src/pages/ResumeListPage.tsx  # 简历列表页
M src/renderer/src/pages/ResumeUploadPage.tsx # 简历上传页
M src/renderer/src/services/ipcApi.ts   # IPC API
M src/shared/types/ipc.ts              # IPC 通道定义
M vite.config.ts                       # Vite 配置
```

### 5.2 新增的文件（未追踪）

```
?? src/main/handlers/jdHandler.ts      # JD Handler
?? src/renderer/src/components/JD/    # JD 组件目录
?? src/renderer/src/pages/JDListPage.tsx  # JD 列表页
?? src/renderer/src/services/jdIpcService.ts # JD IPC 服务
?? src/shared/types/jd.ts             # JD 类型定义
```

### 5.3 临时文件

```
?? a.shshsh                           # 临时脚本
?? src/renderer/src/pages/ResumeDetailPage.tsx.bak
?? src/renderer/src/pages/ResumeListPage.tsx.bak
```

---

## 六、近期的 Git 提交历史

| 提交信息 | 描述 |
|----------|------|
| 21baa30 | Refactor: 任务配置面板 UI 优化 |
| 5362667 | Refactor: 整合 OpenAI/Anthropic/Azure 到自定义供应商 |
| 3f5ea67 | update RegisterPage |
| 4cda88 | login without inputing if last login in 30 minitus |
| fbaaa1 | Fix Minified React error #321 |
| 40c19d4 | collpsed menu & CV info Tabs |
| 1599ecb | extract CV info with AI LLM |
| 9842343 | rfining minibar display |
| b763f28 | fix issue on LLM Provider AI testing |

---

## 七、数据库结构

### 7.1 当前迁移版本

**当前版本**: v6 (包含 JD 支持)

### 7.2 核心数据表

| 表名 | 用途 |
|------|------|
| users | 用户信息 |
| resumes | 简历数据 |
| resume_groups | 简历分组 |
| analyses | 分析记录 |
| settings | 配置数据 |
| llm_providers | LLM 供应商配置 |
| llm_task_config | LLM 任务配置 |
| llm_call_logs | LLM 调用日志 |
| ai_conversations | AI 对话消息 |
| **jds** | **JD 职位描述** |
| **resume_jd_matches** | **简历-JD 匹配结果** |

---

## 八、待办事项清单

### 8.1 JD 功能完成

- [ ] 在 `App.tsx` 中添加 JD 路由
- [ ] 在 `pages/index.ts` 中导出 JD 相关页面
- [ ] 在 `components/index.ts` 中导出 JD 组件
- [ ] 创建 JDDetailPage.tsx (JD 详情页)
- [ ] 创建匹配结果展示组件
- [ ] 测试 JD CRUD 功能
- [ ] 测试简历-JD 匹配功能

### 8.2 代码清理

- [ ] 提交当前 JD 功能代码
- [ ] 删除临时文件（.bak, a.shshsh）
- [ ] 清理 package-lock.json 不必要的修改

### 8.3 代码质量

- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 运行 lint 检查
- [ ] 代码格式化

---

## 九、风险和建议

### 9.1 潜在风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 未提交代码过多 | 代码丢失风险 | 尽快提交已完成功能 |
| 测试覆盖不足 | Bug 隐患 | 补充单元和集成测试 |
| 缺少错误处理 | 用户体验差 | 完善错误提示和降级处理 |
| 文档不完整 | 维护困难 | 更新 API 文档和使用说明 |

### 9.2 建议

1. **优先完成 JD 功能**
   - 尽快完成路由注册和页面导出
   - 测试完整的 CRUD 流程
   - 提交代码建立稳定基线

2. **建立开发规范**
   - 使用分支开发功能（避免在 main 直接修改）
   - 提交前运行 lint 和测试
   - 编写清晰的 commit message

3. **完善测试**
   - 为核心功能添加单元测试
   - 添加关键路径的集成测试
   - 使用 CI/CD 自动化测试

---

## 十、总结

HRCopilot 是一个功能完善的 AI 简历分析桌面应用。核心架构稳定，大部分主要功能已完成。当前正在进行 JD（职位描述）功能的开发，已完成约 80%。

**下一步行动**：
1. 完成 JD 功能的前端路由和页面集成
2. 测试 JD 功能的完整流程
3. 提交代码清理临时文件
4. 补充测试和文档

**项目健康度**: 🟢 良好
- 架构清晰，代码组织合理
- 核心功能稳定可用
- 新功能开发按计划进行
- 需要补充测试和文档
