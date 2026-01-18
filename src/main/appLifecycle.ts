/**
 * 应用生命周期管理器
 *
 * 负责协调应用的安全退出流程
 * 确保所有资源被正确清理，避免重复操作
 * 处理 SIGINT/SIGTERM 信号以支持开发环境下的正确退出
 */

import { app, BrowserWindow } from "electron";
import fs from "fs/promises";
import path from "path";
import { logger } from "./utils/logger";

// 清理回调接口
export interface CleanupCallbacks {
  saveWindowState?: () => Promise<void>;
  destroyAllWindows?: () => void;
  closeDatabase?: () => Promise<void>;
  [key: string]: (() => void | Promise<void>) | undefined;
}

/**
 * 应用状态
 */
enum AppState {
  NORMAL = "normal",       //   正常运行
  QUITTING = "quitting", // 正在退出
  CLEANED = "cleaned"     // 已清理
}

class AppLifecycleManager {
  private state: AppState = AppState.NORMAL;
  private callbacks: CleanupCallbacks = {};
  private readonly STATE_FILE_NAME = "app-state.json";

  constructor() {
    this.setupEventListeners();
    this.setupSignalHandlers();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // before-quit: 在所有窗口关闭前触发
    // 这是退出流程的入口点（正常退出）
    app.on("before-quit", async (event) => {
      logger.info("[AppLifecycle] before-quit 触发，当前状态:", this.state);

      if (this.state === AppState.CLEANED) {
        logger.info("[AppLifecycle] 已清理，允许退出");
        return;
      }

      // 如果已经在退出中，阻止重复退出
      if (this.state === AppState.QUITTING) {
        logger.info("[AppLifecycle] 正在退出中，阻止重复退出");
        event.preventDefault();
        return;
      }

      // 开始退出流程
      event.preventDefault();
      await this.quit(false); // false = 正常退出，不是信号触发
    });

    // window-all-closed: 所有窗口已关闭
    app.on("window-all-closed", () => {
      // 只有在非退出状态下才处理
      if (this.state === AppState.NORMAL) {
        logger.info("[AppLifecycle] 所有窗口已关闭，但非退出状态（可能是隐藏）");
      }
    });

    // process 退出处理
    process.on("exit", (code) => {
      logger.info(`[AppLifecycle] 进程退出，代码: ${code}`);
    });

    // 处理未捕获的异常
    process.on("uncaughtException", (error) => {
      logger.error("[AppLifecycle] 未捕获的异常:", error);
      this.emergencyQuit();
    });

    // 处理未处理的 Promise 拒绝
    process.on("unhandledRejection", (reason) => {
      logger.error("[AppLifecycle] 未处理的 Promise 拒绝:", reason);
    });
  }

  /**
   * 设置信号处理器
   * 处理 SIGINT (Ctrl+C) 和 SIGTERM 信号
   */
  private setupSignalHandlers(): void {
    logger.info("[AppLifecycle] 注册信号处理器");

    // 处理 Ctrl+C (SIGINT)
    process.on("SIGINT", () => {
      logger.info("[AppLifecycle] 收到 SIGINT 信号 (Ctrl+C)");
      this.triggerQuit(true);
    });

    // 处理终止信号 (SIGTERM)
    process.on("SIGTERM", () => {
      logger.info("[AppLifecycle] 收到 SIGTERM 信号");
      this.triggerQuit(true);
    });

    // Windows 下 Ctrl+Break
    process.on("SIGBREAK", () => {
      logger.info("[AppLifecycle] 收到 SIGBREAK 信号");
      this.triggerQuit(true);
    });
  }

  /**
   * 触发退出流程（同步触发，避免时序问题）
   */
  private triggerQuit(fromSignal: boolean): void {
    // 如果已经在退出中，直接退出
    if (this.state === AppState.CLEANED) {
      logger.info("[AppLifecycle] 已清理，直接退出");
      // 开发模式下终止进程组
      if (process.env.NODE_ENV === "development") {
        try {
          process.kill(-process.pid, "SIGTERM");
        } catch (error) {
          logger.debug("[AppLifecycle] 无法终止进程组:", error);
        }
      }
      process.exit(0);
      return;
    }

    if (this.state === AppState.QUITTING) {
      logger.info("[AppLifecycle] 正在退出中，忽略信号");
      return;
    }

    // 标记为正在退出
    this.state = AppState.QUITTING;
    logger.info(`[AppLifecycle] 标记为退出状态 (来源: ${fromSignal ? "信号" : "应用"})`);

    // 异步执行退出流程，完成后调用 process.exit
    this.quit(fromSignal)
      .then(() => {
        logger.info("[AppLifecycle] 退出流程完成");

        // 开发模式下，杀死杀死整个进程组以终止 concurrently 和 Vite
        if (process.env.NODE_ENV === "development") {
          logger.info("[AppLifecycle] 开发模式，终止进程组");
          try {
            process.kill(-process.pid, "SIGTERM");
          } catch (error) {
            logger.debug("[AppLifecycle] 无法终止进程组:", error);
          }
        }

        process.exit(0);
      })
      .catch((error) => {
        logger.error("[AppLifecycle] 退出流程出错，强制退出:", error);
        process.exit(1);
      });
  }

