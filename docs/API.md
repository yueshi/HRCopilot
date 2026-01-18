# ResumerHelper API 文档

## 概述

ResumerHelper 后端 API 基于 Koa + TypeScript 架构，提供简历优化、评估和面试问题生成等 AI 服务。

## 基础信息

- **基础URL**: `http://localhost:3001/api`
- **端口**: 3001
- **API版本**: v1.0.0
- **内容类型**: `application/json`

## 认证

目前使用简化的用户系统，后续将实现 JWT 认证。

## API 端点

### 1. 健康检查

```http
GET /health
```

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-19T04:40:32.000Z",
  "service": "ResumerHelper API",
  "version": "1.0.0"
}
```

### 2. API 信息

```http
GET /api
```

**响应示例**:
```json
{
  "message": "ResumerHelper API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "api": "/api",
    "resume": "/api/resume"
  }
}
```

## 简历相关 API

### 1. 获取简历列表

```http
GET /api/resume?page=1&limit=10
```

**查询参数**:
- `page` (可选): 页码，默认为 1
- `limit` (可选): 每页数量，默认为 10

**响应示例**:
```json
{
  "success": true,
  "data": {
    "resumes": [],
    "pagination": {
      "current": 1,
      "pageSize": 10,
      "total": 0,
      "pages": 0
    }
  }
}
```

### 2. 上传简历

```http
POST /api/resume/upload
Content-Type: multipart/form-data
```

**请求参数**:
- `file`: 简历文件 (PDF/Word)
- `jobDescription` (可选): 职位描述

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "resume-id-123",
    "filename": "resume.pdf",
    "size": 1024000,
    "mimetype": "application/pdf",
    "status": "uploaded",
    "uploadedAt": "2025-12-19T04:40:47.000Z",
    "jobDescription": "高级前端工程师"
  }
}
```

### 3. 获取简历详情

```http
GET /api/resume/{id}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "_id": "resume-id-123",
    "userId": "user-id-456",
    "originalFile": {
      "filename": "resume.pdf",
      "size": 1024000,
      "mimetype": "application/pdf"
    },
    "processedContent": {
      "rawText": "简历内容...",
      "personalInfo": {},
      "education": [],
      "workExperience": [],
      "skills": [],
      "projects": []
    },
    "jobDescription": "高级前端工程师",
    "optimizationResult": {
      "optimizedContent": "优化后的简历内容...",
      "suggestions": ["建议1", "建议2"],
      "improvementAreas": ["技能匹配度", "关键词覆盖"]
    },
    "evaluation": {
      "keywordMatch": 85,
      "skillMatch": 80,
      "overallScore": 82,
      "missingKeywords": ["React", "TypeScript"],
      "recommendations": ["建议1", "建议2"]
    },
    "interviewQuestions": [
      {
        "question": "请介绍一下你的React项目经验",
        "category": "技术问题",
        "difficulty": "medium"
      }
    ],
    "status": "completed",
    "createdAt": "2025-12-19T04:40:32.000Z",
    "updatedAt": "2025-12-19T04:40:50.000Z"
  }
}
```

### 4. 优化简历

```http
POST /api/resume/{id}/optimize
Content-Type: application/json
```

**请求体**:
```json
{
  "jobDescription": "高级前端工程师，要求精通React、TypeScript，有3年以上经验"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "简历优化已开始，请稍后查看结果",
  "data": {
    "id": "resume-id-123",
    "status": "processing"
  }
}
```

### 5. 获取处理状态

```http
GET /api/resume/{id}/status
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "progress": "100%",
    "completedSteps": [
      "文件上传",
      "内容解析",
      "AI优化",
      "简历评估",
      "问题生成"
    ],
    "totalSteps": [
      "文件上传",
      "内容解析",
      "AI优化",
      "简历评估",
      "问题生成"
    ]
  }
}
```

### 6. 生成面试问题

```http
POST /api/resume/{id}/questions
Content-Type: application/json
```

**请求体**:
```json
{
  "questionCount": 5
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "question": "请介绍一下你的React项目经验",
        "category": "技术问题",
        "difficulty": "medium"
      }
    ],
    "count": 1
  }
}
```

### 7. 删除简历

```http
DELETE /api/resume/{id}
```

**响应示例**:
```json
{
  "success": true,
  "message": "简历删除成功"
}
```

### 8. 更新简历状态

```http
PATCH /api/resume/{id}/status
Content-Type: application/json
```

**请求体**:
```json
{
  "status": "processing"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "resume-id-123",
    "status": "processing",
    "updatedAt": "2025-12-19T04:40:50.000Z"
  }
}
```

## 状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

## 常见错误码

| 错误码 | 说明 |
|--------|------|
| NOT_FOUND | 资源不存在 |
| NO_FILE | 未找到上传的文件 |
| INVALID_FILE_TYPE | 不支持的文件类型 |
| FILE_TOO_LARGE | 文件大小超过限制 |
| MISSING_JOB_DESCRIPTION | 职位描述不能为空 |
| UPLOAD_FAILED | 文件上传失败 |
| OPTIMIZE_FAILED | 简历优化失败 |
| PROCESSING_FAILED | 处理失败 |

## 文件上传限制

- **支持格式**: PDF (.pdf), Word (.doc, .docx)
- **文件大小**: 最大 10MB
- **文件数量**: 单次上传 1 个文件

## AI 服务特性

### GLM 4.6 集成
- **简历优化**: 基于职位描述智能优化简历内容
- **简历评估**: 关键词匹配度、技能匹配度评分
- **面试问题生成**: 根据简历和职位生成针对性问题

### 处理流程
1. 文件上传和解析
2. 内容提取和结构化
3. AI 优化和评估
4. 面试问题生成
5. 结果返回

## 开发环境配置

### 环境变量
```env
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/resumer_helper
GLM_API_KEY=your_glm_api_key
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
UPLOAD_MAX_SIZE=10485760
UPLOAD_PATH=./uploads
```

### 运行命令
```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 启动生产版本
npm start
```

## 数据模型

### 简历模型 (Resume)
```typescript
interface IResume {
  _id: string;
  userId: string;
  originalFile: {
    filename: string;
    path: string;
    size: number;
    mimetype: string;
  };
  processedContent: {
    rawText?: string;
    personalInfo?: Record<string, any>;
    education?: Array<any>;
    workExperience?: Array<any>;
    skills?: Array<string>;
    projects?: Array<any>;
  };
  jobDescription?: string;
  optimizationResult?: {
    optimizedContent: string;
    suggestions: Array<string>;
    improvementAreas: Array<string>;
  };
  evaluation?: {
    keywordMatch: number;
    skillMatch: number;
    overallScore: number;
    missingKeywords: Array<string>;
    recommendations: Array<string>;
  };
  interviewQuestions?: Array<{
    question: string;
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}
```

## 技术栈

- **后端框架**: Koa
- **语言**: TypeScript
- **数据库**: MongoDB + Redis
- **AI服务**: GLM 4.6
- **文件处理**: pdf-parse, mammoth
- **身份验证**: JWT (计划中)
- **API文档**: 本文档

## 下一步开发计划

1. 用户认证系统 (JWT)
2. 文件上传功能完善
3. Redis 缓存优化
4. API 限流和安全加固
5. 监控和日志系统
6. 部署配置