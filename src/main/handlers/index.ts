import { UserHandler } from "./userHandler";
import { ResumeHandler } from "./resumeHandler";
import { SettingHandler } from "./settingHandler";
import { AIHRAssistantHandler } from "./aiHrAssistantHandler";
import { DatabaseHandler } from "./databaseHandler";
import { DeduplicationHandler } from "./deduplicationHandler";
import { VersionHandler } from "./versionHandler";
import { registerWindowHandlers } from "./windowHandler";
import { StorageHandler } from "./storageHandler";
import { JDHandler } from "./jdHandler";
import { CloudAuthHandler } from "./cloudAuthHandler";
import { logger } from "../utils/logger";

export function registerAllHandlers(): void {
  try {
    new UserHandler();
    logger.info("用户 IPC 处理器已注册");

    new ResumeHandler();
    logger.info("简历 IPC 处理器已注册");

    new SettingHandler();
    logger.info("设置 IPC 处理器已注册");

    new AIHRAssistantHandler();
    logger.info("AI HR 助手 IPC 处理器已注册");

    logger.info("文件 IPC 处理器已注册");

    new DatabaseHandler();
    logger.info("数据库 IPC 处理器已注册");

    new VersionHandler();
    logger.info("版本管理 IPC 处理器已注册");

    new DeduplicationHandler();
    logger.info("去重 IPC 处理器已注册");

    registerWindowHandlers();
    logger.info("窗口管理 IPC 处理器已注册");

    new StorageHandler();
    logger.info("持久化存储 IPC 处理器已注册");

    new JDHandler();
    logger.info("JD IPC 处理器已注册");

    new CloudAuthHandler();
    logger.info("云端认证 IPC 处理器已注册");

    logger.info("所有 IPC 处理器注册完成");
  } catch (error) {
    logger.error("注册 IPC 处理器失败:", error);
    throw error;
  }
}
