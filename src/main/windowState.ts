/**
 * 窗口状态机
 * 集中管理窗口状态的单一事实来源
 * 负责协调所有窗口的显示/隐藏状态
 */

import { ipcMain } from 'electron';
import { logger } from './utils/logger';
import { WindowState } from '../shared/types/ipc';

export interface WindowStateData {
  hiddenMainPath: string | null;
  mainWindowVisible: boolean;
  minibarWindowVisible: boolean;
}

class WindowStateManager {
  private currentState: WindowState = WindowState.MAIN_ONLY;
  private data: WindowStateData = {
    hiddenMainPath: null,
    mainWindowVisible: false,
    minibarWindowVisible: false,
  };

  /**
   * 切换到指定的窗口状态
   */
  transitionTo(newState: WindowState): void {
    const oldState = this.currentState;
    this.currentState = newState;

    logger.info(`窗口状态切换: ${oldState} -> ${newState}`);

    // 根据新状态执行窗口操作
    this.applyWindowState(newState, oldState);

    // 通知所有渲染进程
    this.emitStateChange();
  }

  /**
   * 根据状态应用窗口操作
   */
  private applyWindowState(newState: WindowState, oldState: WindowState): void {
    switch (newState) {
      case WindowState.MAIN_ONLY:
        // 只显示主窗口
        this.emitEvent('show-main');
        this.emitEvent('hide-minibar');
        break;

      case WindowState.MAIN_WITH_MINIBAR:
        // 显示主窗口 + Minibar 窗口
        this.emitEvent('show-main');
        this.emitEvent('show-minibar');
        break;

      case WindowState.MINIBAR_ONLY:
        // 只显示 Minibar 窗口
        this.emitEvent('hide-main');
        this.emitEvent('show-minibar');
        break;
    }
  }

  /**
   * 发送窗口事件到 WindowManager
   */
  private emitEvent(event: string): void {
    ipcMain.emit(`window-manager:${event}`);
  }

  /**
   * 保存隐藏路径
   */
  saveHiddenPath(path: string | null): void {
    this.data.hiddenMainPath = path;
    this.emitStateChange();
    logger.info(`保存隐藏路径: ${path}`);
  }

  /**
   * 获取隐藏路径
   */
  getHiddenPath(): string | null {
    return this.data.hiddenMainPath;
  }

  /**
   * 清除隐藏路径
   */
  clearHiddenPath(): void {
    this.data.hiddenMainPath = null;
    this.emitStateChange();
    logger.info('清除隐藏路径');
  }

  /**
   * 设置主窗口可见状态
   */
  setMainWindowVisible(visible: boolean): void {
    this.data.mainWindowVisible = visible;
    this.emitStateChange();
  }

  /**
   * 设置折叠窗口可见状态
   */
  setMinibarWindowVisible(visible: boolean): void {
    this.data.minibarWindowVisible = visible;
    this.emitStateChange();
  }

  /**
   * 获取完整状态
   */
  getState(): WindowStateData {
    return { ...this.data };
  }

  /**
   * 获取当前窗口状态（枚举）
   */
  getCurrentState(): WindowState {
    return this.currentState;
  }

  /**
   * 发送状态变化事件
   */
  private emitStateChange(): void {
    ipcMain.emit('window-state-changed', this.getState());
  }
}

// 导出单例
export const windowStateManager = new WindowStateManager();
