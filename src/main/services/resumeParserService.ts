import type { ParsedResumeInfo } from "../../shared/types";
import { logger } from "../utils/logger";

type SectionType = 'basic' | 'education' | 'experience' | 'skills' | 'projects' | 'selfAssessment' | 'certifications' | 'other';

interface DateRange {
  startDate?: string;
  endDate?: string;
  display?: string;
}

/**
 * 简历解析服务 - 增强版
 * 改进章节识别、字段提取和日期处理
 */
export class ResumeParserService {
  static parseResumeContent(content: string): ParsedResumeInfo {
    const result: ParsedResumeInfo = {
      name: undefined,
      gender: undefined,
      birthYear: undefined,
      phone: undefined,
      email: undefined,
      address: undefined,
      expectedSalary: undefined,
      workYears: undefined,
      skills: [],
      languages: [],
      education: [],
      experience: [],
      projects: [],
      certifications: [],
      honors: [],
      selfAssessment: undefined,
    };

    if (!content) {
      logger.warn("简历内容为空");
      return result;
    }

    logger.info("开始解析简历内容", {
      totalLines: content.split("\n").length,
      contentLength: content.length,
      contentPreview: content.substring(0, 300) + (content.length > 300 ? "..." : ""),
    });

    const lines = content.split("\n");
    let currentSection: SectionType = 'basic';
    let currentSectionLines: string[] = [];
    const sections: Array<{ type: SectionType; lines: string[] }> = [];

    // 第一阶段：识别章节边界并收集章节内容
    for (const line of lines) {
      const trimmed = line.trim();
      const sectionType = this.identifySectionType(trimmed);

      if (sectionType && sectionType !== 'other') {
        // 保存上一个章节
        if (currentSectionLines.length > 0) {
          sections.push({ type: currentSection, lines: [...currentSectionLines] });
        }
        // 开始新章节
        currentSection = sectionType;
        currentSectionLines = [trimmed];
      } else {
        // 添加到当前章节
        if (trimmed || currentSectionLines.length === 0) {
          currentSectionLines.push(trimmed);
        }
      }
    }

    // 保存最后一个章节
    if (currentSectionLines.length > 0) {
      sections.push({ type: currentSection, lines: [...currentSectionLines] });
    }

    logger.info("识别到的章节", {
      sections: sections.map(s => ({ type: s.type, lineCount: s. lines.length })),
    });

    // 第二阶段：按章节解析内容
    for (const section of sections) {
      const sectionContent = section.lines.filter(l => l.trim()).join(' ');

      switch (section.type) {
        case 'basic':
          this.parseBasicInfo(section.lines, result);
          break;
        case 'education':
          this.parseEducationSection(section.lines, result);
          break;
        case 'experience':
          this.parseExperienceSection(section.lines, result);
          break;
        case 'skills':
          this.parseSkillsSection(section.lines, result);
          break;
        case 'projects':
          this.parseProjectsSection(section.lines, result);
          break;
        case 'selfAssessment':
          this.parseSelfAssessmentSection(section.lines, result);
          break;
        case 'certifications':
          this.parseCertificationsSection(section.lines, result);
          break;
        case 'other':
          // 尝试从其他内容中提取基本信息
          if (!result.name || !result.email || !result.phone) {
            this.parseBasicInfo(section.lines, result);
          }
          break;
      }
    }

    // 第三阶段：如果没有明确章节，从全内容中提取基本信息
    if (sections.length === 0 || sections.every(s => s.type === 'basic' || s.type === 'other')) {
      logger.info("未识别到明确章节，尝试全内容解析");
      this.parseBasicInfo(lines, result);
      this.parseSkillsFromWholeContent(content, result);
    }

    // 第四阶段：日期规范化
    this.normalizeAllDates(result);

    // 第五阶段：技能规范化
    this.normalizeSkills(result);

    logger.info("======== 简历解析完成 ========", {
      name: result.name,
      gender: result.gender,
      birthYear: result.birthYear,
      email: result.email,
      phone: result.phone,
      address: result.address,
      expectedSalary: result.expectedSalary,
      workYears: result.workYears,
      stats: {
        skillsCount: result.skills.length,
        languagesCount: result.languages.length,
        educationCount: result.education.length,
        experienceCount: result.experience.length,
        projectsCount: result.projects.length,
        certificationsCount: result.certifications.length,
      },
    });

    return result;
  }

