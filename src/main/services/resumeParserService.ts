import type { ParsedResumeInfo } from "../../shared/types";
import { logger } from "../utils/logger";

export class ResumeParserService {
  static parseResumeContent(content: string): ParsedResumeInfo {
    const result: ParsedResumeInfo = {
      name: undefined,
      gender: undefined,
      phone: undefined,
      email: undefined,
      address: undefined,
      skills: [],
      education: [],
      experience: [],
    } as ParsedResumeInfo;

    if (!content) {
      return result;
    }

    const lines = content.split("\n");
    let currentSection = "";
    let currentEducation: any = {};
    let currentExperience: any = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (this.isEducationSection(line)) {
        currentSection = "education";
        continue;
      }
      if (this.isExperienceSection(line)) {
        currentSection = "experience";
        continue;
      }
      if (this.isSkillsSection(line)) {
        currentSection = "skills";
        continue;
      }

      if (this.isSectionEnd(line)) {
        if (currentSection === "education" && currentEducation.school) {
          result.education?.push({ ...currentEducation });
          currentEducation = {};
        }
        if (currentSection === "experience" && currentExperience.company) {
          result.experience?.push({ ...currentExperience });
          currentExperience = {};
        }
        currentSection = "";
        continue;
      }

      if (!result.name && this.mightBeName(line) && !line.includes(":")) {
        result.name = line;
      }

      if (!result.email) {
        const emailMatch = line.match(/[\w.-]+@[\w.-.-]+\.\w+/);
        if (emailMatch) result.email = emailMatch[0];
      }

      if (!result.phone) {
        const phoneMatch = line.match(
          /1[3-9]\d{9}|(\+86)?1[3-9]\d{9}|\d{3,4}-\d{7,8}/,
        );
        if (phoneMatch) result.phone = phoneMatch[0];
      }

      switch (currentSection) {
        case "education":
          this.parseEducationLine(line, currentEducation);
          break;
        case "experience":
          this.parseExperienceLine(line, currentExperience);
          break;
        case "skills":
          this.parseSkillsLine(line, result.skills || []);
          break;
      }
    }

    if (currentEducation.school) {
      result.education?.push(currentEducation);
    }
    if (currentExperience.company) {
      result.experience?.push(currentExperience);
    }

    logger.info("简历解析完成", {
      name: result.name,
      email: result.email,
      skillsCount: result.skills.length,
      educationCount: result.education.length,
      experienceCount: result.experience.length,
    });

    return result;
  }

  private static isEducationSection(line: string): boolean {
    return /教育|学历|学校|毕业|Education|School/i.test(line);
  }

  private static isExperienceSection(line: string): boolean {
    return /工作|经历|实习|公司|Work|Experience|Company/i.test(line);
  }

  private static isSkillsSection(line: string): boolean {
    return /技能|能力|专长|Skills|Professional/i.test(line);
  }

  private static isSectionEnd(line: string): boolean {
    return /^[-=]{2,}$/.test(line);
  }

  private static mightBeName(line: string): boolean {
    const chineseName = /^[\u4e00-\u9fa5]{2,4}$/.test(line);
    const englishName = /^[A-Z][a-z]+( [A-Z][a-z]+)?$/.test(line);
    return chineseName || englishName;
  }

  private static parseEducationLine(line: string, currentEducation: any): void {
    if (!currentEducation.school && this.looksLikeSchool(line)) {
      currentEducation.school = line;
      return;
    }
    if (
      !currentEducation.degree &&
      /学士|硕士|博士|本科|专科|Bachelor|Master|PhD/i.test(line)
    ) {
      currentEducation.degree = line;
      return;
    }
    if (!currentEducation.major && /专业|Major/i.test(line)) {
      currentEducation.major = line.replace(/专业|Major|[:：]\s*/gi, "").trim();
      return;
    }
    if (
      !currentEducation.period &&
      /\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{4}\.\d{1,2}\.\d{1,2}/.test(line)
    ) {
      currentEducation.period = line;
      return;
    }
  }

  private static looksLikeSchool(line: string): boolean {
    const schoolKeywords = [
      "大学",
      "学院",
      "学校",
      "University",
      "College",
      "Institute",
      "School",
      "科技",
      "理工",
      "师范",
      "医科",
      "财经",
      "政法",
      "农林",
      "艺术",
    ];
    return (
      schoolKeywords.some((kw) => line.includes(kw)) &&
      line.length > 2 &&
      line.length < 50
    );
  }

  private static parseExperienceLine(
    line: string,
    currentExperience: any,
  ): void {
    if (!currentExperience.company && this.looksLikeCompany(line)) {
      currentExperience.company = line;
      return;
    }
    if (
      !currentExperience.position &&
      /职位|岗位|Position|Job|Role/i.test(line)
    ) {
      currentExperience.position = line
        .replace(/职位|岗位|Position|Job|Role|[:：]\.*/gi, "")
        .trim();
      return;
    }
    if (
      !currentExperience.period &&
      /\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{4}\.\d{1,2}\.\d{1,2}|至今|Present/i.test(
        line,
      )
    ) {
      currentExperience.period = line;
      return;
    }
    if (
      currentExperience.company &&
      line.length > 10 &&
      !this.looksLikeCompany(line)
    ) {
      if (!currentExperience.description) {
        currentExperience.description = line;
      } else {
        currentExperience.description += "\n" + line;
      }
    }
  }

  private static looksLikeCompany(line: string): boolean {
    if (line.length < 2 || line.length > 100) {
      return false;
    }
    const excludeKeywords = [
      "职位",
      "岗位",
      "时间",
      "描述",
      "责任",
      "职责",
      "完成",
    ];
    if (excludeKeywords.some((kw) => line.includes(kw))) {
      return false;
    }
    const companySuffixes = [
      "有限公司",
      "股份公司",
      "集团",
      "科技",
      "网络",
      "软件",
      "技术",
      "Co.",
      "Ltd.",
      "Inc.",
      "Corp.",
      "Group",
      "Tech",
      "Net",
    ];
    return (
      companySuffixes.some((suffix) => line.includes(suffix)) ||
      /^[A-Z]/.test(line)
    );
  }

  private static parseSkillsLine(line: string, skills: string[]): void {
    const keywords = line.split(/[,，、;；|]+/);
    keywords.forEach((kw) => {
      const skill = kw.trim();
      if (skill.length > 1 && skill.length < 30 && !skills.includes(skill)) {
        const excludeKeywords = [
          "的",
          "和",
          "与",
          "等",
          "擅长",
          "精通",
          "熟悉",
          "包括",
        ];
        if (
          !excludeKeywords.some(
            (ex) => skill === ex || skill.startsWith(ex + " "),
          )
        ) {
          skills.push(skill);
        }
      }
    });
  }
}

export const resumeParserService = new ResumeParserService();
