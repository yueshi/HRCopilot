/**
 * Webview Preload 脚本
 * 用于在 webview 中注入认证信息和处理通信
 *
 * 注意：这是一个 Node.js 环境（通过 esbuild 编译），
 * 所以不能使用 window 等浏览器 API
 * 这些代码将在 webview 中执行
 */

const { contextBridge } = require("electron");

// 认证信息（从 URL 参数或注入的数据中获取）
let authToken: string | null = null;
let userId: number | null = null;
let userEmail: string | null = null;

/**
 * 初始化认证信息
 */
contextBridge.exposeInMainWorld("webviewAuth", {
  /**
   * 设置认证 Token
   */
  setToken: (token: string) => {
    authToken = token;
  },

  /**
   * 获取认证 Token
   */
  getToken: () => {
    return authToken;
  },

  /**
   * 设置用户信息
   */
  setUserInfo: (info: { id: number; email: string }) => {
    userId = info.id;
    userEmail = info.email;
  },

  /**
   * 获取用户信息
   */
  getUserInfo: () => {
    return {
      id: userId,
      email: userEmail,
    };
  },

  /**
   * 清除认证信息
   */
  clearAuth: () => {
    authToken = null;
    userId = null;
    userEmail = null;
  },
});

// 导出供外部使用
if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
  console.log("[Webview Preload] 预加载脚本已加载");
}

export {};
