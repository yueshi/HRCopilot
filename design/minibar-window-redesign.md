# ResumerHelper 折叠窗口重构设计方案

## 一、需求概述

将应用改造为支持多窗口状态管理：
1. 启动时显示登录页面（屏幕中央）
2. 登录成功后切换到右下角折叠小窗口
3. 折叠窗口显示 HR 卡通形象，展开后显示功能菜单
4. 选中功能时展示完整功能窗口
5. 功能窗口提供隐藏按钮，点击后恢复折叠状态

## 二、架构设计

### 2.1 窗口类型定义

```typescript
enum WindowType {
  LOGIN = 'login',      // 登录窗口
  MINIBAR = 'minibar',  // 折叠窗口
  MAIN = 'main'         // 功能窗口
}

interface WindowConfig {
  type: WindowType;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  resizable: boolean;
  alwaysOnTop: boolean;
  skipTaskbar: boolean;
  frame: boolean;
}
```

### 2.2 窗口配置

| 窗口类型 | width | height | minWidth | minHeight | resizable | alwaysOnTop | skipTaskbar | frame |
|---------|-------|--------|----------|-----------|-----------|--------------|--------------|-------|
| LOGIN | 400 | 520 | 400 | 520 | false | false | false | false |
| MINIBAR | 60 | 可变 | 60 | 200 | false | true | true | false |
| MAIN | 1200 | 800 | 800 | 600 | true | false | false | true |

### 2.3 窗口状态机

```
┌─────────────┐
│  应用启动    │
└──────┬──────┘
       │
       ▼
┌─────────────┐   登录成功    ┌─────────────┐
│  登录窗口    │──────────────▶│  折叠窗口    │
│ (Login)     │◀──────────────│  (Minibar)  │
└─────────────┘   退出登录     └──────┬──────┘
                                  │ 选中功能
                                  ▼
                            ┌─────────────┐   点击隐藏    ┌─────────────┐
                            │  功能窗口    │──────────────▶│  折叠窗口    │
                            │  (Main)     │               │  (Minibar)  │
                            └─────────────┘               └─────────────┘
```

## 三、主进程设计

### 3.1 WindowManager 类设计

```typescript
// src/main/windowManager.ts

class WindowManager {
  private loginWindow: BrowserWindow | null = null;
  private minibarWindow: BrowserWindow | null = null;
  private mainWindow: BrowserWindow | null = null;

  // 窗口状态持久化
  private mainWindowState: WindowState;

  // 创建登录窗口
  createLoginWindow(): BrowserWindow;

  // 创建折叠窗口
  createMinibarWindow(): BrowserWindow;

  // 创建功能窗口
  createMainWindow(): BrowserWindow;

  // 切换窗口
  showMainWindow(): void;
  hideMainWindow(): void;
  showMinibarWindow(): void;
  logout(): void;

  // 窗口事件处理
  setupWindowEvents(): void;
}
```

### 3.2 新增 IPC 通道

```typescript
// src/shared/types/ipc.ts - 新增

// WINDOW: 窗口管理
enum WindowChannels {
  SHOW_MAIN = 'window:show-main',
  HIDE_MAIN = 'window:hide-main',
  GET_STATE = 'window:get-state',
  LOGOUT = 'window:logout',
}

// 请求/响应类型
interface ShowMainWindowRequest {
  path?: string;  // 可选，指定跳转路径
}

interface WindowStateResponse {
  currentWindow: WindowType;
  mainWindowVisible: boolean;
}
```

## 四、折叠窗口设计 (MinibarWindow)

### 4.1 UI 布局

```
┌──────────┐
│          │  ← HR 卡通头像 (50×50)
│   (图)   │
│          │
├──────────┤
│   🏠     │  ← 首页按钮
├──────────┤
│   📄     │  ← 简历按钮
├──────────┤
│   ⬆️     │  ← 上传按钮
├──────────┤
│   ⚙️     │  ← 设置按钮
├──────────┤
│   🚪     │  ← 退出按钮
└──────────┘
```

总宽度: 60px
按钮高度: 50px
按钮间距: 5px

### 4.2 交互状态