  /**
   * 识别章节类型
   * 改进：扩展关键词，不依赖分隔符
   */
  private static identifySectionType(line: string): SectionType | null {
    if (!line || line.length > 30) return null;

    const educationPatterns = [
      /教育背景|教育经历|学历|学习经历|校园经历|主修课程|毕业院校|教育|Education|School|Academic|Educational/i,
    ];
    const experiencePatterns = [
      /工作经历|工作经验|实习经历|项目经历|职业经历|职场经历|工作履历|工作|实习|公司|Work|Experience|Company|Job|Career|Employment|Professional/i,
    ];
    const skillsPatterns = [
      /专业技能|技能|能力|专长|特长|核心技能|技术栈|技能清单|掌握技能|熟悉技术|Skills|Professional|Competencies|Expertise|Stack|Technical|Skillset/i,
    ];
    const projectPatterns = [
      /项目经历|项目经验|Projects|Project/i,
    ];
    const selfAssessmentPatterns = [
      /自我评价|个人评价|职业目标|自我介绍|个人简介|Self Assessment|Career Objective|Self Summary/i,
    ];
    const certificationPatterns = [
      /证书|资质认证|资格|Certifications|Qualifications|Certifiate/i,
    ];

    if (educationPatterns.some(p => p.test(line))) {
      logger.info("识别到教育章节", { line });
      return 'education';
    }
    if (experiencePatterns.some(p => p.test(line))) {
      logger.info("识别到工作经历章节", { line });
      return 'experience';
    }
    if (skillsPatterns.some(p => p.test(line))) {
      logger.info("识别到技能章节", { line });
      return 'skills';
    }
    if (projectPatterns.some(p => p.test(line))) {
      logger.info("识别到项目章节", { line });
      return 'projects';
    }
    if (selfAssessmentPatterns.some(p => p.test(line))) {
      logger.info("识别到自我评价章节", { line });
      return 'selfAssessment';
    }
    if (certificationPatterns.some(p => p.test(line))) {
      logger.info("识别到证书章节", { line });
      return 'certifications';
    }

    return null;
  }