  /**
   * 注册清理回调
   */
  registerCallbacks(callbacks: CleanupCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
    logger.info("[AppLifecycle] 清理回调已注册:", Object.keys(callbacks));
  }

  /**
   * 检查是否正在退出
   */
  isQuitting(): boolean {
    return this.state === AppState.QUITTING || this.state === AppState.CLEANED;
  }

  /**
   * 优雅退出应用
   */
  async quit(fromSignal: boolean = false): Promise<void> {
    // 防止重复调用
    if (this.isQuitting()) {
      logger.info("[AppLifecycle] 退出流程已在进行中，忽略重复请求");
      return;
    }

    this.state = AppState.QUITTING;
    logger.info(`[AppLifecycle] === 开始应用退出流程 (来源: ${fromSignal ? "信号" : "应用"}) ===`);

    try {
      // 步骤 1: 通知所有窗口即将退出
      await this.notifyAllWindowsClosing();

      // 步骤 2: 保存应用状态
      await this.saveAppState();

      // 步骤 3: 执行窗口状态保存回调
      if (this.callbacks.saveWindowState) {
        logger.info("[AppLifecycle] 保存窗口状态...");
        try {
          await this.callbacks.saveWindowState();
          logger.info("[AppLifecycle] 窗口状态保存完成");
        } catch (error) {
          logger.error("[AppLifecycle] 保存窗口状态失败:", error);
        }
      }

      // 步骤 4: 关闭数据库
      if (this.callbacks.closeDatabase) {
        logger.info("[AppLifecycle] 关闭数据库...");
        try {
          await this.callbacks.closeDatabase();
          logger.info("[AppLifecycle] 数据库关闭完成");
        } catch (error) {
          logger.error("[AppLifecycle] 关闭数据库失败:", error);
        }
      }

      // 步骤 5: 销毁所有窗口
      await this.destroyAllWindows();

      // 标记为已清理
      this.state = AppState.CLEANED;
      logger.info("[AppLifecycle] === 应用退出流程完成 ===");
    } catch (error) {
      logger.error("[AppLifecycle] 退出流程发生错误:", error);
      this.state = AppState.CLEANED;
      throw error;
    }
  }

  /**
   * 紧急退出（用于处理异常情况）
   */
  private emergencyQuit(): void {
    logger.warn("[AppLifecycle] 执行紧急退出");
    this.state = AppState.CLEANED;
    process.exit(1); // 退出码 1 表示异常
  }

  /**
   * 通知所有窗口即将退出
   */
  private async notifyAllWindowsClosing(): Promise<void> {
    logger.info("[AppLifecycle] 通知所有窗口即将退出...");
    const windows = BrowserWindow.getAllWindows();

    for (const window of windows) {
      if (!window.isDestroyed()) {
        try {
          window.webContents.send("app:quitting", {});
        } catch (error) {
          logger.warn("[AppLifecycle] 通知窗口退出失败:", error);
        }
      }
    }

    // 给渲染进程一点时间响应
    await this.delay(200);
  }

  /**
   * 保存应用状态
   */
  private async saveAppState(): Promise<void> {
    try {
      const statePath = path.join(app.getPath("userData"), this.STATE_FILE_NAME);
      await fs.mkdir(path.dirname(statePath), { recursive: true });

      const state = {
        lastClosed: new Date().toISOString(),
        version: app.getVersion(),
      };

      await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
      logger.info("[AppLifecycle] 应用状态已保存");
    } catch (error) {
      logger.error("[AppLifecycle] 保存应用状态失败:", error);
    }
  }

  /**
   * 销毁所有窗口
   */
  private async destroyAllWindows(): Promise<void> {
    logger.info("[AppLifecycle] 开始销毁所有窗口...");

    // 首先调用回调销毁窗口
    if (this.callbacks.destroyAllWindows) {
      try {
        this.callbacks.destroyAllWindows();
      } catch (error) {
        logger.error("[AppLifecycle] 销毁窗口回调失败:", error);
      }
    }

    // 等待所有窗口真正关闭
    const maxWait = 3000; // 最多等待 3 秒
    const checkInterval = 50;
    let waited = 0;

    while (waited < maxWait) {
      const windows = BrowserWindow.getAllWindows();
      logger.debug(`[AppLifecycle] 检查窗口剩余: ${windows.length}`);

      if (windows.length === 0) {
        logger.info("[AppLifecycle] 所有窗口已销毁");
        return;
      }

      // 强制销毁剩余窗口
      for (const window of windows) {
        if (!window.isDestroyed()) {
          try {
            window.destroy();
            logger.debug(`[AppLifecycle] 销毁窗口: ${window.webContents.getURL()}`);
          } catch (error) {
            logger.debug(`[AppLifecycle] 销毁窗口失败，可能已销毁`);
          }
        }
      }

      await this.delay(checkInterval);
      waited += checkInterval;
    }

    // 超时后仍然有窗口，警告但不阻塞退出
    const remainingWindows = BrowserWindow.getAllWindows();
    if (remainingWindows.length > 0) {
      logger.warn(`[AppLifecycle] 等待窗口关闭超时，剩余 ${remainingWindows.length} 个窗口`);
    } else {
      logger.info("[AppLifecycle] 所有窗口已销毁（超时后检查）");
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 导出单例
export const appLifecycle = new AppLifecycleManager();