- **折叠状态**: 只显示 HR 头像
- **展开状态**: 显示完整菜单
- **悬停效果**: 按钮高亮 + 提示文字
- **点击效果**: 触发对应功能

### 4.3 组件结构

```typescript
// src/renderer/src/pages/MinibarPage.tsx

interface MenuButton {
  icon: ReactNode;    // 图标
  label: string;      // 标签
  path: string;        // 路径
  tooltip: string;     // 提示
}

const menuButtons: MenuButton[] = [
  { icon: <HomeIcon />, label: '首页', path: '/home', tooltip: '返回首页' },
  { icon: <ResumeIcon />, label: '简历', path: '/resumes', tooltip: '我的简历' },
  { icon: <UploadIcon />, label: '上传', path: '/upload', tooltip: '上传简历' },
  { icon: <SettingsIcon />, label: '设置', path: '/settings', tooltip: '系统设置' },
  { icon: <LogoutIcon />, label: '退出', path: 'logout', tooltip: '退出登录' },
];
```

### 4.4 样式设计

```css
/* 折叠窗口容器 */
.minibar-container {
  width: 60px;
  background: linear-gradient(180deg, #4a90e2 0%, #357abd 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5px;
}

/* HR 头像 */
.hr-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #fff;
  margin-bottom: 10px;
  cursor: pointer;
  transition: transform 0.2s;
}

.hr-avatar:hover {
  transform: scale(1.1);
}

/* 菜单按钮 */
.menu-button {
  width: 50px;
  height: 50px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  margin: 2px 0;
  position: relative;
}

.menu-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 工具提示 */
.tooltip {
  position: absolute;
  left: -100px;
  background: #333;
  color: #fff;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 12px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.menu-button:hover .tooltip {
  opacity: 1;
}
```

## 五、功能窗口设计 (MainWindow)

### 5.1 新增隐藏按钮

在 `Layout.tsx` 的顶部导航栏右侧添加隐藏按钮：

```typescript
// src/renderer/src/components/Layout.tsx

<Header>
  <Left>{appTitle}</Left>
  <Right>
    {userMenu}
    {/* 新增隐藏按钮 */}
    <HideButton onClick={handleHide}>
      <MinimizeIcon />
    </HideButton>
  </Right>
</Header>
```

### 5.2 隐藏功能实现

```typescript
// src/renderer/src/components/Layout.tsx

const handleHide = async () => {
  await window.electronAPI.window.hideMain();
};
```

## 六、文件结构调整

```
ResumerHelper/
├── src/
│   ├── main/
│   │   ├── main.ts              # 主入口，初始化 WindowManager
│   │   ├── windowManager.ts     # 新增：窗口管理器
│   │   └── handlers/
│   │       └── windowHandler.ts # 新增：窗口 IPC 处理
│   ├── renderer/
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── LoginPage.tsx      # 登录页（已存在）
│   │       │   ├── MinibarPage.tsx    # 新增：折叠窗口页面
│   │       │   └── ...                # 其他页面（已存在）
│   │       └── components/
│   │           └── Layout.tsx         # 修改：添加隐藏按钮
│   └── shared/
│       └── types/
│           ├── ipc.ts              # 修改：新增 WINDOW 通道
│           └── window.ts           # 新增：窗口相关类型
```

## 七、实施步骤

### 阶段 1: 基础架构搭建

1. **创建窗口管理器** (`src/main/windowManager.ts`)
   - 实现 WindowManager 类
   - 定义三种窗口的创建逻辑

2. **扩展 IPC 类型定义**
   - 添加 WindowType 枚举
   - 添加窗口管理通道
   - 添加相关请求/响应类型

3. **修改主进程入口** (`src/main/main.ts`)
   - 集成 WindowManager
   - 移除旧的单一窗口逻辑

### 阶段 2: 折叠窗口实现

4. **创建折叠窗口页面** (`src/renderer/src/pages/MinibarPage.tsx`)
   - 实现 HR 头像组件
   - 实现菜单按钮组件
   - 实现展开/折叠动画

5. **创建折叠窗口样式** (`src/renderer/src/styles/minibar.css`)
   - 定义布局样式
   - 定义交互效果

