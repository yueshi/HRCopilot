import { app, BrowserWindow, screen, ipcMain } from "electron";
import type { BrowserWindow as BrowserWindowType } from "electron";
import path from "path";
import * as url from "url";
import fs from "fs/promises";
import { IPC_CHANNELS, WindowType } from "../shared/types";
import { logger } from "./utils/logger";

/**
 * 窗口状态接口
 */
export interface WindowState {
  mainWindow: {
    x?: number;
    y?: number;
    width: number;
    height: number;
    isMaximized: boolean;
    isFullscreen: boolean;
  };
  minibarWindow: {
    x?: number;
    y?: number;
    width: number;
    height: number;
  };
}

/**
 * 窗口管理器类
 * 管理主窗口和折叠窗口(Minibar)的生命周期
 */
class WindowManager {
  private minibarWindow: BrowserWindow | null = null;
  private mainWindow: BrowserWindow | null = null;

  private readonly MINIBAR_WINDOW_CONFIG = {
    width: 60,
    height: 200,
  };

  private readonly MAIN_WINDOW_CONFIG = {
    width: 1200,
    height: 800,
  };

  private readonly STATE_FILE_NAME = "window-state.json";
  private state: WindowState;
  private isShuttingDown: boolean = false;
  private isSingleInstanceLocked: boolean = false;
  private stateLoaded: boolean = false;

  constructor() {
    // 初始化默认状态
    this.state = this.getDefaultState();
    // 加载保存的状态（异步）
    this.loadWindowState().catch((error) => {
      logger.warn("加载窗口状态失败:", error);
    });

    // 防止多实例运行
    this.ensureSingleInstance();

    // 监听窗口状态机事件
    this.setupStateEventListeners();
  }

  /**
   * 设置窗口状态事件监听器
   */
  private setupStateEventListeners(): void {
    // 监听显示主窗口事件
    ipcMain.on("window-manager:show-main", () => {
      logger.info("收到 show-main 事件");
      this.showMainWindow();
    });

    // 监听隐藏主窗口事件
    ipcMain.on("window-manager:hide-main", () => {
      logger.info("收到 hide-main 事件");
      this.hideMainWindow();
    });

    // 监听显示 Minibar 窗口事件
    ipcMain.on("window-manager:show-minibar", () => {
      logger.info("收到 show-minibar 事件");
      this.showMinibarWindow();
    });

    // 监听隐藏 Minibar 窗口事件
    ipcMain.on("window-manager:hide-minibar", () => {
      logger.info("收到 hide-minibar 事件");
      this.hideMinibarWindow();
    });
  }

  /**
   * 获取默认窗口状态
   */
  private getDefaultState(): WindowState {
    return {
      mainWindow: {
        width: this.MAIN_WINDOW_CONFIG.width,
        height: this.MAIN_WINDOW_CONFIG.height,
        isMaximized: false,
        isFullscreen: false,
      },
      minibarWindow: {
        width: this.MINIBAR_WINDOW_CONFIG.width,
        height: this.MINIBAR_WINDOW_CONFIG.height,
      },
    };
  }

  /**
   * 获取状态文件路径
   */
  private getStateFilePath(): string {
    return path.join(app.getPath("userData"), this.STATE_FILE_NAME);
  }

  /**
   * 加载窗口状态
   */
  private async loadWindowState(): Promise<void> {
    try {
      const statePath = this.getStateFilePath();
      const stateData = await fs.readFile(statePath, "utf-8");
      const savedState = JSON.parse(stateData) as WindowState;

      // 验证并合并保存的状态
      this.state = {
        mainWindow: {
          ...this.getDefaultState().mainWindow,
          ...savedState.mainWindow,
        },
        minibarWindow: {
          ...this.getDefaultState().minibarWindow,
          ...savedState.minibarWindow,
        },
      };

      this.stateLoaded = true;
      logger.info("窗口状态加载成功");
    } catch (error) {
      logger.warn("加载窗口状态失败，使用默认状态:", error);
      this.state = this.getDefaultState();
      this.stateLoaded = true;
    }
  }

