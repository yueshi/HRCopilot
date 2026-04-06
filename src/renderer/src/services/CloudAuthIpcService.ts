/**
 * 云端认证 IPC 服务
 */

import { invokeIPC } from "./ipcApi";

export const cloudAuthApi = {
  /**
   * 云端登录
   */
  login: async (username: string, password: string) => {
    return await invokeIPC("cloud-auth:login", { username, password });
  },

  /**
   * 获取云端 Token
   */
  getToken: async () => {
    return await invokeIPC("cloud-auth:get-token");
  },

  /**
   * 验证 Token
   */
  validateToken: async (token: string) => {
    return await invokeIPC("cloud-auth:validate-token", token);
  },

  /**
   * 获取用户信息
   */
  getUserInfo: async () => {
    return await invokeIPC("cloud-auth:get-user-info");
  },

  /**
   * 云端登出
   */
  logout: async () => {
    return await invokeIPC("cloud-auth:logout");
  },

  /**
   * 获取配置
   */
  getConfig: async () => {
    return await invokeIPC("cloud-auth:get-config");
  },

  /**
   * 检查是否可用
   */
  isAvailable: async () => {
    return await invokeIPC("cloud-auth:is-available");
  },

  /**
   * 保存配置
   */
  saveConfig: async (config: { apiUrl: string; enabled: boolean }) => {
    return await invokeIPC("setting:save-cloud-config", config);
  },

  /**
   * 重新加载配置
   */
  reloadConfig: async () => {
    return await invokeIPC("cloud-auth:reload-config");
  },
};
