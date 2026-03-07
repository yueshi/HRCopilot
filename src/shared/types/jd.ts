/**
 * JD (职位描述) 相关类型定义
 */

// ============ JD 基础类型 ============

export type JDStatus = "active" | "inactive" | "closed";
export type JDDepartment =
  | "技术"
  | "产品"
  | "运营"
  | "设计"
  | "市场"
  | "销售"
  | "人事"
  | "财务"
  | "其他";
export type JDSeniority = "应届生" | "初级" | "中级" | "高级" | "专家" | "总监";

// ============ JD 数据结构 ============

export interface JDData {
  id: number;
  jd_id: string; // 唯一标识 (uuid)
  user_id: number; // 创建者ID
  title: string; // 职位标题
  department: string; // 所属部门
  seniority: string; // 职级要求
  location: string; // 工作地点
  salary_min?: number; // 薪资下限
  salary_max?: number; // 薪资上限
  description: string; // 职位描述
  requirements: string[]; // 岗位要求列表
  responsibilities: string[]; // 岗位职责列表
  skills: string[]; // 技能要求
  status: JDStatus; // 状态
  resume_count: number; // 关联简历数量
  created_at: string;
  updated_at: string;
}

// ============ JD 创建/更新请求 ============

export interface JDCreateRequest {
  title: string;
  department?: string;
  seniority?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  description: string;
  requirements?: string[];
  responsibilities?: string[];
  skills?: string[];
}

export interface JDUpdateRequest extends Partial<JDCreateRequest> {
  jd_id: string; // 使用 jd_id 而不是 id
  status?: JDStatus;
}

// ============ JD 筛选条件 ============

export interface JDFilterParams {
  status?: JDStatus;
  department?: string;
  search?: string;
}

// ============ 简历-JD 关联 ============

export interface ResumeJDMatch {
  id: number;
  resume_id: number;
  jd_id: number;
  match_score: number; // 总体匹配度 0-100
  skill_match_score: number; // 技能匹配度
  experience_match_score: number; // 经验匹配度
  education_match_score: number; // 教育匹配度
  overall_assessment: string; // 综合评估
  strengths: string[]; // 优势
  weaknesses: string[]; // 劣势
  recommendation: "strong" | "consider" | "reject"; // 推荐等级
  rank?: number; // 排名
  created_at: string;
  updated_at: string;
}

// ============ 初筛结果 ============

export interface ScreeningResult {
  jd: JDData;
  matches: ResumeJDMatch[];
  total_count: number;
  strong_count: number;
  consider_count: number;
  reject_count: number;
  average_score: number;
}

// ============ JD 统计 ============

export interface JDStats {
  total_jds: number;
  active_jds: number;
  total_resumes: number;
  avg_match_score: number;
}

// ============ JD 模板 ============

export interface JDTemplate {
  id: string;
  name: string;
  department: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  skills: string[];
}

// 预设 JD 模板
export const JD_TEMPLATES: JDTemplate[] = [
  {
    id: "frontend_dev",
    name: "前端开发工程师",
    department: "技术",
    description: "负责公司产品的前端开发工作",
    requirements: [
      "本科及以上学历，计算机相关专业",
      "3年以上前端开发经验",
      "熟悉 React/Vue 等主流框架",
    ],
    responsibilities: [
      "负责前端架构设计和开发",
      "优化前端性能和用户体验",
      "与产品经理、设计师协作",
    ],
    skills: ["React", "TypeScript", "HTML/CSS", "JavaScript"],
  },
  {
    id: "backend_dev",
    name: "后端开发工程师",
    department: "技术",
    description: "负责公司产品的后端开发工作",
    requirements: [
      "本科及以上学历，计算机相关专业",
      "3年以上后端开发经验",
      "熟悉 Java/Go/Python 等语言",
    ],
    responsibilities: [
      "负责后端系统设计和开发",
      "设计和优化数据库结构",
      "保证系统稳定性和性能",
    ],
    skills: ["Java", "Spring Boot", "MySQL", "Redis"],
  },
  {
    id: "product_manager",
    name: "产品经理",
    department: "产品",
    description: "负责产品规划和需求管理",
    requirements: [
      "本科及以上学历",
      "3年以上产品经验",
      "具备良好的沟通协调能力",
    ],
    responsibilities: [
      "负责产品需求分析和规划",
      "撰写产品文档和原型",
      "推动产品迭代和优化",
    ],
    skills: ["产品规划", "需求分析", "Axure", "数据分析"],
  },
  {
    id: "ui_designer",
    name: "UI设计师",
    department: "设计",
    description: "负责产品界面设计和视觉规范",
    requirements: [
      "本科及以上学历，设计相关专业",
      "3年以上UI设计经验",
      "具备良好的审美能力",
    ],
    responsibilities: [
      "负责产品界面设计",
      "制定视觉设计规范",
      "与开发团队协作",
    ],
    skills: ["Figma", "Sketch", "Photoshop", "Illustrator"],
  },
];
