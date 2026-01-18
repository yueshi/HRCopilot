# ResumerHelper Electron 桌面应用安装指南

## 系统要求

- Node.js 18.x 或更高版本（推荐 18.x）
- npm 8.x 或更高版本
- Python 3.x（用于编译 native 模块）
- Xcode Command Line Tools (macOS)

## 安装步骤

### 1. 清理现有安装
```bash
# 删除现有的 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json
```

### 2. 安装基础依赖（不包含 better-sqlite3）
```bash
# 安装 Electron 和前端依赖
npm install electron electron-builder concurrently vite @vitejs/plugin-react react react-dom antd zustand react-router-dom styled-components

# 安装开发依赖
npm install -D typescript @types/node @types/react @types/react-dom @types/styled-components
```

### 3. 创建简化的 package.json 依赖结构
先移除 better-sqlite3，然后运行基础安装。

### 4. 重建 Native 模块
```bash
# 运行专用脚本重建 better-sqlite3
npm run electron-rebuild
```

### 5. 验证安装
```bash
# 检查 Electron 是否正常安装
npx electron --version

# 构建主进程
npm run build:main

# 启动开发环境
npm run dev
```

## 故障排除

### 问题 1: better-sqlite3 编译失败
**症状**: `npm ERR! gyp ERR! Node-gyp failed to build your package`

**解决方案**:
```bash
# 1. 检查 Xcode Command Line Tools
xcode-select --install

# 2. 检查 Python 版本
python --version

# 3. 清理并重新安装
rm -rf node_modules package-lock.json
npm install
npm run electron-rebuild
```

### 问题 2: Electron 启动失败
**症状**: `Cannot find module 'better-sqlite3'`

**解决方案**:
```bash
# 手动重建
npm run electron-rebuild

# 如果仍然失败，尝试强制重装
npm uninstall better-sqlite3
npm install better-sqlite3 --build-from-source
```

### 问题 3: Node.js 版本不兼容
**症状**: `No prebuilt binaries found` 错误

**解决方案**:
```bash
# 使用 Node.js 18.x（推荐）
nvm use 18
# 或者下载安装 Node.js 18.x

# 重新安装
npm install
npm run electron-rebuild
```

## 验证步骤

1. **检查 Electron 版本**:
   ```bash
   npx electron --version
   # 应该显示类似: v25.0.0 或更高版本
   ```

2. **检查 better-sqlite3 是否正确安装**:
   ```bash
   node -e "console.log(require('better-sqlite3'))"
   # 不应该报错
   ```

3. **检查主进程构建**:
   ```bash
   npm run build:main
   # 应该成功生成 dist/main/main.js
   ```

4. **启动完整应用**:
   ```bash
   npm run dev
   # 应该同时启动 Electron 主进程和 Vite 开发服务器
   ```

## 开发工作流

### 日常开发
```bash
# 启动开发环境（热重载）
npm run dev

# 仅构建主进程
npm run build:main

# 仅启动前端开发服务器
npm run dev:renderer
```

### 构建生产版本
```bash
# 构建所有
npm run build

# 打包应用
npm run dist

# 仅打包不构建
npm run dist:dir
```

### 代码质量
```bash
# 代码检查
npm run lint

# 代码格式化
npm run format

# 运行测试
npm test
```

## 注意事项

1. **Node.js 版本**: 推荐使用 Node.js 18.x，与 Electron 内置版本兼容性更好
2. **Python 环境**: 确保 Python 3.x 可用，用于编译 native 模块
3. **系统权限**: 可能需要管理员权限来安装全局工具
4. **网络问题**: 如果遇到网络问题，可以使用国内 npm 镜像：
   ```bash
   npm config set registry https://registry.npmmirror.com
   ```

## 项目结构

```
ResumerHelper/
├── src/
│   ├── main/              # Electron 主进程
│   ├── renderer/          # React 渲染进程
│   ├── preload/           # 预加载脚本
│   └── shared/            # 共享代码
├── scripts/               # 构建脚本
├── dist/                  # 构建输出
├── node_modules/          # 依赖包
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
├── vite.config.ts         # Vite 配置
└── electron-builder.json  # 打包配置
```