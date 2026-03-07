/**
 * JD (职位描述) IPC 服务层
 * 封装所有 JD 相关的 IPC 调用
 */

import { invokeIPC } from "./ipcApi";
import { IPC_CHANNELS } from "@/shared/types/ipc";
import type { ApiResponse } from "@/shared/types";
import type {
  JDData,
  JDCreateRequest,
  JDUpdateRequest,
  JDFilterParams,
  JDStats,
  ResumeJDMatch,
} from "@/shared/types/jd";

/**
 * JD IPC 服务
 */
export const jdService = {
  /**
   * 获取 JD 列表
   */
  async listJDs(filters?: JDFilterParams): Promise<JDData[]> {
    const result = await invokeIPC<ApiResponse<JDData[]>>(
      IPC_CHANNELS.JD.LIST,
      filters || {},
    );
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "获取 JD 列表失败");
  },

  /**
   * 获取单个 JD
   */
  async getJD(id: string): Promise<JDData | null> {
    const result = await invokeIPC<ApiResponse<JDData | null>>(
      IPC_CHANNELS.JD.GET,
      id,
    );
    if (result.success && result.data) {
      return result.data;
    }
    return null;
  },

  /**
   * 创建 JD
   */
  async createJD(data: JDCreateRequest): Promise<JDData> {
    const result = await invokeIPC<ApiResponse<JDData>>(
      IPC_CHANNELS.JD.CREATE,
      data,
    );
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "创建 JD 失败");
  },

  /**
   * 更新 JD
   */
  async updateJD(data: JDUpdateRequest): Promise<JDData | null> {
    const result = await invokeIPC<ApiResponse<JDData | null>>(
      IPC_CHANNELS.JD.UPDATE,
      data,
    );
    if (result.success && result.data) {
      return result.data;
    }
    return null;
  },

  /**
   * 删除 JD
   */
  async deleteJD(id: string): Promise<void> {
    const result = await invokeIPC<ApiResponse<void>>(
      IPC_CHANNELS.JD.DELETE,
      id,
    );
    if (!result.success) {
      throw new Error(result.error || "删除 JD 失败");
    }
  },

  /**
   * 获取 JD 统计
   */
  async getJDStats(): Promise<JDStats> {
    const result = await invokeIPC<ApiResponse<JDStats>>(
      IPC_CHANNELS.JD.GET_STATS,
    );
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.result || "获取 JD 统计失败");
  },

  /**
   * 匹配简历
   */
  async matchResume(resumeId: number, jdId: string): Promise<ResumeJDMatch> {
    const result = await invokeIPC<ApiResponse<ResumeJDMatch>>(
      IPC_CHANNELS.JD.MATCH_RESUME,
      {
        resumeId,
        jdId,
      },
    );
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "简历匹配失败");
  },

  /**
   * 获取 JD 的匹配列表
   */
  async getMatchesByJD(jdId: string): Promise<ResumeJDMatch[]> {
    const result = await invokeIPC<ApiResponse<ResumeJDMatch[]>>(
      IPC_CHANNELS.JD.GET_MATCHES,
      jdId,
    );
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "获取匹配列表失败");
  },

  /**
   * 获取简历的所有匹配
   */
  async getMatchesByResume(resumeId: number): Promise<ResumeJDMatch[]> {
    const result = await invokeIPC<ApiResponse<ResumeJDMatch[]>>(
      IPC_CHANNELS.JD.GET_MATCHES_BY_RESUME,
      resumeId,
    );
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "获取简历匹配列表失败");
  },
};
