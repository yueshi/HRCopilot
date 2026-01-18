#!/bin/bash

# 修复 IPC quit-app 处理
sed -i.bak '/ipcMain\.handle("quit-app"/,/^    });/{
    s/logger\.info("收到IPC退出请求");/\/\/ 防抖保护\n      const now = Date.now();\n      this.quitAttempts++;\n      \n      if (now - this.lastQuitTime < 1000) {\n        if (this.quitAttempts <= 3) {\n          logger.warn(`重复退出请求被阻止 (第${this.quitAttempts}次)`);\n        }\n        return;\n      }\n      \n      this.lastQuitTime = now;\n      logger.info(`收到退出请求 (第${this.quitAttempts}次)`);\n\/\/ 原来的日志
    s/^      app\.quit();/\/\/ 延迟退出确保清理完成\n      setTimeout(() => {\n        app.quit();\n      }, 100);\n\/\/ 原有的app.quit()移到这里
}
