/**
 * 窗口管理 IPC 处理器
 */

import { ipcMain } from "electron";
import { IPC_CHANNELS, type ShowMainWindowRequest, WindowState, type WindowStateResponse, type WindowType } from "../../shared/types/ipc";
import { windowManager as wm } from "../windowManager";
import { windowStateManager } from "../windowState";
import { logger } from "../utils/logger";

// 定义窗口管理器接口（用于类型定义）
interface WindowManagerLike {
  showMainWindow: (targetPath?: string) => void;
  hideMainWindow: () => void;
  getWindowState: () => {
    currentWindow: WindowType | null;
    mainWindowVisible: boolean;
    minibarWindowVisible: boolean;
  };
}

// 注册窗口管理 IPC 处理器
export function registerWindowHandlers(windowManager: WindowManagerLike = wm as WindowManagerLike): void {
  // 移除已存在的处理器
  const channels = [
    IPC_CHANNELS.WINDOW.SHOW_MAIN,
    IPC_CHANNELS.WINDOW.HIDE_MAIN,
    IPC_CHANNELS.WINDOW.SET_HIDDEN_PATH,
    IPC_CHANNELS.WINDOW.GET_HIDDEN_PATH,
    IPC_CHANNELS.WINDOW.CLEAR_HIDDEN_PATH,
    IPC_CHANNELS.WINDOW.GET_STATE,
    IPC_CHANNELS.WINDOW.TRANSITION_STATE,
  ];

  channels.forEach((channel) => {
    try {
      ipcMain.removeHandler(channel);
    } catch {
      // 忽略移除不存在的监听器的错误
    }
  });

  // 保存隐藏路径
  ipcMain.handle(
    IPC_CHANNELS.WINDOW.SET_HIDDEN_PATH,
    async (_event, path: string) => {
      windowStateManager.saveHiddenPath(path);
      return { success: true };
    },
  );

  // 获取隐藏路径
  ipcMain.handle(
    IPC_CHANNELS.WINDOW.GET_HIDDEN_PATH,
    async () => {
      return { success: true, data: windowStateManager.getHiddenPath() };
    },
  );

  // 清除隐藏路径
  ipcMain.handle(
    IPC_CHANNELS.WINDOW.CLEAR_HIDDEN_PATH,
    async () => {
      windowStateManager.clearHiddenPath();
      return { success: true };
    },
  );

  // 显示功能窗口
  ipcMain.handle(
    IPC_CHANNELS.WINDOW.SHOW_MAIN,
    async (_event, options?: ShowMainWindowRequest) => {
      const savedPath = windowStateManager.getHiddenPath();

      // 如果没有传路径，使用保存的路径；否则使用传入的路径
      const targetPath = options?.path || savedPath || '/home';

      // 如果请求了 clearPath 标志，则清除保存的路径
      if (options?.clearPath === true) {
        windowStateManager.clearHiddenPath();
      }

      logger.info(`显示主窗口，路径: ${targetPath}`);
      windowManager.showMainWindow(targetPath);
      return { success: true };
    },
  );

  // 隐藏功能窗口
  ipcMain.handle(IPC_CHANNELS.WINDOW.HIDE_MAIN, async () => {
    logger.info('隐藏主窗口');
    windowManager.hideMainWindow();
    return { success: true };
  });

  // 获取窗口状态
  ipcMain.handle(
    IPC_CHANNELS.WINDOW.GET_STATE,
    async (): Promise<WindowStateResponse> => {
      const wmState = windowManager.getWindowState();
      const wsState = windowStateManager.getState();
      return {
        ...wmState,
        hiddenMainPath: wsState.hiddenMainPath,
      };
    },
  );

  // 状态转换 - 允许渲染进程触发状态转换
  ipcMain.handle(IPC_CHANNELS.WINDOW.TRANSITION_STATE, async (_event, newState: WindowState) => {
    try {
      logger.info('收到状态转换请求:', newState);
      // 验证状态值是否有效（使用更可靠的方式）
      const validStates = [
        WindowState.MAIN_ONLY,
        WindowState.MAIN_WITH_MINIBAR,
        WindowState.MINIBAR_ONLY,
      ];
      if (!validStates.includes(newState)) {
        logger.error('无效的状态值:', newState, '有效值:', validStates);
        return {
          success: false,
          error: `无效的状态值: ${newState}`,
        };
      }
      windowStateManager.transitionTo(newState);
      return { success: true };
    } catch (error) {
      logger.error('状态转换失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '状态转换失败',
      };
    }
  });
}