### 阶段 3: 功能窗口调整

6. **修改 Layout 组件**
   - 添加隐藏按钮
   - 添加隐藏事件处理

7. **更新 preload 暴露 API**
   - 添加 `window.hideMain()` 方法

### 阶段 4: 集成测试

8. **测试窗口切换**
   - 登录 → 折叠窗口
   - 折叠 → 功能窗口
   - 功能窗口 → 折叠
   - 退出登录 → 登录窗口

9. **测试状态持久化**
   - 功能窗口位置记忆
   - 登录状态保持

### 阶段 5: 优化完善

10. **添加窗口动画效果**
    - 窗口淡入淡出
    - 菜单展开动画

11. **优化性能**
    - 窗口隐藏时不销毁
    - 状态懒加载

12. **添加错误处理**
    - 窗口创建失败处理
    - 状态异常恢复

## 八、技术细节

### 8.1 窗口位置计算

```typescript
// 右下角位置计算
const calculateMinibarPosition = (): { x: number; y: number } => {
  const { screen } = electron;
  const displays = screen.getAllDisplays();
  const primaryDisplay = displays.find(d => d.primary) || displays[0];

  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  return {
    x: screenWidth - 60 - 10,  // 距离右边缘 10px
    y: screenHeight - 300 - 10  // 距离底部 10px
  };
};
```

### 8.2 窗口状态持久化

```typescript
// 保存功能窗口状态
const saveWindowState = () => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    const isMaximized = mainWindow.isMaximized();

    const state = {
      bounds,
      isMaximized,
      lastUpdate: Date.now()
    };

    localStorage.setItem('mainWindowState', JSON.stringify(state));
  }
};

// 恢复功能窗口状态
const restoreWindowState = (window: BrowserWindow) => {
  const saved = localStorage.getItem('mainWindowState');
  if (saved) {
    const state = JSON.parse(saved);
    window.setBounds(state.bounds);
    if (state.isMaximized) {
      window.maximize();
    }
  }
};
```

### 8.3 防止多实例

```typescript
// 确保只有一个应用实例
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 聚焦到现有窗口
    if (minibarWindow) {
      minibarWindow.show();
      minibarWindow.focus();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
```

## 九、注意事项

1. **窗口生命周期**
   - 登录窗口: 登录成功后销毁
   - 折叠窗口: 应用运行期间一直存在
   - 功能窗口: 隐藏时保留，不销毁

2. **内存管理**
   - 功能窗口内容在隐藏时可以卸载
   - 使用懒加载减少内存占用

3. **多显示器支持**
   - 确保窗口在当前显示器内
   - 处理显示器变化事件

4. **可访问性**
   - 键盘导航支持
   - 屏幕阅读器支持

5. **安全性**
   - 登录成功后隐藏登录窗口
   - 清除敏感信息

## 十、预计工作量

| 阶段 | 任务 | 预计时间 |
|-----|------|---------|
| 1 | 基础架构搭建 | 2-3 小时 |
| 2 | 折叠窗口实现 | 3-4 小时 |
| 3 | 功能窗口调整 | 1-2 小时 |
| 4 | 集成测试 | 2-3 小时 |
| 5 | 优化完善 | 2-3 小时 |
| **总计** | | **10-15 小时** |

## 十一、风险与备选方案

| 风险 | 概率 | 影响 | 缓解措施 |
|-----|------|------|---------|
| 窗口同步问题 | 中 | 高 | 使用状态管理确保一致性 |
| 性能问题 | 低 | 中 | 懒加载、卸载隐藏窗口内容 |
| 多显示器兼容性 | 低 | 中 | 充分测试多显示器场景 |
| 平台差异 | 中 | 中 | 分别测试 macOS/Windows |

## 十二、后续扩展方向

1. **主题定制**: 支持更换 HR 形象和配色
2. **快捷键**: 支持键盘快捷操作
3. **通知集成**: 折叠状态下显示通知
4. **拖拽功能**: 支持拖拽文件到折叠窗口
5. **手势支持**: 支持鼠标手势操作
