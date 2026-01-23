/**
 * 简历解析服务 - 基础正则表达式版本
 * 用于简历上传时的基本信息提取
 */

export interface ParsedResumeInfo {
  name?: string;
  email?: string;
  phone?: string;
  gender?: string;
  address?: string;
  birthYear?: string;
  skills: string[];
  education: Array<{
    school?: string;
    degree?: string;
    major?: string;
    period?: string;
  }>;
  experience: Array<{
    company?: string;
    position?: string;
    period?: string;
    description?: string;
  }>;
}

export class ResumeParserService {
  /**
   * 解析简历内容并返回结构化信息
   */
  static parseResumeContent(content: string): ParsedResumeInfo {
    const result: ParsedResumeInfo = {
      skills: [],
      education: [],
      experience: [],
    };

    // 提取姓名
    result.name = this.extractName(content);

    // 提取联系方式
    result.email = this.extractEmail(content);
    result.phone = this.extractPhone(content);

    // 提取性别
    result.gender = this.extractGender(content);

    // 提取地址
    result.address = this.extractAddress(content);

    // 提取出生年份
    result.birthYear = this.extractBirthYear(content);

    // 提取技能
    result.skills = this.extractSkills(content);

    // 提取教育经历
    result.education = this.extractEducation(content);

    // 提取工作经历
    result.experience = this.extractExperience(content);

    return result;
  }

  /**
   * 提取姓名
   */
  private static extractName(content: string): string | undefined {
    const patterns = [
      /(?:姓名|Name|个人简历)[：:\s]*([^\n\r,，]{2,10})/i,
      /^([^\n\r]{2,4})\s*(?:性别|男|女|出生|电话|手机|邮箱)/m,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim().replace(/[：:\s，,]/g, '');
        if (name.length >= 2 && name.length <= 10) {
          return name;
        }
      }
    }

