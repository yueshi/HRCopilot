# Web Server 清理和代码迁移计划

## 📋 需要清理的目录
- `server/` - 旧的 Web 服务器代码
- `client/` - 旧的前端代码（已迁移到 `src/renderer/`）
- `shared/` - 已迁移到 `src/shared/`

## 🔄 代码迁移策略

### 从 server/ 迁移到 src/main/

#### 需要保留和迁移的代码：
1. **config/database.ts** → src/main/database/sqlite.ts (已优化)
2. **services/fileParser.ts** → src/main/services/fileParser.ts (需要修复)
3. **controllers/** → src/main/controllers/ (需要适配 Electron)
4. **routes/** → src/main/routes/ (需要适配 Electron)
5. **middleware/** → src/main/middleware/ (需要适配 Electron)
6. **models/** → src/main/models/ (需要适配 SQLite)

### 从 client/ 迁移到 src/renderer/

#### 需要保留的组件：
1. **components/** → src/renderer/src/components/ (大部分可用)
2. **pages/** → src/renderer/src/pages/ (大部分可用)
3. **hooks/** → src/renderer/src/hooks/ (大部分可用)
4. **services/** → src/renderer/src/services/ (需要适配 Electron API)
5. **store/** → src/renderer/src/store/ (大部分可用)
6. **types/** → src/shared/types/ (已整合)

## 🗑️ 清理步骤

### 步骤 1: 备份有用代码
- 复制需要迁移的文件到临时目录
- 确保重要的业务逻辑不丢失

### 步骤 2: 迁移核心代码
- 将 server/services 中的文件解析逻辑迁移到 src/main/services
- 将 client/components 中的有用组件迁移到 src/renderer/src

### 步骤 3: 清理旧目录
- 删除 server/ 目录
- 删除 client/ 目录
- 删除 shared/ 目录（如果内容已迁移）

### 步骤 4: 更新项目结构
- 确保所有引用路径正确
- 更新 package.json 脚本
- 验证项目功能