  /**
   * 解析基本信息
   */
  private static parseBasicInfo(lines: string[], result: ParsedResumeInfo): void {
    const content = lines.join(' ');

    // 提取姓名（只取第一个匹配）
    if (!result.name) {
      const nameMatch = this.findFirstMatch(content, [
        // 独立成行的中文姓名（2-4字）
        /^[\u4e00-\u9fa5]{2,4}$/,
        // 英文姓名
        /^[A-Z][a-z]+( [A-Z][a-z]+)?$/,
        // 中英文混合姓名
        /^[\u4e00-\u9fa5]{1,2}\s+[A-Z][a-z]+$/,
        // 标签式：姓名: xxx
        /(?:姓名|Name)[:：]\s*([^\n\r]+)/i,
        // 姓名前有中文称谓（个人简历、候选人等）
        /(?:个人简历|候选人|求职者)[:：]?\s*([\u4e00-\u9fa5]{2,4})/i,
      ]);
      if (nameMatch) {
        // 如果有捕获组，使用捕获组，否则使用完整匹配
        const name = nameMatch[1] ? nameMatch[1] : nameMatch[0];
        result.name = name.trim();
        logger.info("提取到姓名", { name: result.name });
      }
    }

    // 提取出生年月
    if (!result.birthYear) {
      const birthMatch = this.findFirstMatch(content, [
        /(?:出生日期|生日|Birth|Born)[:：]\s*(\d{4}[-年]\d{1,2}[-月])/,
        /(?:出生日期|生日|Birth|Born)[:：]\s*(\d{4})[-/]\d{1,2}/,
        /(?:出生日期|生日|Birth|Born)[:：]\s*(\d{4}年\d{1,2}月)/i,
      ]);
      if (birthMatch) {
        result.birthYear = birthMatch[1] || birthMatch[0];
        logger.info("提取到出生年月", { birthYear: result.birthYear });
      }
    }

    // 提取性别
    if (!result.gender) {
      const genderMatch = this.findFirstMatch(content, [
        // 标签式：性别: 男/女
        /(?:性别|Gender|Sex)[:：]\s*(男|女|Male|Female)/i,
        /(?:性别|Gender|Sex)[:：]\s*(0|1)/, // 0=男 1=女
        // 简历开头常见格式：男，25岁
        /^(男|女)[，\s]/,
        // 性别冒号
        /(?:男|女)[：]/i,
        // 年龄前缀：男25岁
        /(男|女)\d+\s*[岁]/i,
      ]);
      if (genderMatch) {
        const gender = genderMatch[1] || genderMatch[0];
        result.gender = gender === '0' ? '男' : gender === '1' ? '女' : gender;
        logger.info("提取到性别", { gender: result.gender });
      }
    }

    // 提取邮箱（改进的正则）
    if (!result.email) {
      const emailMatch = this.findFirstMatch(content, [
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?/,
      ]);
      if (emailMatch) {
        result.email = emailMatch[0];
        logger.info("提取到邮箱", { email: result.email });
      }
    }

    // 提取电话（改进的正则）
    if (!result.phone) {
      const phoneMatch = this.findFirstMatch(content, [
        /1[3-9]\d{9}/,
        /(?:\+86|0086)?[-\s]?1[3-9]\d{9}/,
        /(?:\d{3,4}[-\s]?)?\d{7,8}/,
        /(?:\+?\d{10,16})/,
      ]);
      if (phoneMatch) {
        result.phone = phoneMatch[0].replace(/[^0-9+\-]/g, '').replace(/\s/g, '');
        logger.info("提取到电话", { phone: result.phone });
      }
    }

    // 提取地址
    if (!result.address) {
      const addressMatch = this.findFirstMatch(content, [
        /(?:地址|居住地|现居|Address|Location)[:：]\s*([^\n]{2,100})/i,
      ]);
      if (addressMatch) {
        result.address = addressMatch[1].trim();
        logger.info("提取到地址", { address: result.address });
      }
    }

    // 提取期望薪资
    if (!result.expectedSalary) {
      const salaryMatch = this.findFirstMatch(content, [
        /(?:期望薪资|薪资|待遇|工资|Salary)[:：]\s*([^\n\r]+)/i,
        /(?:期望薪资|薪资|待遇|工资|Salary)\s*(\d+(?:[,.]\d+)*(?:k|K|千|万|元|¥|USD|美元|欧元|€)?)/i,
      ]);
      if (salaryMatch) {
        const salary = salaryMatch[1] || salaryMatch[0];
        result.expectedSalary = salary.trim();
        logger.info("提取到期望薪资", { expectedSalary: result.expectedSalary });
      }
    }

    // 提取工作年限
    if (!result.workYears) {
      const workYearsMatch = this.findFirstMatch(content, [
        /(?:工作年限|工作经验|工龄|从业年限)[:：]\s*(\d+)\s*[年]/i,
        /(?:工作年限|工作经验|工龄|从业年限)\s*(\d+)\s*年/i,
      ]);
      if (workYearsMatch) {
        result.workYears = workYearsMatch[1] || workYearsMatch[0];
        logger.info("提取到工作年限", { workYears: result.workYears });
      }
    }
  }

  /**
   * 解析教育经历
   */
  private static parseEducationSection(lines: string[], result: ParsedResumeInfo): void {
    let currentEducation: any = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 检测新条目（以时间开头或包含学校关键词）
      if (this.looksLikeNewEducationEntry(trimmed, currentEducation)) {
        if (currentEducation.school) {
          result.education.push(currentEducation);
          logger.info("添加教育经历", { education: currentEducation });
        }
        currentEducation = {};
      }

      // 尝试从当前行提取信息
      this.extractEducationInfo(trimmed, currentEducation);
    }

