# 数据库迁移指南 (MongoDB → SQLite)

## 概述

本文档描述了从 MongoDB 迁移到 SQLite 的详细步骤和变更说明。

## 迁移原因

- **简化部署**: SQLite 是嵌入式数据库，无需额外的数据库服务
- **降低资源需求**: 更少的内存和CPU占用
- **易于维护**: 单文件数据库，备份和迁移简单
- **适合中小规模**: 当前项目的用户量和数据量适合使用 SQLite

## 主要变更

### 1. 依赖包变更

#### 移除的依赖:
```bash
npm uninstall mongoose ioredis redis
```

#### 新增的依赖:
```bash
npm install better-sqlite3 sqlite3
npm install --save-dev @types/better-sqlite3
```

### 2. 数据库配置

#### 之前 (MongoDB):
```typescript
import mongoose from 'mongoose';
mongoose.connect(process.env.MONGODB_URI);
```

#### 现在 (SQLite):
```typescript
import Database from 'better-sqlite3';
const db = new Database(process.env.SQLITE_DB_PATH);
```

### 3. 数据模型变更

#### ID 类型变更:
- **之前**: `ObjectId` (MongoDB)
- **现在**: `number` (SQLite 自增主键)

#### 关联关系变更:
- **之前**: `userId: ObjectId` (引用)
- **现在**: `userId: number` (外键)

### 4. 环境变量变更

#### .env 文件更新:
```bash
# 移除
MONGODB_URI=mongodb://localhost:27017/resumer_helper
REDIS_URL=redis://localhost:6379

# 新增
SQLITE_DB_PATH=./data/resumer_helper.db
```

## 数据库表结构

### users 表
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  user_type TEXT CHECK(user_type IN ('free', 'vip', 'admin')) DEFAULT 'free',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### resumes 表
```sql
CREATE TABLE resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  original_filename TEXT NOT NULL,
  original_path TEXT NOT NULL,
  original_size INTEGER NOT NULL,
  original_mimetype TEXT NOT NULL,
  processed_content TEXT, -- JSON 格式存储
  job_description TEXT,
  optimization_result TEXT, -- JSON 格式存储
  evaluation TEXT, -- JSON 格式存储
  interview_questions TEXT, -- JSON 格式存储
  status TEXT CHECK(status IN ('uploaded', 'processing', 'completed', 'failed')) DEFAULT 'uploaded',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## 索引设计

```sql
-- 性能优化索引
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_status ON resumes(status);
CREATE INDEX idx_resumes_created_at ON resumes(created_at);
CREATE INDEX idx_users_email ON users(email);
```

## 代码适配指南

### 1. 查询方法变更

#### 之前 (MongoDB):
```typescript
const resume = await Resume.findById(resumeId);
const resumes = await Resume.find({ userId }).limit(10);
```

#### 现在 (SQLite):
```typescript
const resume = await Resume.findById(resumeId);
const { resumes } = await Resume.findByUserId(userId, 1, 10);
```

### 2. 创建方法变更

#### 之前 (MongoDB):
```typescript
const resume = new Resume(data);
await resume.save();
```

#### 现在 (SQLite):
```typescript
const resume = await Resume.create(data);
```

### 3. 更新方法变更

#### 之前 (MongoDB):
```typescript
await Resume.findByIdAndUpdate(resumeId, updateData);
```

#### 现在 (SQLite):
```typescript
await Resume.updateById(resumeId, userId, updateData);
```

## 性能特性

### SQLite 优化配置
- **WAL 模式**: 提高并发性能
- **外键约束**: 保证数据一致性
- **预编译语句**: 提高查询性能

### 性能考虑
- 适合读多写少的场景
- 单个文件数据库，便于备份
- 自动内存管理，无需手动调优

## 备份和恢复

### 备份数据库
```bash
# 直接复制数据库文件
cp ./data/resumer_helper.db ./backups/resumer_helper_backup_$(date +%Y%m%d).db
```

### 恢复数据库
```bash
# 停止应用服务
cp ./backups/resumer_helper_backup_20231201.db ./data/resumer_helper.db
# 重启应用服务
```

## 迁移验证清单

- [ ] 依赖包正确安装
- [ ] 环境变量配置正确
- [ ] 数据库表结构正确创建
- [ ] 所有API接口功能正常
- [ ] 文件上传和处理功能正常
- [ ] AI服务集成正常
- [ ] 前端页面显示正常
- [ ] 数据持久化验证通过

## 故障排除

### 常见问题

#### 1. 数据库连接失败
- 检查数据库文件路径是否正确
- 确保数据目录存在且有写入权限

#### 2. 表创建失败
- 检查磁盘空间是否充足
- 确认数据库文件路径可写

#### 3. 性能问题
- 检查是否缺少必要的索引
- 考虑增加数据库缓存大小

## 回滚方案

如果需要回滚到 MongoDB:

1. 恢复 package.json 中的依赖
2. 恢复 MongoDB 相关的配置文件
3. 恢复原有的模型文件
4. 确保数据迁移（如果有的话）

## 后续优化

1. **缓存策略**: 实现内存缓存替代 Redis
2. **数据备份**: 定期自动备份数据库文件
3. **监控**: 添加数据库性能监控
4. **分页优化**: 进一步优化大数据量分页查询