  /**
   * 保存窗口状态
   */
  async saveWindowState(): Promise<void> {
    try {
      // 更新主窗口状态
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const bounds = this.mainWindow.getBounds();
        this.state.mainWindow = {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          isMaximized: this.mainWindow.isMaximized(),
          isFullscreen: this.mainWindow.isFullScreen(),
        };
      }

      // 更新折叠窗口状态
      if (this.minibarWindow && !this.minibarWindow.isDestroyed()) {
        const bounds = this.minibarWindow.getBounds();
        this.state.minibarWindow = {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        };
      }

      // 保存到文件
      const statePath = this.getStateFilePath();
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      await fs.writeFile(
        statePath,
        JSON.stringify(this.state, null, 2),
        "utf-8",
      );

      logger.debug("窗口状态已保存");
    } catch (error) {
      logger.error("保存窗口状态失败:", error);
    }
  }

  /**
   * 防止多实例运行
   */
  private ensureSingleInstance(): void {
    const gotTheLock = app.requestSingleInstanceLock();
    this.isSingleInstanceLocked = gotTheLock;

    if (!gotTheLock) {
      logger.warn("检测到另一个实例正在运行，退出当前实例");
      app.quit();
    } else {
      app.on("second-instance", () => {
        // 当第二个实例启动时，将焦点转移到现有窗口
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore();
          }
          this.mainWindow.focus();
        } else if (this.minibarWindow && !this.minibarWindow.isDestroyed()) {
          this.minibarWindow.focus();
        } else {
          this.showMainWindow();
        }
      });
    }
  }

  /**
   * 同步窗口状态到所有窗口
   */
  private syncWindowState(): void {
    const state = this.getWindowState();
    const allWindows = BrowserWindow.getAllWindows();

    allWindows.forEach((window) => {
      window.webContents.send("window:state-changed", state);
    });
  }

  /**
   * 创建折叠窗口 (Minibar)
   */
  createMinibarWindow(): BrowserWindow {
    if (this.minibarWindow && !this.minibarWindow.isDestroyed()) {
      // 如果窗口已存在但隐藏，显示它
      if (!this.minibarWindow.isVisible()) {
        this.minibarWindow.show();
      }
      this.minibarWindow.focus();
      return this.minibarWindow;
    }

    // 获取主显示器尺寸
    const { width: screenWidth, height: screenHeight } =
      screen.getPrimaryDisplay().workAreaSize;

    // 计算右下角位置（使用保存的位置或默认位置）
    const defaultX = screenWidth - this.MINIBAR_WINDOW_CONFIG.width - 20;
    const defaultY = screenHeight - this.MINIBAR_WINDOW_CONFIG.height - 20;

    const x = this.state.minibarWindow.x ?? defaultX;
    const y = this.state.minibarWindow.y ?? defaultY;

    this.minibarWindow = new BrowserWindow({
      width: this.state.minibarWindow.width,
      height: this.state.minibarWindow.height,
      x,
      y,
      webPreferences: {
        preload: path.join(__dirname, "../preload/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      movable: true,  // 允许通过拖动窗口来移动位置
      skipTaskbar: false,
      resizable: true,
      show: false,
      titleBarStyle: "hidden",
    });

    console.log("[WindowManager] Loading minibar window");

    this.minibarWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, "../renderer/index.html"),
        protocol: "file:",
        slashes: true,
        hash: "#/?window=minibar",
      }),
    );

    // 使用 webContents 的 did-finish-load 替代 ready-to-show，确保页面加载完成后显示窗口
    this.minibarWindow.webContents.once("did-finish-load", () => {
      this.minibarWindow?.show();
      this.syncWindowState();

      // 通知前端 Minibar 窗口已显示，前端应该折叠菜单
      this.minibarWindow?.webContents.send("minibar-window-shown");

      if (process.env.NODE_ENV === "development") {
        this.minibarWindow?.webContents.openDevTools();
      }
    });

    // 保存窗口位置
    this.minibarWindow.on("moved", async () => {
      if (this.minibarWindow) {
        const [x, y] = this.minibarWindow.getPosition();
        this.state.minibarWindow.x = x;
        this.state.minibarWindow.y = y;
        await this.saveWindowState();
      }
    });

    this.minibarWindow.on("resized", async () => {
      if (this.minibarWindow) {
        const [width, height] = this.minibarWindow.getSize();
        this.state.minibarWindow.width = width;
        this.state.minibarWindow.height = height;
        await this.saveWindowState();
      }
    });

    this.minibarWindow.on("closed", () => {
      this.minibarWindow = null;
      this.syncWindowState();
    });

    return this.minibarWindow;
  }

  /**
   * 创建主窗口
   */
  createMainWindow(targetPath?: string): BrowserWindow {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // 如果窗口已存在但隐藏，显示它
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.focus();
      if (targetPath) {
        this.mainWindow.webContents.send("navigate-to", { path: targetPath });
      }
      return this.mainWindow;
    }

    // 准备主窗口配置
    const mainWindowOptions: Electron.BrowserWindowConstructorOptions = {
      width: this.state.mainWindow.width,
      height: this.state.mainWindow.height,
      webPreferences: {
        preload: path.join(__dirname, "../preload/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
    };

    // 如果有保存的位置，则应用
    if (
      this.state.mainWindow.x !== undefined &&
      this.state.mainWindow.y !== undefined
    ) {
      mainWindowOptions.x = this.state.mainWindow.x;
      mainWindowOptions.y = this.state.mainWindow.y;
    }

    this.mainWindow = new BrowserWindow(mainWindowOptions);

    const hash = targetPath ? `#${targetPath}` : "#/home";

    console.log("[WindowManager] Loading main window with hash:", hash);

    this.mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, "../renderer/index.html"),
        protocol: "file",
        slashes: true,
        hash,
      }),
    );

    // 使用 webContents 的 did-finish-load 替代 ready-to-show，确保页面加载完成后显示窗口
    this.mainWindow.webContents.once("did-finish-load", () => {
      console.log("[WindowManager] Main window did-finish-load");
      console.log("[WindowManager] NODE_ENV:", process.env.NODE_ENV);
      console.log(
        "[WindowManager] is.dev:",
        process.env.NODE_ENV === "development",
      );

      if (this.state.mainWindow.isMaximized) {
        this.mainWindow?.maximize();
      }
      if (this.state.mainWindow.isFullscreen) {
        this.mainWindow?.setFullScreen(true);
      }
      this.mainWindow?.show();
      this.syncWindowState();

      if (process.env.NODE_ENV === "development") {
        console.log("[WindowManager] Opening DevTools...");
        this.mainWindow?.webContents.openDevTools();
      }
    });

    // 监听窗口移动和调整大小事件，保存状态
    const debouncedSave = this.debounce(() => {
      this.saveWindowState();
    }, 500);

    this.mainWindow.on("moved", debouncedSave);
    this.mainWindow.on("resized", debouncedSave);
    this.mainWindow.on("maximize", async () => {
      await this.saveWindowState();
    });
    this.mainWindow.on("unmaximize", async () => {
      await this.saveWindowState();
    });
    this.mainWindow.on("enter-full-screen", async () => {
      await this.saveWindowState();
    });
    this.mainWindow.on("leave-full-screen", async () => {
      await this.saveWindowState();
    });

    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
      this.syncWindowState();
    });

    return this.mainWindow;
  }

  /**
   * 防抖函数
   */
  private debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * 显示折叠窗口
   */
  showMinibarWindow(): void {
    this.createMinibarWindow();
  }

  /**
   * 显示主窗口
   */
  showMainWindow(targetPath?: string): void {
    this.createMainWindow(targetPath);
  }

  /**
   * 隐藏主窗口
   */
  hideMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.hide();
    }
  }

  /**
   * 隐藏折叠窗口
   */
  hideMinibarWindow(): void {
    if (this.minibarWindow && !this.minibarWindow.isDestroyed()) {
      this.minibarWindow.hide();
    }
  }

  /**
   * 关闭主窗口
   */
  closeMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
    }
  }

  /**
   * 关闭折叠窗口
   */
  closeMinibarWindow(): void {
    if (this.minibarWindow && !this.minibarWindow.isDestroyed()) {
      this.minibarWindow.close();
    }
  }

  /**
   * 获取主窗口实例
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * 获取折叠窗口实例
   */
  getMinibarWindow(): BrowserWindow | null {
    return this.minibarWindow;
  }

  /**
   * 获取当前窗口状态
   */
  getWindowState(): {
    currentWindow: WindowType | null;
    mainWindowVisible: boolean;
    minibarWindowVisible: boolean;
  } {
    return {
      currentWindow: this.getCurrentWindow(),
      mainWindowVisible: !!(this.mainWindow && !this.mainWindow.isDestroyed()),
      minibarWindowVisible: !!(
        this.minibarWindow && !this.minibarWindow.isDestroyed()
      ),
    };
  }

  /**
   * 获取当前活动窗口类型
   */
  private getCurrentWindow(): WindowType | null {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (!focusedWindow) return null;

    if (focusedWindow === this.minibarWindow) return WindowType.MINIBAR;
    if (focusedWindow === this.mainWindow) return WindowType.MAIN;

    return null;
  }

  /**
   * 清理所有窗口
   */
  cleanup(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.destroy();
    }
    if (this.minibarWindow && !this.minibarWindow.isDestroyed()) {
      this.minibarWindow.destroy();
    }

    this.mainWindow = null;
    this.minibarWindow = null;
  }
}

// 导出单例
export const windowManager = new WindowManager();
