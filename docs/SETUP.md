# ResumerHelper 安装和配置指南

本文档指导您如何安装依赖、配置环境变量并运行 ResumerHelper 应用。

## 目录

- [环境配置](#环境配置)
- [依赖安装](#依赖安装)
- [运行应用](#运行应用)
- [打包发布](#打包发布)
- [故障排除](#故障排除)

## 环境配置

### 1. GLM API Key 配置

**获取 GLM API Key**

1. 前往 [智谱 AI 开放平台](https://open.bigmodel.cn/)
2. 注册/登录账号
3. 创建 API Key
4. 记录您的 API Key

**配置 API Key**

在项目根目录创建 `.env` 文件：

```bash
# 复制示例文件
cp .env.example .env
```

然后编辑 `.env` 文件，填写您的 API Key：

```bash
GLM_API_KEY=your_actual_api_key_here
```

### 2. 环境变量说明

`.env` 文件支持以下环境变量：

| 变量名 | 必需 | 默认值 | 说明 |
|---------|------|--------|------|
| `GLM_API_KEY` | ✅ 是 | - | GLM 4.6 API 密钥 |
| `GLM_API_URL` | 否 | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | GLM API 地址 |
| `PORT` | 否 | `3001` | KOA 服务器端口 |
| `SQLITE_DB_PATH` | 否 | `./data/resumer_helper.db` | SQLite 数据库文件路径 |
| `UPLOAD_MAX_SIZE` | 否 | `10485760` | 文件上传最大大小（10MB） |
| `UPLOAD_PATH` | 否 | `./uploads` | 文件上传保存路径 |
| `JWT_SECRET` | 否 | `resumer-helper-secret-key-2024` | JWT 加密密钥 |
| `JWT_EXPIRE_DAYS` | 否 | `30` | JWT 过期时间（天） |
| `LOG_LEVEL` | 否 | `info` | 日志级别：debug, info, warn, error |
| `LOG_FILE_PATH` | 否 | - | 日志文件路径（可选） |
| `NODE_ENV` | 否 | `development` | 运行环境：development, production |
| `HOT_RELOAD` | 否 | `false` | 是否启用热重载 |

## 依赖安装

### 安装所有依赖

```bash
# 安装项目依赖
npm install

# 或者使用 yarn
# yarn install
```

### 首次安装特定依赖

```bash
# 仅安装生产依赖（更快）
npm install --production
```

### 验证依赖安装

运行以下命令验证所有依赖已正确安装：

```bash
# 检查 node_modules 是否存在
ls node_modules

# 验证关键依赖
npm list better-sqlite3
npm list electron
```

## 运行应用

### 开发模式运行

```bash
# 启动开发服务器（同时启动 main、preload、renderer 进程）
npm run dev
```

**开发模式特点：**
- 启用 source map 便于调试
- 启用热重载（如果配置）
- 窗口开发者工具
- 详细的日志输出

### 生产模式构建

```bash
# 执行完整构建（编译所有模块）
npm run build
```

### 运行构建后的应用

```bash
# macOS
electron dist/main/main.js

# Windows
electron dist/main/main.js

# Linux
electron dist/main/main.js
```

## 打包发布

### 构建安装包

```bash
# macOS DMG 安装包
npm run dist:mac

# Windows NSIS 安装包
npm run dist:win

# Linux AppImage 安装包
npm run dist:linux
```

### 打包说明

Electron Builder 支持以下打包格式：

| 平台 | 格式 | 输出文件 | 说明 |
|--------|------|----------|------|
| macOS | DMG | `.dmg` | macOS 磁盘镜像文件 |
| macOS | DMG | `.dmg.block` | 带公证的 DMG 文件 |
| Windows | NSIS | `.exe` | Windows 安装程序 |
| Windows | NSIS | `.7z` | 自解压安装包 |
| Linux | AppImage | `.AppImage` | Linux AppImage 格式 |

**打包输出位置：**
- macOS: `release/`
- Windows: `release/`
- Linux: `release/`

## 故障排除

### 1. 编译错误

**TypeScript 编译错误**

```bash
# 清除构建缓存
rm -rf dist/

# 重新构建
npm run build

# 查看详细错误
npm run build 2>&1 | tee build.log
```

**依赖安装错误**

```bash
# 清除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 2. 运行时错误

**应用无法启动**

检查以下几点：
1. 是否已安装所有依赖：`npm install`
2. 是否配置了 GLM API Key：检查 `.env` 文件
3. 端口是否被占用：检查 PORT 配置

**IPC 通信失败**

检查 preload 脚本是否正确加载：
1. 查看控制台是否有 preload 加载错误
2. 检查 `dist/preload/preload.js` 是否生成
3. 验证 IPC 通道名称是否匹配

**数据库错误**

数据库相关问题：
1. 检查数据库文件权限
2. 确保数据目录存在
3. 检查 better-sqlite3 是否正确编译

### 3. GLM API 错误

**常见错误及解决方案**

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `GLM API Key 未配置` | 未在 `.env` 中设置 `GLM_API_KEY` | 在 `.env` 中添加有效的 API Key |
| `API 请求失败` | 网络问题或 API Key 无效 | 检查网络连接，确认 API Key 有效 |
| `API 配额超出` | 达到 API 调用限制 | 等待一段时间后重试或升级 API 计划 |
| `Token 过期` | JWT token 过期 | 重新登录或等待自动刷新 |

### 4. 开发者工具

**启用开发者工具**

应用已集成以下开发者工具：

```bash
# 查看应用启动的进程
ps aux | grep electron

# 查看网络连接
lsof -i -P -n | grep node

# 查看端口占用
lsof -i -P -n | grep :3001
```

**调试模式**

在 `.env` 中设置：
```bash
LOG_LEVEL=debug
NODE_ENV=development
```

## 验证安装

### 功能清单

安装完成后，验证以下功能是否正常：

- [ ] 应用可以正常启动
- [ ] 可以访问所有页面
- [ ] 用户注册功能正常
- [ ] 用户登录功能正常
- [ ] PDF 文件上传成功
- [ ] Word 文件上传成功
- [ ] 文件内容解析正确
- [ ] 简历列表可以正常获取
- [ ] 简历详情可以正常查看
- [ ] 简历可以正常删除
- [ ] AI 分析功能正常（需要有效 API Key）
- [ ] 优化建议生成正常
- [ ] 面试问题生成正常
- [ ] 数据库操作正常
- [ ] IPC 通信正常

## 下一步

配置完成后，您可以选择：

1. **开始开发**：运行 `npm run dev` 启动开发服务器
2. **运行测试**：运行 `npm run test` 执行测试用例
3. **构建应用**：运行 `npm run build` 构建生产版本
4. **打包发布**：运行 `npm run dist` 生成安装包

## 技术支持

如遇到问题，请检查以下资源：

1. [Electron 文档](https://www.electronjs.org/docs/latest/)
2. [TypeScript 文档](https://www.typescriptlang.org/docs/)
3. [React 文档](https://react.dev/)
4. [Ant Design 文档](https://ant.design/docs/react/)
5. 项目 GitHub Issues

## 更新日志

查看项目更新日志和变更记录：

```bash
# 查看最近的 Git 提交
git log --oneline -10

# 查看当前分支
git branch

# 查看未提交的更改
git status
```