    // 保存最后一个条目
    if (currentEducation.school) {
      result.education.push(currentEducation);
      logger.info("添加教育经历", { education: currentEducation });
    }
  }

  private static looksLikeNewEducationEntry(line: string, currentEducation: any): boolean {
    // 以时间开头
    if (/^\d{4}[-年./]\d{1,2}/.test(line)) return true;

    // 包含学校关键词且当前已经有学校信息
    const schoolKeywords = ["大学", "学院", "University", "College", "Institute", "学校"];
    const hasSchoolKeyword = schoolKeywords.some(kw => line.includes(kw));
    if (hasSchoolKeyword && currentEducation.school && line.length < 50) {
      return true;
    }

    return false;
  }

  private static extractEducationInfo(line: string, education: any): void {
    // 提取学校名称
    if (!education.school) {
      const schoolKeywords = ["大学", "学院", "University", "College", "Institute", "School"];
      for (const kw of schoolKeywords) {
        if (line.includes(kw) && line.length > 2 && line.length < 100) {
          // 排除无效的学校名
          if (!line.match(/日期|时间|学位|专业|性别|地址|/i)) {
            education.school = line;
            return;
          }
        }
      }
    }

    // 提取学位
    if (!education.degree) {
      const degreeMatch = this.findFirstMatch(line, [
        /(?:学位|Degree)[:：]\s*(.+)/i,
        /(学士|硕士|博士|本科|专科|研究生|Bachelor|Master|PhD|Undergraduate|Associate)/,
      ]);
      if (degreeMatch) {
        education.degree = degreeMatch[1] || degreeMatch;
      }
    }

    // 提取专业
    if (!education.major) {
      const majorMatch = this.findFirstMatch(line, [
        /(?:专业|主修|Major)[:：]\s*(.+)/i,
      ]);
      if (majorMatch) {
        education.major = majorMatch[1].trim();
      }
    }

    // 提取时间
    if (!education.period) {
      const dateMatch = this.findFirstMatch(line, [
        /(?:时间|Time|Date)[:：]\s*(.+)/i,
        /\d{4}[-/./]\d{1,2}[-/.]?\d{0,2}\s*[-~到至]+\s*\d{4}[-/./]\d{1,2}[-/.]?\d{0,2}|至今|Present/i,
      ]);
      if (dateMatch) {
        education.period = dateMatch[1] || dateMatch;
      }
    }
  }

  /**
   * 解析工作经历
   */
  private static parseExperienceSection(lines: string[], result: ParsedResumeInfo): void {
    let currentExperience: any = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 检测新条目
      if (this.looksLikeNewExperienceEntry(trimmed, currentExperience)) {
        if (currentExperience.company || currentExperience.position) {
          result.experience.push(currentExperience);
          logger.info("添加工作经历", { experience: currentExperience });
        }
        currentExperience = {};
      }

      this.extractExperienceInfo(trimmed, currentExperience);
    }

    // 保存最后一个条目
    if (currentExperience.company || currentExperience.position) {
      result.experience.push(currentExperience);
      logger.info("添加工作经历", { experience: currentExperience });
    }
  }

  private static looksLikeNewExperienceEntry(line: string, currentExperience: any): boolean {
    // 以时间开头
    if (/^\d{4}[-年./]\d{1,2}/.test(line)) return true;

    // 以日期格式开头
    if (/^\d{4}年/.test(line)) return true;

    // 包含公司关键词且当前已有公司信息
    const companyKeywords = ["有限公司", "股份公司", "集团", "科技有限公司", "Co.", "Ltd.", "Inc.", "Corp."];
    const hasCompanyKeyword = companyKeywords.some(kw => line.includes(kw));
    if (hasCompanyKeyword && currentExperience.company && line.length < 100) {
      return true;
    }

    return false;
  }

  private static extractExperienceInfo(line: string, experience: any): void {
    // 提取公司名称
    if (!experience.company) {
      const companyKeywords = ["有限公司", "股份公司", "集团", "科技有限公司", "网络", "软件", "技术"];
      for (const kw of companyKeywords) {
        if (line.includes(kw) && line.length > 3 && line.length < 100) {
          if (!line.match(/日期|时间|职位|岗位|/i)) {
            experience.company = line;
            return;
          }
        }
      }

      // 英文公司名
      if (/^[A-Z][\w\s]+(?:Co\.|Ltd\.|Inc\.|Corp\.)/.test(line)) {
        experience.company = line;
        return;
      }

      // 公司名称（以大学开头但不是学校）
      if (/^[\u4e00-\u9fa5]{2,20}(大学|学院)/.test(line) && !line.match(/本科|硕士|博士|学历/)) {
        experience.company = line;
        return;
      }
    }

    // 提取职位
    if (!experience.position) {
      const positionMatch = this.findFirstMatch(line, [
        /(?:职位|岗位|Position|Job|Role|Title)[:：]\s*(.+)/i,
      ]);
      if (positionMatch) {
        experience.position = positionMatch[1].trim();
      } else {
        // 检查常见职位关键词
        const positionKeywords = [
          "工程师", "开发工程师", "软件工程师", "前端工程师", "后端工程师", "全栈工程师",
          "经理", "总监", "主管", "专员", "实习生", "助理", "顾问",
          "开发", "设计", "测试", "运维", "产品经理", "架构师",
          "Engineer", "Developer", "Manager", "Director", "Specialist", "Intern", "Assistant", "Consultant", "Architect",
        ];
        const hasPositionKeyword = positionKeywords.some(kw => line.includes(kw));
        if (hasPositionKeyword && !line.includes("有限公司") && !line.includes("公司") && line.length < 50) {
          experience.position = line;
        }
      }
    }

    // 提取时间
    if (!experience.period) {
      const dateMatch = this.findFirstMatch(line, [
        /(?:时间|Time|Date)[:：]\s*(.+)/i,
        /\d{4}[-/./]\d{1,2}[-/.]?\d{0,2}\s*[-~到至]+\s*\d{4}[-/./]\d{1,2}[-/.]?\d{0,2}|至今|Present/i,
      ]);
      if (dateMatch) {
        experience.period = dateMatch[1] || dateMatch;
      }
    }

    // 提取工作描述
    if (line.length > 5 && !line.includes("有限公司") && !line.includes("公司") &&
        !line.match(/^\d{4}/) && !line.match(/职位|岗位|Position|Job|Time|日期/)) {
      if (!experience.description) {
        experience.description = line;
      } else {
        experience.description += "\n" + line;
      }
    }
  }

  /**
   * 解析技能章节
   */
  private static parseSkillsSection(lines: string[], result: ParsedResumeInfo): void {
    const content = lines.join(' ');

    // 尝试多种分隔符
    const separators = [',', '，', '、', ';', '；', '|', '·', '/', '\n'];

    // 首先从多行中提取
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length > 200) continue;

      // 检查是否是技能列表（包含分隔符）
      if (separators.some(sep => trimmed.includes(sep))) {
        // 使用第一个匹配的分隔符拆分
        for (const sep of separators) {
          if (trimmed.includes(sep)) {
            const parts = trimmed.split(sep);
            for (const part of parts) {
              const skill = part.trim();
              if (skill.length > 1 && skill.length < 30 && !result.skills.includes(skill)) {
                if (!this.isExcludeSkillKeyword(skill)) {
                  result.skills.push(skill);
                }
              }
            }
            break;
          }
        }
      } else if (trimmed.length > 2 && trimmed.length < 30) {
        // 单个技能
        if (!this.isExcludeSkillKeyword(trimmed) && !result.skills.includes(trimmed)) {
          result.skills.push(trimmed);
        }
      }
    }
  }

  /**
   * 从整个内容中提取技能（降级方案）
   */
  private static parseSkillsFromWholeContent(content: string, result: ParsedResumeInfo): void {
    const skillPatterns = [
      // 编程语言和框架
      /(?:JavaScript|TypeScript|Python|Java|Go|Rust|C\+\+|C#|Ruby|PHP|Swift|Kotlin|Dart|Scala|Haskell|Lua|Shell|Bash|PowerShell)/gi,
      /(?:Vue|React|Angular|Svelte|Next\.js|Nuxt\.js|jQuery|Ember|Backbone|Alpine|Solid|Svelte|Native)/gi,
      /(?:Spring|Django|Flask|Express|Nest\.js|Koa|FastAPI|Laravel|Rails|Egg|Sinatra|Play|Falcon|Gin)/gi,
      /(?:[Bb]ootstrap|Tailwind|AntD|Ant Design|Material UI|Element UI|Vuetify|Bulma|Foundation|Semantic UI)/gi,

      // 数据库
      /(?:MySQL|PostgreSQL|MongoDB|Redis|SQLite|Oracle|ElasticSearch|DynamoDB|Cassandra|MariaDB|ClickHouse|Neo4j|InfluxDB|TimescaleDB|Couchbase|Memcached|HBase|Firebird|Riak)/gi,

      // 云服务和工具
      /(?:AWS|Azure|GCP|阿里云|腾讯云|华为云|Google Cloud|AWS Lambda|EC2|S3)/gi,
      /(?:Docker|Kubernetes|K8s|Docker Compose|Jenkins|Git|GitHub|GitLab|Bitbucket|Gitea|CI\/CD|Nginx|Apache|IIS|Envoy|Traefik|Prometheus)/gi,
      /(?:Linux|Windows|macOS|Unix|Ubuntu|CentOS|Debian|Fedora|RedHat|Alpine|Arch|Kali|FreeBSD|OpenBSD)/gi,

      // 开发工具
      /(?:VS\s*Code|Visual\s*Studio|IntelliJ|Eclipse|Xcode|Android\s*Studio|Web\s*Storm|PyCharm|GoLand|Rider|Vim|Emacs|Neovim|Sublime|Atom|Brackets|Notepad\+\+)/gi,
      /(?:Postman|Figma|Sketch|Jira|Confluence|Slack|Teams|Discord|Zoom|Trello|Asana|Monday|Miro|Basecamp)/gi,

      // 其他技术
      /(?:Git|SVN|Mercurial|Perforce|JFrog|Artifactory|Nexus|Maven|Gradle|npm|yarn|pnpm|pip|poetry|composer|cargo|go mod|nuget|pipenv|venv|conda|bower|gem|rust)/gi,
    ];

    for (const pattern of skillPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          if (!result.skills.includes(match) && match.length > 1 && match.length < 30) {
            result.skills.push(match);
          }
        }
      }
    }

    // 提取语言能力
    const languagePatterns = [
      /(?:英语|English)[：:]?\s*(?: CET|PET|CET|PTE|CET4|CET6|TOEFL|IELTS|TOEIC)/i,
      /(?:日语|Japanese|日文)[：:]?\s*(?:N\d+)/i,
      /(?:韩语|Korean|韩文)[：:]?\s*(?:TOPIK|TOPIC)/i,
      /(?:法语|French|法文)[：:]?\s*(?:DALF|TEF|TCF|TFI|TFU)/i,
      /(?:德语|German|德文)[：:]?\s*(?:Goethe|TestDaF|TestDaf|ZDaF|ZDf)/i,
      /(?:西班牙语|Spanish|西文)[：:]?\s*(?:DELE|SELE|SIELE)/i,
      /(?:俄语|Russian|俄文)[：:]?\s*(?:TORFL|TRKI|TRZN)/i,
      /(?:普通话|Mandarin)[：:]?\s*(?:一级|二级|三级|四级|六级|八级|甲等|乙等|丙等)/i,
    ];

    for (const pattern of languagePatterns) {
      const match = content.match(pattern);
      if (match) {
        const lang = match[0] || match[0].toString();
        if (!result.languages.includes(lang)) {
          result.languages.push(lang);
        }
      }
    }
  }

  /**
   * 解析项目经历
   */
  private static parseProjectsSection(lines: string[], result: ParsedResumeInfo): void {
    let currentProject: any = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 检测新条目
      if (this.looksLikeNewProjectEntry(trimmed, currentProject)) {
        if (currentProject.name) {
          result.projects.push(currentProject);
          logger.info("添加项目经历", { project: currentProject });
        }
        currentProject = {};
      }

      this.extractProjectInfo(trimmed, currentProject);
    }

    // 保存最后一个条目
    if (currentProject.name) {
      result.projects.push(currentProject);
      logger.info("添加项目经历", { project: currentProject });
    }
  }

  private static looksLikeNewProjectEntry(line: string, currentProject: any): boolean {
    // 以时间开头
    if (/^\d{4}[-年./]\d{1,2}/.test(line)) return true;

    return false;
  }

  private static extractProjectInfo(line: string, project: any): void {
    // 提取项目名称
    if (!project.name) {
      const projectMatch = this.findFirstMatch(line, [
        /(?:项目|Project)[:：]?\s*(.+)/i,
      ]);
      if (projectMatch) {
        project.name = projectMatch[1].trim();
      } else if (line.length > 2 && line.length < 100 && !line.match(/时间|描述|技能|Technology|Tech/i)) {
        project.name = line;
      }
    }

    // 提取角色
    if (!project.role) {
      const roleMatch = this.findFirstMatch(line, [
        /(?:角色|Role|担任)[：:]?\s*(.+)/i,
      ]);
      if (roleMatch) {
        project.role = roleMatch[1].trim();
      }
    }

    // 提取技术栈
    if (!project.technologies) {
      const techMatch = this.findFirstMatch(line, [
        /(?:技术栈|技术|Technology|Tech)[：:]?\s*(.+)/i,
      ]);
      if (techMatch) {
        const techs = techMatch[1].split(/[,，、;；|]+/).map(t => t.trim()).filter(t => t.length > 0);
        project = project.technologies || [];
        techs.forEach(t => {
          if (!project.technologies.includes(t)) {
            project.technologies.push(t);
          }
        });
      }
    }

    // 提取时间
    if (!project.period) {
      const dateMatch = this.findFirstMatch(line, [
        /(?:时间|Time|Date)[:：]\s*(.+)/i,
        /\d{4}[-/./]\d{1,2}[-/.]?\d{0,2}\s*[-~到至]+\s*\d{4}[-/./]\d{1,2}[-/.]?\d{0,2}|至今|Present/i,
      ]);
      if (dateMatch) {
        project.period = dateMatch[1] || dateMatch;
      }
    }

    // 提取描述
    if (line.length > 5 && !line.match(/时间|项目|Role|角色|Technology|技术/i)) {
      if (!project.description) {
        project.description = line;
      } else {
        project.description += "\n" + line;
      }
    }
  }

  /**
   * 解析自我评价
   */
  private static parseSelfAssessmentSection(lines: string[], result: ParsedResumeInfo): void {
    const content = lines.filter(l => l.trim()).join('\n');
    if (content.length > 10) {
      result.selfAssessment = content.substring(0, 500);
      logger.info("提取到自我评价", { length: result.selfAssessment.length });
    }
  }

  /**
   * 解析证书
   */
  private static parseCertificationsSection(lines: string[], result: ParsedResumeInfo): void {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 2 || trimmed.length > 100) continue;

      // 排除标题行
      if (/证书|资质|资格|Certifications|Qualifications|Certificate/i.test(line)) continue;

      result.certifications.push(trimmed);
    }

    if (result.certifications.length > 0) {
      logger.info("提取到证书", { count: result.certifications.length });
    }
  }

  /**
   * 判断是否是需要排除的技能关键词
   */
  private static isExcludeSkillKeyword(skill: string): boolean {
    const excludeKeywords = [
      "的", "和", "与", "等", "擅长", "精通", "熟悉", "包括",
      "技能", "能力", "专长", "擅长", "会", "掌握",
      "熟练", "了解", "能够", "进行", "完成", "使用",
      "Skills", "Ability", "Expertise", "Proficient", "Knowledge",
      "软件", "工具", "技术", "系统", "应用", "平台",
    ];
    return excludeKeywords.some(ex => skill === ex || skill.startsWith(ex + " ") || skill.endsWith(" " + ex));
  }

  /**
   * 查找第一个匹配项（返回完整匹配结果以支持捕获组）
   */
  private static findFirstMatch(text: string, patterns: RegExp[]): RegExpMatchArray | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[0]) {
        return match;
      }
    }
    return null;
  }

  /**
   * 规范化所有日期格式
   */
  private static normalizeAllDates(result: ParsedResumeInfo): void {
    // 规范化工作经历日期
    for (const exp of result.experience) {
      if (exp.period) {
        const dateRange = this.parseDateRange(exp.period);
        if (dateRange.startDate) {
          exp.startDate = dateRange.startDate;
        }
        if (dateRange.endDate) {
          exp.endDate = dateRange.endDate;
        }
        if (dateRange.display) {
          exp.period = dateRange.display;
        }
      }
    }

    // 规范化教育日期
    for (const edu of result.education) {
      if (edu.period) {
        const dateRange = this.parseDateRange(edu.period);
        if (dateRange.display) {
          edu.period = dateRange.display;
        }
      }
    }

    // 规范化项目日期
    for (const proj of result.projects) {
      if (proj.period) {
        const dateRange = this.parseDateRange(proj.period);
        if (dateRange.display) {
          proj.period = dateRange.display;
        }
      }
    }
  }

  /**
   * 规范化技能
   */
  private static normalizeSkills(result: ParsedResumeInfo): void {
    result.skills = result.skills.map(skill => {
      return skill.trim()
        .replace(/^[\s,.，、;；]*|[\s,.，、;；]*$/g, '')
        .replace(/^熟练|掌握|精通|熟悉|了解[\s]*|[\s]*熟练掌握|精通|熟悉|了解$/g, '');
    }).filter(skill => skill.length > 1 && !this.isExcludeSkillKeyword(skill));
  }

  /**
   * 解析日期范围
   * 支持多种格式
   */
  private static parseDateRange(text: string): DateRange {
    const result: DateRange = {};

    // 格式1: 2018.09 - 2022.06 或 2018-09-2022-06
    let match = text.match(/(\d{4})[-.](\d{1,2})[-.]?(\d{1,2})?\s*[-~到至]+\s*(\d{4})[-.](\d{1,2})[-.]?(\d{1,2})?/i);
    if (match) {
      const startYear = match[1];
      const startMonth = match[2].padStart(2, '0');
      const endYear = match[4];
      const endMonth = match[5] ? match[5].padStart(2, '0') : '06';
      result.startDate = `${startYear}-${startMonth}`;
      result.endDate = `${endYear}-${endMonth}`;
      result.display = `${startYear}.${startMonth} - ${endYear}.${endMonth}`;
      return result;
    }

    // 格式2: 2018年09月 - 2022年06月 或 至今
    match = text.match(/(\d{4})年(\d{1,2})月\s*[-~到至]+\s*(\d{4})年(\d{1,2})月|至今|Present|到现在/i);
    if (match) {
      const startYear = match[1];
      const startMonth = match[2].padStart(2, '0');
      const end = match[3] || match[4];
      result.startDate = `${startYear}-${startMonth}`;
      if (end === '至今' || end === '' + '至今' || end === 'Present' || end === '到现在') {
        result.endDate = '至今';
        result.display = `${startYear}年${startMonth}月 - 至今`;
      } else if (match[3]) {
        const endYear = match[3];
        const endMonth = match[4] ? match[4].padStart(2, '0') : '06';
        result.endDate = `${endYear}-${endMonth}`;
        result.display = `${startYear}年${startMonth}月 - ${endYear}年${endMonth}月`;
      }
      return result;
    }

    // 格式3: 2018.09 - 至今
    match = text.match(/(\d{4})[-.](\d{1,2})\s*[-~到至]+\s*(\d{4})[-.](\d{1,2})|至今|Present/i);
    if (match) {
      const startYear = match[1];
      const startMonth = match[2].padStart(2, '0');
      const endYear = match[3];
      result.startDate = `${startYear}-${startMonth}`;
      if (match[3] === '至今' || match[3] === 'Present') {
        result.endDate = '至今';
        result.display = `${startYear}.${startMonth} - 至今`;
      } else {
        const endMonth = match[4] ? match[4].padStart(2, '0') : '06';
        result.endDate = `${endYear}-${endMonth}`;
        result.display = `${startYear}.${startMonth} - ${endYear}.${endMonth}`;
      }
      return result;
    }

    // 格式4: 2018 - 2022 (只有年份）
    match = text.match(/(\d{4})\s*[-~到至]+\s*(\d{4})/i);
    if (match) {
      result.startDate = match[1];
      result.endDate = match[2];
      result.display = `${match[1]} - ${match[2]}`;
      return result;
    }

    // 格式5: 2018.09 - 至今
    match = text.match(/(\d{4})[-.](\d{1,2})\s*[-~到至]+\s*(至今|Present)/i);
    if (match) {
      const startYear = match[1];
      const startMonth = match[2].padStart(2, '0');
      result.startDate = `${startYear}-${startMonth}`;
      result.endDate = '至今';
      result.display = `${startYear}.${startMonth} - 至今`;
      return result;
    }

    return result;
  }
}

export const resumeParserService = new ResumeParserService();
