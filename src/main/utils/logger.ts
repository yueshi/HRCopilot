import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

class Logger {
  private logFile: string;
  private logLevel: LogLevel;
  private isShuttingDown = false;

  constructor() {
    const userDataPath = app.getPath('userData');
    const logDir = path.join(userDataPath, 'logs');

    // 确保日志目录存在
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    this.logFile = path.join(logDir, 'app.log');
    this.logLevel = process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;

    // 监听应用退出事件
    app.on('will-quit', () => {
      this.isShuttingDown = true;
    });
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => {
      if (arg instanceof Error) {
        return `Error: ${arg.message}\nStack: ${arg.stack}`;
      } else if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      } else {
        return String(arg);
      }
    }).join(' ') : '';

    return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
  }

  private writeLog(level: LogLevel, message: string, ...args: any[]): void {
    if (this.shouldLog(level)) {
      const logMessage = this.formatMessage(level, message, ...args);

      // 写入文件
      try {
        fs.appendFileSync(this.logFile, logMessage + '\n', 'utf8');
      } catch (error) {
        // 静默处理文件写入错误，避免递归
      }

      // 控制台输出（仅在应用未关闭时）
      if (!this.isShuttingDown && process.stdout && !process.stdout.destroyed) {
        switch (level) {
          case LogLevel.ERROR:
            console.error(logMessage);
            break;
          case LogLevel.WARN:
            console.warn(logMessage);
            break;
          case LogLevel.INFO:
            console.info(logMessage);
            break;
          case LogLevel.DEBUG:
            console.debug(logMessage);
            break;
        }
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  error(message: string, ...args: any[]): void {
    this.writeLog(LogLevel.ERROR, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.writeLog(LogLevel.WARN, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.writeLog(LogLevel.INFO, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.writeLog(LogLevel.DEBUG, message, ...args);
  }

  // 清理日志文件
  cleanLogs(daysToKeep: number = 30): void {
    try {
      const logDir = path.dirname(this.logFile);
      const files = fs.readdirSync(logDir);
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

      files.forEach(file => {
        if (file.endsWith('.log')) {
          const filePath = path.join(logDir, file);
          const stats = fs.statSync(filePath);

          if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
            this.info('已删除旧日志文件:', file);
          }
        }
      });
    } catch (error) {
      this.error('清理日志文件失败:', error);
    }
  }

  // 获取日志文件大小
  getLogSize(): number {
    try {
      return fs.statSync(this.logFile).size;
    } catch (error) {
      return 0;
    }
  }

  // 设置日志级别
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

export const logger = new Logger();