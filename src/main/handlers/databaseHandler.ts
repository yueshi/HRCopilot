import { IpcMainInvokeEvent } from 'electron';
import { BaseHandler } from './base';
import { IPC_CHANNELS, ErrorCode } from '../../shared/types';
import { database } from '../database/sqlite';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

export class DatabaseHandler extends BaseHandler {
  constructor() {
    super();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.register(IPC_CHANNELS.DATABASE.GET_PATH, this.getDatabasePath.bind(this));
    this.register(IPC_CHANNELS.DATABASE.EXPORT, this.exportDatabase.bind(this));
    this.register(IPC_CHANNELS.DATABASE.IMPORT, this.importDatabase.bind(this));
    this.register(IPC_CHANNELS.DATABASE.GET_STATS, this.getDatabaseStats.bind(this));
  }

  /**
   * 获取数据库文件路径
   */
  private async getDatabasePath(
    event: IpcMainInvokeEvent
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 获取数据库路径`);

    try {
      const dbPath = database.getDatabasePath();
      return {
        success: true,
        data: {
          path: dbPath,
          size: 0,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('获取数据库路径失败:', error);
      return {
        success: false,
        error: '获取数据库路径失败',
        code: ErrorCode.DATABASE_ERROR,
      };
    }
  }

  /**
   * 导出数据库
   */
  private async exportDatabase(
    event: IpcMainInvokeEvent,
    request: { filePath?: string }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 导出数据库`);

    try {
      const dbPath = database.getDatabasePath();
      const targetPath = request.filePath || await this.selectExportPath();

      if (!targetPath) {
        return {
          success: false,
          error: '未选择导出路径',
        };
      }

      await fs.copyFile(dbPath, targetPath);

      logger.info(`数据库导出成功: ${targetPath}`);
      return {
        success: true,
        data: { path: targetPath },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('数据库导出失败:', error);
      return {
        success: false,
        error: `数据库导出失败: ${(error as Error).message}`,
        code: ErrorCode.DATABASE_ERROR,
      };
    }
  }

  /**
   * 导入数据库
   */
  private async importDatabase(
    event: IpcMainInvokeEvent,
    request: { filePath: string }
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 导入数据库: ${request.filePath}`);

    try {
      const { valid } = await this.validateFile(request.filePath);
      if (!valid) {
        return {
          success: false,
          error: '源数据库文件不存在',
          code: ErrorCode.FILE_NOT_FOUND,
        };
      }

      const dbPath = database.getDatabasePath();
      const backupPath = `${dbPath}.backup`;
      await fs.copyFile(dbPath, backupPath);

      database.close();

      await fs.copyFile(request.filePath, dbPath);

      await database.init();

      logger.info(`数据库导入成功: ${request.filePath}`);
      return {
        success: true,
        data: { backupPath },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('数据库导入失败:', error);
      return {
        success: false,
        error: `数据库导入失败: ${(error as Error).message}`,
        code: ErrorCode.DATABASE_ERROR,
      };
    }
  }

  /**
   * 获取数据库统计信息
   */
  private async getDatabaseStats(
    event: IpcMainInvokeEvent
  ): Promise<any> {
    const userId = this.getCurrentUserId(event);
    logger.info(`用户 ${userId} 获取数据库统计`);

    try {
      const stats = await database.getStats();
      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('获取数据库统计失败:', error);
      return {
        success: false,
        error: '获取数据库统计失败',
        code: ErrorCode.DATABASE_ERROR,
      };
    }
  }

  /**
   * 选择导出路径
   */
  private async selectExportPath(): Promise<string | null> {
    const { dialog } = await import('electron');
    const result = await dialog.showSaveDialog({
      title: '导出数据库',
      defaultPath: `resumerhelper_backup_${Date.now()}.db`,
      filters: [
        { name: 'SQLite 数据库', extensions: ['db'] },
      ],
    });

    return result.canceled ? null : result.filePath;
  }
}
