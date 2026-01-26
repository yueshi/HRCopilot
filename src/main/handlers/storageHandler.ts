/**
 * 存储处理器
 * 负责管理持久化存储（用于用户登录信息等）
 * 使用文件系统实现跨应用重启的持久化
 */

import { ipcMain, app } from 'electron';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_FILE_NAME = 'storage.json';

function getStorageFilePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, STORAGE_FILE_NAME);
}

function loadStorage(): Record<string, string> {
  try {
    const filePath = getStorageFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
    return {};
  } catch (error) {
    logger.error('加载存储文件失败:', error);
    return {};
  }
}

function saveStorage(data: Record<string, string>): boolean {
  try {
    const filePath = getStorageFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    logger.error('保存存储文件失败:', error);
    return false;
  }
}

export class StorageHandler {
  constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // 移除旧的处理器（如果存在）
    ipcMain.removeHandler('storage');

    // 注册新的处理器
    ipcMain.handle('storage', async (event, operation: string, ...args: any[]) => {
      logger.info(`存储操作: ${operation}, 参数:`, args);

      if (operation === 'get') {
        return this.handleGet(args[0]);
      } else if (operation === 'set') {
        return this.handleSet(args[0], args[1]);
      } else if (operation === 'remove') {
        return this.handleRemove(args[0]);
      } else {
        return { success: false, error: '无效的操作' };
      }
    });
  }

  private handleGet(key: string): any {
    if (!key) {
      logger.warn('存储键不能为空');
      return null;
    }
    try {
      const storage = loadStorage();
      const value = storage[key];
      logger.info(`handleGet: 键 ${key}, 值类型: ${typeof value}, 值长度: ${typeof value === 'string' ? value.length : 'N/A'}`);
      return value;
    } catch (error) {
      logger.error(`获取存储值失败: ${key}`, error);
      return null;
    }
  }

  private handleSet(key: string, value: string): { success: boolean; error?: string } {
    if (!key) {
      logger.warn('存储键不能为空');
      return { success: false, error: '存储键不能为空' };
    }
    try {
      const storage = loadStorage();
      storage[key] = value;
      const saved = saveStorage(storage);
      logger.info(`设置存储值: ${key}, 保存${saved ? '成功' : '失败'}`);
      return { success: saved };
    } catch (error) {
      logger.error(`设置存储值失败: ${key}`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  private handleRemove(key: string): { success: boolean; error?: string } {
    if (!key) {
      logger.warn('存储键不能为空');
      return { success: false, error: '存储键不能为空' };
    }
    try {
      const storage = loadStorage();
      delete storage[key];
      const saved = saveStorage(storage);
      logger.info(`移除存储值: ${key}, 保存${saved ? '成功' : '失败'}`);
      return { success: saved };
    } catch (error) {
      logger.error(`移除存储值失败: ${key}`, error);
      return { success: false, error: (error as Error).message };
    }
  }
}

export const storageHandler = new StorageHandler();
