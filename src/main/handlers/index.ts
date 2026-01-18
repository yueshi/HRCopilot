import { UserHandler } from './userHandler';
import { ResumeHandler } from './resumeHandler';
import { SettingHandler } from './settingHandler';
import { AIHRAssistantHandler } from './aiHrAssistantHandler';
import { registerWindowHandlers } from './windowHandler';
import { logger } from '../utils/logger';

/**
 * 注册所有 IPC 处理器
 * 在 main.ts 的 initialize() 中调用
 */
export function registerAllHandlers(): void {
  try {
    // 注册用户相关处理器
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

    // 注册窗口管理相关处理器
    registerWindowHandlers();
    logger.info('窗口管理 IPC 处理器已注册');

    logger.info('所有 IPC 处理器注册完成');
  } catch (error) {
    logger.error('注册 IPC 处理器失败:', error);
    throw error;
  }
}
