# 云端认证集成方案

## 场景说明

云端 Web 服务提供：
1. 用户/密码登录认证
2. Token 方式访问 API

**不包含标准 SSO 协议（OAuth/OIDC）**

## 架构优化

### 重命名 SSO → CloudAuth

将原 SSO 模块重构为云端认证模块，功能更符合实际场景：

- **认证方式**：用户名/密码 → 云端验证 → 返回 Token
- **Token 用途**：后续调用云端 API 时携带
- **本地数据**：同步用户信息到本地数据库

### 核心文件结构

```
src/main/
├── services/
│   └── cloudAuthService.ts        # 云端认证服务（原 ssoAuthService.ts）
├── handlers/
│   └── cloudAuthHandler.ts        # 云端认证处理器（原 ssoHandler.ts）
├── database/
│   └── sqlite.tsugs               # 数据库表扩展

src/renderer/src/
├── pages/
│   └── CloudLoginPage.tsx         # 云端登录页面（原 SSOLoginPage.tsx）
├── services/
│   └── cloudAuthIpcService.ts     # 云端认证服务（原 ssoIpcService.ts）
├── components/
│   └── Settings/
│       └── CloudAuthConfigPanel.tsx  # 云端认证配置（原 SSOConfigPanel.tsx）
└── store/
    └── authStore.ts                # 添加 cloudLogin 方法
```

## API 接口规范

### 1. 登录接口

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password"
}

响应:
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "username": "user@example.com",
      "name": "User Name",
      "email": "user@example.com",
      "avatar": "https://...",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}

错误:
{
  "success": false,
  "message": "用户名或密码错误"
}
```

### 2. 获取用户信息接口

```http
GET /api/user/info
Authorization: Bearer {token}

响应:
{
  "success": true,
  "data": {
    "id": 123,
    "username": "user@example.com",
    "name": "User Name",
    "email": "user@example.com",
    "avatar": "https://...",
    "role": "user"
  }
}
```

### 3. Token 验证接口（可选）

如果云端提供验证接口：

```http
POST /api/auth/validate
Authorization: Bearer {token}

响应:
{
  "valid": true
}
```

## 认证流程

```
┌─────────────────────────────────────────────────────────┐
│                      用户流程                           │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  1. 用户点击 "云端登录" 按钮                           │
│  2. 输入云端账号和密码                                 │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  3. 前端调用 cloudAuthService.login(username, password) │
│  4. 后端发送请求到云端 /api/auth/login                 │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  5. 云端验证成功，返回用户信息和 Token                 │
│     {                                                  │
│       user: { id, username, name, email, ... },       │
│       token: "eyJhbGci..."                            │
│     }                                                  │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  6. 检查本地数据库是否已存在该用户（通过 email）        │
│  7. 如果存在：更新用户信息和云端 Token                 │
│  8. 如果不存在：创建新用户并存储云端 Token              │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  9. 生成本地 JWT Token（用于本地应用认证）              │
│  10. 设置登录状态，跳转到主页面                         │
└─────────────────────────────────────────────────────────┘
```

## 数据库设计

### users 表扩展字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `cloud_user_id` | INTEGER | 云端用户 ID |
| `cloud_username` | VARCHAR | 云端用户名 |
| `cloud_token` | TEXT | 加密存储的云端 Token |
| `cloud_token_expires_at` | INTEGER | Token 过期时间戳（毫秒） |

### 配置存储在 settings 表

| key | value | 说明 |
|-----|-------|------|
| `cloud_api_url` | `{"value": "https://api.example.com"}` | 云端 API 地址 |
| `cloud_auth_enabled` | `{"value": true}` | 是否启用云端认证 |

## 安全措施

1. **Token 加密存储**：使用应用级加密密钥加密 `cloud_token`
2. **HTTPS 通信**：强制使用 HTTPS 传输 Token
3. **Token 传递**：调用云端 API 时自动添加 Authorization header
4. **配置保护**：配置信息中不显示 Token 明文

## 配置界面

### CloudAuthConfigPanel

```tsx
┌─────────────────────────────────────────┐
│  云端认证配置                            │
├─────────────────────────────────────────┤
│  ☑ 启用云端登录                          │
│                                          │
│  API 地址:                               │
│  ┌─────────────────────────────────┐     │
│  │ https://api.example.com        │     │
│  └─────────────────────────────────┘     │
│                                          │
│  [保存配置]  [测试连接]                  │
└─────────────────────────────────────────┘
```

## 实现步骤

### Step 1: 重构核心服务
- 重命名 `ssoAuthService.ts` → `cloudAuthService.ts`
- 简化认证逻辑，移除 OAuth 相关代码
- 实现基础的用户/密码认证

### Step 2: 更新 Handler
- 重命名 `ssoHandler.ts` → `cloudAuthHandler.ts`
- 更新 IPC 通道名称
- 保留登录、Token 管理、配置管理接口

### Step 3: 更新前端
- 重命名相关组件和服务
- 简化登录表单（只保留用户名/密码）
- 更新配置界面

### Step 4: 更新数据库迁移
- 保留 `sso_user_id` 字段（或重命名为 `cloud_user_id`）
- 添加 `cloud_username` 字段

### Step 5: 更新类型定义
- 统一使用 `CloudAuth*` 前缀的类型名
- 更新 IPC 通道常量

## API 调用示例

### 调用云端 API 的工具函数

```typescript
// src/main/services/cloudApiService.ts
export class CloudApiService {
  private async getCloudToken(userId: number): Promise<string | null> {
    return await cloudAuthService.getCloudToken(userId);
  }

  public async callApi<T>(
    userId: number,
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const token = await this.getCloudToken(userId);
    if (!token) {
      throw new Error("未获取到云端 Token");
    }

    const response = await axios({
      ...options,
      url: `${this.config.apiUrl}${endpoint}`,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    return response.data;
  }
}
```

## 优势

1. **架构清晰**：简化为标准的远程认证模式
2. **易于实现**：无需复杂 SSO 协议支持
3. **灵活扩展**：未来可轻松添加其他认证方式
4. **安全可靠**：Token 加密存储，安全传递
5. **兼容性好**：适配大多数 RESTful API 服务

## 与原 SSO 方案对比

| 特性 | 原 SSO 方案 | 优化后 CloudAuth 方案 |
|------|------------|---------------------|
| 认证协议 | OAuth/OIDC | 简单用户/密码 |
| Token 类型 | Access + Refresh | 单一 Token |
| 配置项 | 5 项 | 2 项（API 地址、启用开关） |
| 复杂度 | 高 | 低 |
| 适用场景 | 标准 SSO 服务 | 通用 RESTful API |

## 下一步

1. 创建 `cloudAuthService.ts` 替换原 `ssoAuthService.ts`
2. 更新相关 Handler 和前端组件
3. 迁移数据库字段
4. 更新类型定义和 IPC 通道
