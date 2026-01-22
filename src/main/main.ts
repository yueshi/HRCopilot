import { app, BrowserWindow, dialog, ipcMain, shell, Menu } from "electron";
import type { BrowserWindow as BrowserWindowType } from "electron";
import { join } from "path";
import { electronApp, optimizer, is } from "@electron-toolkit/utils";
import fs from "fs/promises";
import { database } from "./database/sqlite";
import { logger } from "./utils/logger";
import { registerAllHandlers } from "./handlers";
import { windowManager } from "./windowManager";
import { appLifecycle } from "./appLifecycle";

// 抑制 macOS 输入法框架 (IMK) 的系统警告
// 这些警告不会影响应用功能
if (process.platform === "darwin") {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const message = args.join(" ");
    // 过滤掉 macOS IMK 相关的系统警告
    if (
      message.includes("_TIPropertyValueIsValid called with") ||
      message.includes("imkxpc_setApplicationProperty")
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

class HRCopilotApp {
  private database = database;

  async initialize() {
    try {
      process.env.NODE_ENV = process.env.NODE_ENV || "development";

      console.log("NODE_ENV:", process.env.NODE_ENV);
      console.log("is.dev:", is.dev);

      await app.whenReady();

      // 初始化数据库
      logger.info("正在初始化数据库...");
      try {
        await this.database.init();
        logger.info("数据库初始化完成");
      } catch (dbError) {
        logger.error("数据库初始化失败:", dbError);
        throw new Error(`数据库初始化失败: ${(dbError as Error).message}`);
      }

      // 注册所有 IPC 处理器
      logger.info("正在注册 IPC 处理器...");
      registerAllHandlers();
      logger.info("IPC 处理器注册完成");

      // 应用启动时只显示主窗口
      windowManager.showMainWindow();

      // 设置IPC处理器
      this.setupIpcHandlers();

      // 设置应用菜单
      this.setupMenu();

      // 注册清理回调到生命周期管理器
      appLifecycle.registerCallbacks({
        saveWindowState: async () => {
          await windowManager.saveWindowState();
        },
        destroyAllWindows: () => {
          windowManager.cleanup();
        },
        closeDatabase: async () => {
          if (this.database) {
            await this.database.close();
            this.database = null;
          }
        },
      });

      logger.info("HRCopilot 桌面应用启动完成");
    } catch (error) {
      logger.error("应用初始化失败:", error);
      this.showErrorDialog("应用初始化失败", error as Error);
      app.quit();
    }
  }

  private setupIpcHandlers(): void {
    // 文件选择
    ipcMain.handle("select-file", async (event, options) => {
      try {
        const result = await dialog.showOpenDialog(
          windowManager.getMainWindow()!,
          {
            properties: ["openFile"],
            filters: options?.filters || [
              { name: "Documents", extensions: ["pdf", "doc", "docx", "txt"] },
            ],
          },
        );
        return result;
      } catch (error) {
        logger.error("文件选择失败:", error);
        return { canceled: true };
      }
    });

    // 文件保存
    ipcMain.handle(
      "save-file",
      async (event, data: string, filename: string, options?) => {
        try {
          const result = await dialog.showSaveDialog(
            windowManager.getMainWindow()!,
            {
              defaultPath: filename,
              filters: options?.filters || [
                { name: "PDF Files", extensions: ["pdf"] },
                { name: "Text Files", extensions: ["txt"] },
                { name: "All Files", extensions: ["*"] },
              ],
            },
          );

          if (!result.canceled && result.filePath) {
            await fs.writeFile(result.filePath, data, "utf8");
            return { success: true, filePath: result.filePath };
          }
          return { success: false };
        } catch (error) {
          logger.error("文件保存失败:", error);
          return { success: false };
        }
      },
    );

    // 目录选择
    ipcMain.handle("select-directory", async () => {
      try {
        const result = await dialog.showOpenDialog(
          windowManager.getMainWindow()!,
          {
            properties: ["openDirectory"],
          },
        );
        return result;
      } catch (error) {
        logger.error("目录选择失败:", error);
        return { canceled: true };
      }
    });

    // 获取应用版本
    ipcMain.handle("get-app-version", () => {
      return app.getVersion();
    });

    // 退出应用
    ipcMain.handle("quit-app", async () => {
      logger.info("收到IPC退出请求");
      await appLifecycle.quit();
    });

    // 最小化窗口
    ipcMain.handle("minimize-app", () => {
      windowManager.getMainWindow()?.minimize();
    });

    // 最大化/还原窗口
    ipcMain.handle("maximize-app", () => {
      if (windowManager.getMainWindow()?.isMaximized()) {
        windowManager.getMainWindow().unmaximize();
      } else {
        windowManager.getMainWindow()?.maximize();
      }
    });

    // 获取数据库路径
    ipcMain.handle("get-database-path", () => {
      return this.database.getDatabasePath();
    });

    // 导出数据库
    ipcMain.handle("export-database", async (event, filePath?) => {
      try {
        const dbPath = this.database.getDatabasePath();

        if (!filePath) {
          const result = await dialog.showSaveDialog(
            windowManager.getMainWindow()!,
            {
              defaultPath: "resumerhelper_backup.db",
              filters: [{ name: "Database Files", extensions: ["db"] }],
            },
          );

          if (result.canceled || !result.filePath) {
            return { success: false };
          }
          filePath = result.filePath;
        }

        await fs.copyFile(dbPath, filePath);
        return { success: true, filePath };
      } catch (error) {
        logger.error("数据库导出失败:", error);
        return { success: false, error: (error as Error).message };
      }
    });

    // 导入数据库
    ipcMain.handle("import-database", async (event, filePath: string) => {
      try {
        const result = await dialog.showMessageBox(
          windowManager.getMainWindow()!,
          {
            type: "warning",
            buttons: ["取消", "确认导入"],
            defaultId: 0,
            title: "确认导入",
            message: "导入数据库将覆盖当前所有数据，确定要继续吗？",
          },
        );

        if (result.response !== 1) {
          return { success: false, message: "用户取消导入" };
        }

        // 关闭当前数据库连接
        await this.database.close();

        // 备份当前数据库
        const currentDbPath = this.database.getDatabasePath();
        const backupPath = currentDbPath + ".backup";
        try {
          await fs.copyFile(currentDbPath, backupPath);
        } catch (error) {
          logger.warn("数据库备份失败:", error);
        }

        // 导入新数据库
        await fs.copyFile(filePath, currentDbPath);

        // 重新初始化数据库
        await this.database.init();

        return { success: true, message: "数据库导入成功" };
      } catch (error) {
        logger.error("数据库导入失败:", error);

        // 尝试恢复备份
        try {
          const currentDbPath = this.database.getDatabasePath();
          const backupPath = currentDbPath + ".backup";
          await fs.copyFile(backupPath, currentDbPath);
          await this.database.init();
        } catch (restoreError) {
          logger.error("数据库恢复失败:", restoreError);
        }

        return { success: false, error: (error as Error).message };
      }
    });

    // 打开外部链接
    ipcMain.handle("open-external", async (event, url: string) => {
      await shell.openExternal(url);
    });

    // 在文件夹中显示
    ipcMain.handle("show-item-in-folder", async (event, filePath: string) => {
      shell.showItemInFolder(filePath);
    });

    // 显示通知
    ipcMain.handle("show-notification", async (event, options) => {
      const { Notification } = await import("electron");
      const notification = new Notification({
        title: options.title,
        body: options.body,
        urgency: options.type === "error" ? "critical" : "normal",
      });
      notification.show();
    });
  }

  private setupMenu(): void {
    const template: any[] = [
      {
        label: "文件",
        submenu: [
          {
            label: "打开简历",
            accelerator: "CmdOrCtrl+O",
            click: () => {
              windowManager
                .getMainWindow()
                ?.webContents.send("menu-open-resume");
            },
          },
          {
            label: "导出结果",
            accelerator: "CmdOrCtrl+E",
            click: () => {
              windowManager
                .getMainWindow()
                ?.webContents.send("menu-export-results");
            },
          },
          { type: "separator" },
          {
            label: "退出",
            accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
            click: () => {
              // macOS: 隐藏应用（dock 保留）
              if (process.platform === "darwin") {
                app.hide();
              } else {
                // Windows/Linux: 使用应用生命周期管理器退出
                appLifecycle.quit();
              }
            },
          },
        ],
      },
      {
        label: "编辑",
        submenu: [
          { label: "撤销", accelerator: "CmdOrCtrl+Z", role: "undo" },
          { label: "重做", accelerator: "Shift+CmdOrCtrl+Z", role: "redo" },
          { type: "separator" },
          { label: "剪切", accelerator: "CmdOrCtrl+X", role: "cut" },
          { label: "复制", accelerator: "CmdOrCtrl+C", role: "copy" },
          { label: "粘贴", accelerator: "CmdOrCtrl+V", role: "paste" },
        ],
      },
      {
        label: "数据",
        submenu: [
          {
            label: "导出数据库",
            click: () => {
              windowManager
                .getMainWindow()
                ?.webContents.send("menu-export-database");
            },
          },
          {
            label: "导入数据库",
            click: () => {
              windowManager
                .getMainWindow()
                ?.webContents.send("menu-import-database");
            },
          },
        ],
      },
      {
        label: "帮助",
        submenu: [
          {
            label: "关于",
            click: () => {
              dialog.showMessageBox(windowManager.getMainWindow()!, {
                type: "info",
                title: "关于 HRCopilot",
                message: "HRCopilot v" + app.getVersion(),
                detail:
                  "智能JD简历匹配分析工具\n\n基于AI技术，帮助您快速分析简历与职位描述的匹配度。",
              });
            },
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private showErrorDialog(title: string, error: Error): void {
    dialog.showErrorBox(title, error.message);
  }
}

// 创建应用实例
const appInstance = new HRCopilotApp();

// 应用事件处理
app.whenReady().then(() => {
  appInstance.initialize();
});

// macOS activate 事件
app.on("activate", () => {
  // 当应用被激活（点击 dock 图标）时

  if (!appLifecycle.isQuitting()) {
    const mainWindow = windowManager.getMainWindow();
    const minibarWindow = windowManager.getMinibarWindow();

    // 如果主窗口正在显示，保持主窗口显示，不显示 Minibar 窗口
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      logger.info("主窗口正在显示，保持显示状态");
    }
    // 如果主窗口关闭，优先显示 Minibar 窗口
    else {
      // 如果 Minibar 窗口存在但隐藏，显示它
      if (minibarWindow && !minibarWindow.isDestroyed() && !minibarWindow.isVisible()) {
        minibarWindow.show();
      }
      // 如果 Minibar 窗口不存在（null 或已销毁），创建它
      else if (!minibarWindow || minibarWindow.isDestroyed()) {
        windowManager.showMinibarWindow();
      }
    }
  }
});

console.log("HRCopilot 主进程启动中...");