    return undefined;
  }

  /**
   * 提取邮箱
   */
  private static extractEmail(content: string): string | undefined {
    const pattern = /[\w.-]+@[\w.-]+\.\w+/i;
    const match = content.match(pattern);
    return match ? match[0].toLowerCase().trim() : undefined;
  }

  /**
   * 提取电话号码
   */
  private static extractPhone(content: string): string | undefined {
    const patterns = [
      /(?:电话|手机|Phone|Mobile|Tel|联系电话)[：:\s]*(1[3-9]\d{9,10})/i,
      /1[3-9]\d{9}/,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1] || match[0]) {
        const phone = (match[1] || match[0]).replace(/\D/g, '');
        if (/^1[3-9]\d{9}$/.test(phone)) {
          return phone;
        }
      }
    }

    return undefined;
  }

  /**
   * 提取性别
   */
  private static extractGender(content: string): string | undefined {
    const pattern = /(?:性别|Gender|Sex)[：:\s]*(男|女|male|female)/i;
    const match = content.match(pattern);
    if (match) {
      const gender = match[1].toLowerCase();
      if (gender === 'male') return '男';
      if (gender === 'female') return '女';
      return match[1];
    }
    return undefined;
  }

  /**
   * 提取地址
   */
  private static extractAddress(content: string): string | undefined {
    const patterns = [
      /(?:地址|Address|现居住地|居住地)[：:\s]*([^\n\r]+)/i,
      /(?:北京市|上海市|天津市|重庆市|广东省|江苏省|浙江省|四川省|湖北省|湖南省|河南省|山东省|福建省|安徽省|江西省|辽宁省|黑龙江省|吉林省|河北省|山西省|陕西省|甘肃省|青海省|云南省|贵州省|海南省|广西壮族自治区|内蒙古自治区|新疆维吾尔自治区|西藏自治区|宁夏回族自治区)[^\n\r]{0,20}/i,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1] || match[0]) {
        const address = (match[1] || match[0]).trim();
        if (address.length > 3 && address.length < 50) {
          return address;
        }
      }
    }

    return undefined;
  }

  /**
   * 提取出生年份
   */
  private static extractBirthYear(content: string): string | undefined {
    const patterns = [
      /(?:出生年|出生日期|Birth|Birthday)[：:\s]*(\d{4})/,
      /(\d{4})年\d{1,2}月/,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const year = match[1];
        const yearNum = parseInt(year, 10);
        if (yearNum >= 1960 && yearNum <= new Date().getFullYear()) {
          return year;
        }
      }
    }

    return undefined;
  }

  /**
   * 提取技能
   */
  private static extractSkills(content: string): string[] {
    const skillKeywords = [
      // 编程语言
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
      'Node.js', 'Nodejs',
      // 前端框架
      'React', 'Vue', 'Angular', 'Svelte', 'jQuery', 'Redux', 'MobX', 'Vuex',
      // 后端框架
      'Express', 'Koa', 'Nest.js', 'Django', 'Flask', 'Spring Boot', 'Spring', 'ASP.NET',
      // 数据库
      'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle', 'SQL Server', 'Elasticsearch',
      // 云平台
      'AWS', 'Azure', 'GCP', 'Alibaba Cloud', 'Tencent Cloud',
      // 容器与编排
      'Docker', 'Kubernetes', 'K8s', 'Docker Compose',
      // 工具
      'Git', 'GitLab', 'GitHub', 'Jenkins', 'Travis CI', 'CircleCI',
      // 操作系统
      'Linux', 'Windows', 'macOS', 'Unix', 'Ubuntu', 'CentOS',
      // 移动开发
      'iOS', 'Android', 'React Native', 'Flutter',
      // 其他
      'HTML', 'CSS', 'Sass', 'Less', 'Webpack', 'Vite', 'Babel', 'ESLint', 'Prettier',
      'RESTful API', 'GraphQL', 'gRPC', 'WebSocket', 'HTTP', 'HTTPS', 'TCP', 'UDP',
      'OAuth', 'JWT', 'Redis', 'Memcached', 'Nginx', 'Apache',
      'CI/CD', 'DevOps', 'Agile', 'Scrum', 'Kanban',
      'Machine Learning', 'ML', 'Deep Learning', 'DL', 'TensorFlow', 'PyTorch', 'Keras',
      'Data Analysis', 'Data Science', 'Big Data', 'Hadoop', 'Spark',
    ];

    const foundSkills = skillKeywords.filter((skill) => {
      try {
        const regex = new RegExp(skill.replace(/\./g, '\\.'), 'i');
        return regex.test(content);
      } catch {
        return false;
      }
    });

    return [...new Set(foundSkills)];
  }

  /**
   * 提取教育经历
   */
  private static extractEducation(content: string): Array<{
    school?: string;
    degree?: string;
    major?: string;
    period?: string;
  }> {
    const educations: Array<{
      school?: string;
      degree?: string;
      major?: string;
      period?: string;
    }> = [];

    // 查找教育经历区块
    const educationKeywords = ['教育经历', 'Education', '学历', '教育背景', '学习经历'];
    const startKeywords = educationKeywords.join('|');

    // 尝试匹配教育经历部分
    const educationPattern = new RegExp(
      `(?:${startKeywords})[：:\\s]*\\n([\\s\\S]*?)(?=\\n(?:工作经历|Work Experience|项目经验|Projects|专业技能|)|$)`,
      'i'
    );
    const match = content.match(educationPattern);

    if (!match) {
      return educations;
    }

    const educationSection = match[1];
    const lines = educationSection.split(/\n+/).filter((line) => line.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length < 5 || trimmed.length > 200) {
        continue;
      }

      const education: any = {};

      // 提取时间范围
      const periodMatch = trimmed.match(/\d{4}(\.\d{1,2}|年\d{1,2}月)?\s*[-–—至到]+\s*\d{4}(\.\d{1,2}|年\d{1,2}月)?|至今/);
      if (periodMatch) {
        education.period = periodMatch[0];
      }

      // 提取学校名称
      const schoolPatterns = [
        /(?:大学|学院|University|College|Institute)[^\d]{0,30}/i,
        /^(.{2,20})(大学|学院|University|College)/i,
      ];
      for (const pattern of schoolPatterns) {
        const schoolMatch = trimmed.match(pattern);
        if (schoolMatch) {
          education.school = schoolMatch[0].trim();
          break;
        }
      }

      // 提取学位
      const degreePatterns = [
        /(博士|硕士|本科|专科|高中|Bachelor|Master|Doctor|PhD|MBA)/i,
      ];
      for (const pattern of degreePatterns) {
        const degreeMatch = trimmed.match(pattern);
        if (degreeMatch) {
          education.degree = degreeMatch[0];
          break;
        }
      }

      // 提取专业
      const majorPatterns = [
        /专业[：:\s]*([^\n\r,，;；]{2,20})/i,
        /(?:计算机|软件|电子|机械|土木|化学|生物|医学|经济|金融|管理|法律|文学|历史|哲学|教育|艺术|设计)[\u4e00-\u9fa5]{0,10}(专业|方向|系)/,
      ];
      for (const pattern of majorPatterns) {
        const majorMatch = trimmed.match(pattern);
        if (majorMatch && majorMatch[1] || majorMatch[0]) {
          education.major = (majorMatch[1] || majorMatch[0]).replace(/[专业方向系：:\s]/g, '').trim();
          break;
        }
      }

      // 如果至少有一个字段，添加到结果
      if (education.school || education.degree || education.major || education.period) {
        educations.push(education);
      }
    }

    return educations;
  }

  /**
   * 提取工作经历
   */
  private static extractExperience(content: string): Array<{
    company?: string;
    position?: string;
    period?: string;
    description?: string;
  }> {
    const experiences: Array<{
      company?: string;
      position?: string;
      period?: string;
      description?: string;
    }> = [];

    // 查找工作经历区块
    const workKeywords = ['工作经历', 'Work Experience', '工作经验', '职业经历', '任职经历', '工作背景'];
    const startKeywords = workKeywords.join('|');

    const workPattern = new RegExp(
      `(?:${startKeywords})[：:\\s]*\\n([\\s\\S]*?)(?=\\n(?:项目经验|Projects|教育经历|Education|专业技能|自我评价|兴趣爱好|)|$)`,
      'i'
    );
    const match = content.match(workPattern);

    if (!match) {
      return experiences;
    }

    const workSection = match[1];
    const lines = workSection.split(/\n+/).filter((line) => line.trim());

    let currentExperience: any = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // 跳过空行或过长的行
      if (trimmed.length < 2 || trimmed.length > 500) {
        continue;
      }

      // 检查是否是新的一行工作经历（通常以时间开始）
      const newWorkPattern = /\d{4}(\.\d{1,2}|年\d{1,2}月)?\s*[-–—至到]+\s*\d{4}(\.\d{1,2}|年\d{1,2}月)?|至今/;
      if (newWorkPattern.test(trimmed)) {
        // 保存上一个经历
        if (currentExperience && (currentExperience.company || currentExperience.position)) {
          experiences.push(currentExperience);
        }

        // 开始新的经历
        currentExperience = {
          period: trimmed.match(newWorkPattern)?.[0],
        };

        // 尝试从同一行提取公司和职位
        const companyPatterns = [
          /(?:有限公司|股份公司|集团|科技|网络|软件|技术|信息|数据|智能|互联网)[\u4e00-\u9fa5A-Za-z0-9()（）]{0,20}/,
        ];
        for (const pattern of companyPatterns) {
          const companyMatch = trimmed.match(pattern);
          if (companyMatch) {
            currentExperience.company = companyMatch[0];
            break;
          }
        }

        const positionPatterns = [
          /(?:工程师|开发|设计|经理|总监|主管|专员|分析师|顾问|架构师|技术)[\u4e00-\u9fa5A-Za-z]{0,10}/,
          /(?:Engineer|Developer|Designer|Manager|Director|Lead|Analyst|Consultant|Architect)/i,
        ];
        for (const pattern of positionPatterns) {
          const positionMatch = trimmed.match(pattern);
          if (positionMatch) {
            currentExperience.position = positionMatch[0];
            break;
          }
        }
      } else if (currentExperience) {
        // 添加描述
        if (!currentExperience.description) {
          currentExperience.description = trimmed;
        } else {
          currentExperience.description += '\n' + trimmed;
        }
      }
    }

    // 保存最后一个经历
    if (currentExperience && (currentExperience.company || currentExperience.position)) {
      experiences.push(currentExperience);
    }

    return experiences;
  }
}
