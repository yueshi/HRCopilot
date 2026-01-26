import { UserHandler } from './userHandler';
import { ResumeHandler } from './resumeHandler';
import { SettingHandler } from './settingHandler';
import { AIHRAssistantHandler } from './aiHrAssistantHandler';
import { DatabaseHandler } from './databaseHandler';
import { DeduplicationHandler } from './deduplicationHandler';
import { VersionHandler } from './versionHandler';
import { registerWindowHandlers } from './windowHandler';
import { StorageHandler } from './storageHandler';
import { logger } from '../utils/logger';

/**
 * 注册所有 IPC 处理器
 * 在 main.ts 的 initialize() 中调用
 */
export function registerAllHandlers(): void {
  try {
    // // 注册用户相关处理器
    new UserHandler();
    logger.info('用户 IPC 处理器已注册');

    // 注册简历相关处理器
    new ResumeHandler();
    logger.info('简历 IPC 处理器已注册');

    // 注册设置相关处理器
    new SettingHandler();
    logger.info('设置 IPC 处理器已注册');

    // 注册 AI HR 助手相关处理器
    new AIHRAssistantHandler();
    logger.info('AI HR 助手 IPC 处理器已注册');

    // 注册文件相关处理器
    logger.info('文件 IPC 处理器已注册');

    // 注册数据库相关处理器
    new DatabaseHandler();
    logger.info('数据库 IPC 处理器已注册');

    // 注册版本管理相关处理器
    new VersionHandler();
    logger.info('版本管理 IPC 处理器已注册');

    // 注册去重相关处理器
    new DeduplicationHandler();
    logger.info('去重 IPC 处理器已注册');

    // 注册窗口管理相关处理器
    registerWindowHandlers();
    logger.info('窗口管理 IPC 处理器已注册');

    // 注册持久化存储相关处理器
    new StorageHandler();
    logger.info('持久化存储 IPC 处理器已注册');

    logger.info('所有 IPC 处理器注册完成');
  } catch (error) {
    logger.error('注册 IPC 处理器失败:', error);
    throw error;
  }
}
