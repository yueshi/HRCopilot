# SSO 集成本地 Web 服务集成实现摘要

## 实现日期
2026-03-08

## 已完成的工作

### 1. 数据库扩展
- ✅ 创建数据库迁移 v7，扩展 `users` 表添加 SSO 相关字段
- ✅ 新增字段：
  - `sso_user_id`: 云端用户 ID
  - `sso_token`: 加密存储的 SSO Token
  - `sso_refresh_token`: 加密存储的刷新 Token
  - `sso_token_expires_at`: Token 过期时间

### 2. 后端 SSO 服务
- ✅ 创建 `src/main/services/ssoAuthService.ts`
  - `authenticate(email, password)`: 调用云端 SSO API
  - `syncUser(ssoUserData)`: 同步用户数据到本地
  - `getSSOToken(userId)`: 获取 SSO Token
  - `refreshToken(refreshToken)`: 刷新 Token
  - `validateToken(token)`: 验证 Token

### 3. IPC 通信
- ✅ 创建 `src/main/handlers/ssoHandler.ts`
- ✅ 注册以下 IPC 通道：
  - `sso:login`: SSO 登录
  - `sso:get-token`: 获取 SSO Token
  - `sso:validate-token`: 验证 Token
  - `sso:logout`: SSO 登出
  - `sso:get-config`: 获取 SSO 配置
  - `sso:is-available`: 检查 SSO 是否可用

### 4. 类型定义
- ✅ 在 `src/shared/types/ipc.ts` 中添加 SSO 通道定义
- ✅ 在 `src/shared/types/api.ts` 中添加 SSO 相关类型：
  - `SSOUserInfo`: SSO 用户信息
  - `SSOToken`: SSO Token 结构
  - `SSOLoginRequest`: 登录请求
  - `SSOLoginResponse`: 登录响应
  - `SSOConfig`: SSO 配置

### 5. 前端 SSO 登录
- ✅ 创建 `src/renderer/src/pages/SSOLoginPage.tsx`
- ✅ 创建 `src/renderer/src/services/ssoIpcService.ts`
- ✅ 在 `src/renderer/src/store/authStore.ts` 中添加 `ssoLogin` 方法
- ✅ 在 `src/renderer/src/pages/LoginPage.tsx` 中添加 SSO 登录入口

### 6. 内嵌 Web 页面
- ✅ 创建 `src/main/preload/webviewPreload.ts`
- ✅ 创建 `src/renderer/src/pages/EmbeddedWebPage.tsx`
- ✅ 创建 `src/renderer/src/styles/EmbeddedWebPage.css`
- ✅ 在 `src/renderer/src/App.tsx` 中添加 `/embedded` 路由
- ✅ 在 `src/renderer/src/components/Layout.tsx` 中添加导航项

### 7. SSO 配置管理
- ✅ 创建 `src/renderer/src/components/Settings/SSOConfigPanel.tsx`
- ✅ 在 `src/renderer/src/pages/SettingsPage.tsx` 中添加 SSO 配置 Tab
- ✅ 在 `src/preload/preload.ts` 中暴露 SSO API

### 8. 构建配置
- ✅ 在 `package.json` 中添加 webviewPreload 构建脚本
- ✅ 在 `vite.config.ts` 中添加 `@ant-design/icons` 别名
- ✅ 在 `vite.config.ts` 中添加 `@/components/Settings` 别名

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                  HRCopilot 主窗口                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐          │
│  │ 现有导航    │  │  新增 Tab   │  │ 设置/其他   │          │
│  │ (简历等)    │  │ (OpenClaw) │  │            │          │
│  └────────────┘  └────────────┘  └────────────┘          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  webview 加载          │
              │  http://localhost:5173 │
              │  ?token=xxx           │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  webview 通信          │
              │  (postMessage API)     │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  Electron Main Process  │
              │  SSOHandler            │
              │  SSOAuthService        │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │  云端 SSO API          │
              │  (自定义认证)          │
              └─────────────────────────┘
```

## 认证流程

### SSO 登录流程
1. 用户点击 "SSO 登录" 按钮
2. 填写用户名密码
3. HRCopilot 调用云端 SSO API 验证
4. 云端返回用户信息和认证 Token
5. HRCopilot 在本地创建/更新用户记录
6. 生成本地 JWT Token
7. 设置登录状态
8. 加载内嵌页面，携带 Token

### Token 管理流程
1. **Token 存储**: 加密存储到数据库 `users.sso_token`
2. **Token 验证**: 检查 `sso_token_expires_at` 是否过期
3. **Token 刷新**: 当 Token 过期时，使用 `sso_refresh_token` 刷新
4. **Token 传递**: 通过 webview preload 脚本注入到内嵌页面

## 安全措施

1. **Token 加密存储**: 使用 `utils/encryption.ts` 加密 SSO Token
2. **Webview 安全隔离**: 使用 `contextIsolation=true`
3. **Token 不存储在前端 localStorage**: 只通过 preload 脚本传递
4. **通信来源验证**: 验证 postMessage 来源
5. **短期 Token**: 使用短期 Access Token + 长期 Refresh Token

## 下一步工作

### 必要配置
1. **云端 SSO API**: 需要配置真实的 SSO 服务地址
2. **客户端 ID**: 需要从 SSO 服务获取并配置
3. **本地 Web 服务**: 确保本地 Web 服务运行在 5173 端口

### 测试验证
1. **SSO 登录测试**: 测试完整的登录流程
2. **Token 刷新测试**: 测试 Token 过期后的刷新机制
3. **内嵌页面测试**: 测试 webview 加载和通信
4. **配置保存测试**: 测试配置的保存和读取

### 待实现功能
1. **配置保存 API**: 在后端实现保存 SSO 配置的 Handler
2. **Token 自动刷新**: 在 SSOAuthService 中实现自动刷新逻辑
3. **错误处理增强**: 添加更详细的错误处理和重试机制
4. **日志记录**: 添加更完善的日志记录

## 新增文件清单

```
src/main/services/ssoAuthService.ts
src/main/handlers/ssoHandler.ts
src/main/preload/webviewPreload.ts
src/renderer/src/pages/SSOLoginPage.tsx
src/renderer/src/pages/EmbeddedWebPage.tsx
src/renderer/src/services/ssoIpcService.ts
src/renderer/src/components/Settings/SSOConfigPanel.tsx
src/renderer/src/styles/EmbeddedWebCSO.css
```

## 修改文件清单

```
src/shared/types/ipc.ts
src/shared/types/api.ts
src/shared/types/index.ts
src/main/database/sqlite.ts
src/main/handlers/index.ts
src/preload/preload.ts
src/renderer/src/store/authStore.ts
src/renderer/src/services/index.ts
src/renderer/src/pages/LoginPage.tsx
src/renderer/src/App.tsx
src/renderer/src/components/Layout.tsx
src/renderer/src/pages/SettingsPage.tsx
package.json
vite.config.ts
```

## 技术栈

- **后端**: TypeScript, better-sqlite3, axios, bcryptjs
- **前端**: React 19, TypeScript, Zustand, Ant Design
- **IPC**: Electron IPC
- **构建**: Vite, esbuild, tsc

## 备注

1. 所有代码已通过 TypeScript 编译检查
2. 主进程和渲染进程都能成功构建
3. 数据库迁移已正确实现
4. IPC 通道已正确注册和暴露
