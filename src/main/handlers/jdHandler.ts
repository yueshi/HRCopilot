/**
 * JD (职位描述) Handler
 * 处理 JD 的 CRUD 操作和简历匹配
 */

import { BaseHandler } from "./base";
import { IPC_CHANNELS } from "../../shared/types/ipc";
import { database } from "../database/sqlite";
import { aiAnalysisService } from "../services/aiAnalysis";
import type { IpcMainInvokeEvent } from "electron";
import type {
  JDData,
  JDCreateRequest,
  JDUpdateRequest,
  JDFilterParams,
  ResumeJDMatch,
} from "../../shared/types/jd";

export class JDHandler extends BaseHandler {
  constructor() {
    super();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // 获取 JD 列表
    this.register(
      IPC_CHANNELS.JD.LIST,
      async (event, filters: JDFilterParams) => {
        return await this.handleList(event, filters);
      },
    );

    // 获取单个 JD
    this.register(IPC_CHANNELS.JD.GET, async (event, id: string) => {
      return await this.handleGet(event, id);
    });

    // 创建 JD
    this.register(
      IPC_CHANNELS.JD.CREATE,
      async (event, data: JDCreateRequest) => {
        return await this.handleCreate(event, data);
      },
    );

    // 更新 JD
    this.register(
      IPC_CHANNELS.JD.UPDATE,
      async (event, data: JDUpdateRequest) => {
        return await this.handleUpdate(event, data);
      },
    );

    // 删除 JD
    this.register(IPC_CHANNELS.JD.DELETE, async (event, id: string) => {
      return await this.handleDelete(event, id);
    });

    // 获取 JD 统计
    this.register(IPC_CHANNELS.JD.GET_STATS, async (event) => {
      return await this.handleGetStats(event);
    });

    // 匹配简历
    this.register(
      IPC_CHANNELS.JD.MATCH_RESUME,
      async (event, data: { resumeId: number; jdId: string }) => {
        return await this.handleMatchResume(event, data);
      },
    );

    // 获取匹配列表
    this.register(IPC_CHANNELS.JD.GET_MATCHES, async (event, jdId: string) => {
      return await this.handleGetMatches(event, jdId);
    });

    // 获取简历的所有匹配
    this.register(IPC_CHANNELS.JD.GET_MATCHES_BY_RESUME, async (event, resumeId: number) => {
      return await this.handleGetMatchesByResume(event, resumeId);
    });
  }

  private async handleList(event: IpcMainInvokeEvent, filters: JDFilterParams): Promise<JDData[]> {
    try {
      const jds = await database.getJDsByUserId(this.getCurrentUserId(event), filters);
      return jds;
    } catch (error) {
      console.error("获取 JD 列表失败:", error);
      throw error;
    }
  }

  private async handleGet(event: IpcMainInvokeEvent, id: string): Promise<JDData | null> {
    try {
      const jd = await database.getJDById(id);
      if (jd && jd.user_id !== this.getCurrentUserId(event)) {
        return null;
      }
      return jd;
    } catch (error) {
      console.error("获取 JD 失败:", error);
      throw error;
    }
  }

  private async handleCreate(event: IpcMainInvokeEvent, data: JDCreateRequest): Promise<JDData> {
    try {
      const jd = await database.createJD({
        ...data,
        user_id: this.getCurrentUserId(event),
      });
      return jd;
    } catch (error) {
      console.error("创建 JD 失败:", error);
      throw error;
    }
  }

  private async handleUpdate(event: IpcMainInvokeEvent, data: JDUpdateRequest): Promise<JDData | null> {
    try {
      const existing = await database.getJDById(data.jd_id);
      if (!existing) {
        throw new Error("JD 不存在");
      }
      if (existing.user_id !== this.getCurrentUserId(event)) {
        throw new Error("无权限");
      }
      const jd = await database.updateJD(data.jd_id, data);
      return jd;
    } catch (error) {
      console.error("更新 JD 失败:", error);
      throw error;
    }
  }

  private async handleDelete(event: IpcMainInvokeEvent, jdId: string): Promise<void> {
    try {
      const existing = await database.getJDById(jdId);
      if (!existing) {
        throw new Error("JD 不存在");
      }
      if (existing.user_id !== this.getCurrentUserId(event)) {
        throw new Error("无权限");
      }
      await database.deleteJD(jdId);
    } catch (error) {
      console.error("删除 JD 失败:", error);
      throw error;
    }
  }

  private async handleGetStats(event: IpcMainInvokeEvent): Promise<{
    total: number;
    active: number;
    inactive: number;
    closed: number;
  }> {
    try {
      const stats = await database.getJDStats(this.getCurrentUserId(event));
      return stats;
    } catch (error) {
      console.error("获取 JD 统计失败:", error);
      throw error;
    }
  }

  private async handleMatchResume(event: IpcMainInvokeEvent, data: {
    resumeId: number;
    jdId: string;
  }): Promise<ResumeJDMatch> {
    try {
      const userId = this.getCurrentUserId(event);
      // 检查权限
      const jd = await database.getJDById(data.jdId);
      if (!jd || jd.user_id !== userId) {
        throw new Error("JD 不存在或无权限");
      }

      // 获取简历
      const resume = await database.getResumeById(data.resumeId);
      if (!resume || resume.user_id !== userId) {
        throw new Error("简历不存在或无权限");
      }

      // 调用 AI 服务进行匹配分析
      const aiResult = await aiAnalysisService.analyzeJDMatch({
        resumeContent: resume.processed_content || '',
        resumeParsedInfo: resume.parsed_info,
        jdTitle: jd.title,
        jdDescription: jd.description,
        jdRequirements: jd.requirements || [],
        jdResponsibilities: jd.responsibilities || [],
        jdSkills: jd.skills || [],
      });

      const match = await database.createResumeJDMatch({
        resume_id: data.resumeId,
        jd_id: data.jdId,
        match_score: aiResult.match_score,
        skill_match_score: aiResult.skill_match_score,
        experience_match_score: aiResult.experience_match_score,
        education_match_score: aiResult.education_match_score,
        overall_assessment: aiResult.overall_assessment,
        strengths: aiResult.strengths,
        weaknesses: aiResult.weaknesses,
        recommendation: aiResult.recommendation,
      });

      return match;
    } catch (error) {
      console.error("简历匹配失败:", error);
      throw error;
    }
  }

  private async handleGetMatches(event: IpcMainInvokeEvent, jdId: string): Promise<ResumeJDMatch[]> {
    try {
      const jd = await database.getJDById(jdId);
      if (!jd || jd.user_id !== this.getCurrentUserId(event)) {
        throw new Error("JD 不存在或无权限");
      }

      const matches = await database.getMatchesByJD(jdId);
      return matches;
    } catch (error) {
      console.error("获取匹配列表失败:", error);
      throw error;
    }
  }

  private async handleGetMatchesByResume(event: IpcMainInvokeEvent, resumeId: number): Promise<ResumeJDMatch[]> {
    try {
      const resume = await database.getResumeById(resumeId);
      if (!resume || resume.user_id !== this.getCurrentUserId(event)) {
        throw new Error("简历不存在或无权限");
      }

      const matches = await database.getMatchesByResume(resumeId);
      return matches;
    } catch (error) {
      console.error("获取简历匹配列表失败:", error);
      throw error;
    }
  }
}
