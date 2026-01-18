import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";
import fs from "fs";
import { logger } from "../utils/logger";
import { encrypt, decrypt, maskApiKey, isValidEncryptedData } from "../utils/encryption";
import { v4 as uuidv4 } from "uuid";
import type {
  LLMProvider,
  LLMProviderCreateRequest,
  LLMProviderUpdateRequest,
  LLMTaskConfig,
} from "../../shared/types/llm";

export class DatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;
  private initPromise: Promise<void> | null = null;
  private connectionCount = 0;

  constructor() {
    // 获取用户数据目录
    const userDataPath = app.getPath("userData");
    this.dbPath = path.join(userDataPath, "resumerhelper.db");

    logger.info(`数据库路径: ${this.dbPath}`);
  }

  getDatabasePath(): string {
    return this.dbPath;
  }

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    try {
      // 确保数据目录存在
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // 打开数据库连接
      this.db = new Database(this.dbPath);

      // 配置数据库
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("foreign_keys = ON");
      this.db.pragma("temp_store = MEMORY");
      this.db.pragma("mmap_size = 268435456"); // 256MB

      logger.info("数据库连接已建立");

      // 创建表
      await this.createTables();

      // 运行数据库迁移
      await this.runMigrations();

      // 初始化默认 LLM 配置
      await this.initDefaultLLMProviders();

      logger.info("数据库初始化完成");
    } catch (error) {
      logger.error("数据库初始化失败:", error);
      throw new Error(`数据库初始化失败: ${(error as Error).message}`);
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error("数据库未初始化");
    }

    try {
      // 用户表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          password_hash TEXT,
          user_type TEXT DEFAULT 'free' CHECK (user_type IN ('free', 'vip', 'admin')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 简历表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS resumes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          original_filename TEXT NOT NULL,
          original_path TEXT NOT NULL,
          original_size INTEGER NOT NULL,
          original_mimetype TEXT NOT NULL,
          processed_content TEXT,
          job_description TEXT,
          optimization_result TEXT,
          evaluation TEXT,
          interview_questions TEXT,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // 分析结果表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS analyses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          resume_id INTEGER NOT NULL,
          analysis_type TEXT NOT NULL CHECK (analysis_type IN ('evaluation', 'optimization', 'questions')),
          result_data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (resume_id) REFERENCES resumes (id) ON DELETE CASCADE
        )
      `);

      // 配置表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建索引
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
        CREATE INDEX IF NOT EXISTS idx_resumes_status ON resumes(status);
        CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON resumes(created_at);
        CREATE INDEX IF NOT EXISTS idx_analyses_resume_id ON analyses(resume_id);
        CREATE INDEX IF NOT EXISTS idx_analyses_type ON analyses(analysis_type);
      `);

      logger.info("数据库表创建完成");
    } catch (error) {
      logger.error("创建数据库表失败:", error);
      throw error;
    }
  }

  /**
   * 检查并添加简历表的列（用于迁移版本3）
   * SQLite 不支持 ALTER TABLE ADD COLUMN IF NOT EXISTS
   */
  private addResumeColumnsIfNeeded(): void {
    if (!this.db) {
      throw new Error("数据库未初始化");
    }

    // 获取 resumes 表的列信息
    const columns = this.db
      .prepare("PRAGMA table_info(resumes)")
      .all() as { name: string }[];
    const columnNames = new Set(columns.map((c) => c.name));

    // 要添加的列定义
    const columnsToAdd: { name: string; sql: string }[] = [
      { name: "content_hash", sql: "content_hash TEXT" },
      { name: "person_hash", sql: "person_hash TEXT" },
      { name: "group_id", sql: "group_id INTEGER" },
      { name: "is_primary", sql: "is_primary INTEGER DEFAULT 0" },
      { name: "version_label", sql: "version_label TEXT" },
      { name: "version_notes", sql: "version_notes TEXT" },
      { name: "parsed_info", sql: "parsed_info TEXT" },
    ];

    // 添加不存在的列
    for (const column of columnsToAdd) {
      if (!columnNames.has(column.name)) {
        try {
          this.db.exec(`ALTER TABLE resumes ADD COLUMN ${column.sql}`);
          logger.info(`添加列: resumes.${column.name}`);
        } catch (error) {
          logger.warn(`添加列 resumes.${column.name} 失败:`, error);
        }
      }
    }

    // 创建索引（如果不存在）
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_resume_groups_user_id ON resume_groups(user_id);
      CREATE INDEX IF NOT EXISTS idx_resume_groups_primary_resume_id ON resume_groups(primary_resume_id);
      CREATE INDEX IF NOT EXISTS idx_resumes_content_hash ON resumes(content_hash);
      CREATE INDEX IF NOT EXISTS idx_resumes_person_hash ON resumes(person_hash);
      CREATE INDEX IF NOT EXISTS idx_resumes_group_id ON resumes(group_id);
    `);
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error("数据库未初始化");
    }

    try {
      // 创建迁移表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version INTEGER NOT NULL UNIQUE,
          name TEXT NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 获取已执行的迁移
      const executedMigrations = this.db
        .prepare("SELECT version FROM migrations ORDER BY version")
        .all() as { version: number }[];
      const executedVersions = new Set(
        executedMigrations.map((m) => m.version),
      );

      // 定义迁移
      const migrations = [
        {
          version: 1,
          name: "initial_schema",
          sql: `
            -- 初始架构已在 createTables 中创建
          `,
        },
        {
          version: 2,
          name: "add_user_indexes",
          sql: `
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);
          `,
        },
        {
          version: 3,
          name: "add_deduplication_and_version_fields",
          sql: `
            -- 创建简历组表
            CREATE TABLE IF NOT EXISTS resume_groups (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              group_name TEXT NOT NULL,
              primary_resume_id INTEGER NOT NULL,
              description TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (primary_resume_id) REFERENCES resumes(id) ON DELETE SET NULL,
              UNIQUE(user_id, group_name)
            );

            -- 添加新字段到 resumes 表（SQLite 不支持 ADD COLUMN IF NOT EXISTS，需要先检查列是否存在）
          `,
        },
        {
          version: 4,
          name: "add_llm_provider_support",
          sql: `
            -- LLM 供应商配置表
            CREATE TABLE IF NOT EXISTS llm_providers (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              provider_id TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL,
              type TEXT NOT NULL CHECK (type IN ('openai', 'glm', 'ollama', 'anthropic', 'azure', 'custom')),
              base_url TEXT NOT NULL,
              api_key TEXT,
              models TEXT NOT NULL DEFAULT '[]',
              is_enabled INTEGER DEFAULT 1,
              is_default INTEGER DEFAULT 0,
              parameters TEXT NOT NULL DEFAULT '{}',
              sort_order INTEGER DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- LLM 任务配置表
            CREATE TABLE IF NOT EXISTS llm_task_config (
              task_name TEXT PRIMARY KEY CHECK (task_name IN ('resume_analysis', 'resume_optimization', 'question_generation')),
              provider_id TEXT,
              model TEXT,
              parameters TEXT NOT NULL DEFAULT '{}',
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (provider_id) REFERENCES llm_providers(provider_id) ON DELETE SET NULL
            );

            -- LLM 调用日志表
            CREATE TABLE IF NOT EXISTS llm_call_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              provider_id TEXT,
              model TEXT,
              task_name TEXT,
              request_tokens INTEGER DEFAULT 0,
              response_tokens INTEGER DEFAULT 0,
              status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
              error_message TEXT,
              duration_ms INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- 创建索引
            CREATE INDEX IF NOT EXISTS idx_llm_providers_type ON llm_providers(type);
            CREATE INDEX IF NOT EXISTS idx_llm_providers_enabled ON llm_providers(is_enabled);
            CREATE INDEX IF NOT EXISTS idx_llm_providers_default ON llm_providers(is_default);
            CREATE INDEX IF NOT EXISTS idx_llm_task_config_provider ON llm_task_config(provider_id);
            CREATE INDEX IF NOT EXISTS idx_llm_call_logs_provider ON llm_call_logs(provider_id);
            CREATE INDEX IF NOT EXISTS idx_llm_call_logs_created_at ON llm_call_logs(created_at);
          `,
        },
        {
          version: 5,
          name: "add_ai_hr_assistant_support",
          sql: `
            -- AI HR 助手对话消息表
            CREATE TABLE IF NOT EXISTS ai_conversations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              resume_id INTEGER NOT NULL,
              user_id INTEGER NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
              content TEXT NOT NULL,
              message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'suggestion', 'analysis')),
              metadata TEXT,
              token_count INTEGER DEFAULT 0,
              is_summary INTEGER DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (resume_id) REFERENCES resumes(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            -- 创建索引
            CREATE INDEX IF NOT EXISTS idx_ai_conversations_resume_id ON ai_conversations(resume_id);
            CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
            CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations(created_at);
          `,
        },
      ];

      // 执行未执行的迁移
      for (const migration of migrations) {
        if (!executedVersions.has(migration.version)) {
          logger.info(`执行迁移 v${migration.version}: ${migration.name}`);

          this.db.transaction(() => {
            this.db!.exec(migration.sql);

            // 版本3的特殊处理：添加列到resumes表
            if (migration.version === 3) {
              this.addResumeColumnsIfNeeded();
            }

            this.db!.prepare(
              "INSERT INTO migrations (version, name) VALUES (?, ?)",
            ).run(migration.version, migration.name);
          })();

          logger.info(`迁移 v${migration.version} 执行完成`);
        }
      }
    } catch (error) {
      logger.error("数据库迁移失败:", error);
      throw error;
    }
  }

  /**
   * 初始化默认 LLM 供应商配置
   * 从环境变量读取 GLM 配置，如果数据库为空则自动导入
   */
  private async initDefaultLLMProviders(): Promise<void> {
    try {
      const db = this.getDatabase();

      // 检查是否已有供应商
      const count = (
        db.prepare("SELECT COUNT(*) as count FROM llm_providers").get() as {
          count: number;
        }
      ).count;

      if (count > 0) {
        return; // 已有配置，无需初始化
      }

      // 从环境变量读取 GLM 配置
      const glmApiKey = process.env.GLM_API_KEY;
      const glmApiUrl = process.env.GLM_API_URL || "https://open.bigmodel.cn/api/paas/v4";

      if (glmApiKey) {
        logger.info("从环境变量初始化 GLM 供应商配置");

        const providerId = uuidv4();
        const encryptedApiKey = encrypt(glmApiKey);

        db.prepare(`
          INSERT INTO llm_providers (
            provider_id, name, type, base_url, api_key, models,
            is_enabled, is_default, parameters, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          providerId,
          "GLM (智谱 AI)",
          "glm",
          glmApiUrl,
          encryptedApiKey,
          JSON.stringify(["glm-4", "glm-4-flash", "glm-3-turbo"]),
          1, // is_enabled
          1, // is_default
          JSON.stringify({
            temperature: 0.3,
            max_tokens: 2000,
            timeout_ms: 30000,
          }),
          0, // sort_order
        );

        // 创建任务配置
        const tasks = ["resume_analysis", "resume_optimization", "question_generation"];
        for (const task of tasks) {
          db.prepare(`
            INSERT INTO llm_task_config (task_name, provider_id, model, parameters)
            VALUES (?, ?, ?, ?)
          `).run(
            task,
            providerId,
            "glm-4",
            JSON.stringify({ temperature: 0.3, max_tokens: 2000 }),
          );
        }

        logger.info("默认 LLM 供应商配置初始化完成");
      }
    } catch (error) {
      logger.warn("初始化默认 LLM 配置失败:", error);
      // 不抛出错误，允许应用继续运行
    }
  }

  getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error("数据库未初始化");
    }
    return this.db;
  }

  async close(): Promise<void> {
    if (this.db) {
      try {
        // 等待活跃连接完成
        if (this.connectionCount > 0) {
          logger.info(`等待 ${this.connectionCount} 个活跃连接完成...`);
          // 等待最多5秒让连接完成
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        this.db.close();
        this.db = null;
        this.initPromise = null;
        logger.info("数据库连接已关闭");
      } catch (error) {
        logger.error("关闭数据库连接时出错:", error);
      }
    }
  }

  // 事务支持
  transaction<T>(fn: () => T): T {
    const db = this.getDatabase();
    return db.transaction(fn)();
  }

  // 数据库统计信息
  async getStats(): Promise<{
    totalUsers: number;
    totalResumes: number;
    totalAnalyses: number;
    databaseSize: number;
  }> {
    const db = this.getDatabase();

    const stats = {
      totalUsers: (
        db.prepare("SELECT COUNT(*) as count FROM users").get() as {
          count: number;
        }
      ).count,
      totalResumes: (
        db.prepare("SELECT COUNT(*) as count FROM resumes").get() as {
          count: number;
        }
      ).count,
      totalAnalyses: (
        db.prepare("SELECT COUNT(*) as count FROM analyses").get() as {
          count: number;
        }
      ).count,
      databaseSize: 0,
    };

    // 获取数据库文件大小
    try {
      const fileStats = fs.statSync(this.dbPath);
      stats.databaseSize = fileStats.size;
    } catch (error) {
      logger.warn("获取数据库文件大小失败:", error);
    }

    return stats;
  }

  // 数据库优化
  async optimize(): Promise<void> {
    const db = this.getDatabase();

    try {
      // 分析表统计信息
      db.exec("ANALYZE");

      // 清理碎片
      db.exec("VACUUM");

      logger.info("数据库优化完成");
    } catch (error) {
      logger.error("数据库优化失败:", error);
      throw error;
    }
  }

  // 备份数据库
  async backup(backupPath: string): Promise<void> {
    const db = this.getDatabase();

    try {
      // better-sqlite3 的 backup 方法返回同步的 Backup 对象
      const backupObj = (db as any).backup(backupPath);
      backupObj.step(-1); // 复制所有页面
      backupObj.finish();

      logger.info(`数据库备份完成: ${backupPath}`);
    } catch (error) {
      logger.error("数据库备份失败:", error);
      throw error;
    }
  }

  // 检查数据库完整性
  async checkIntegrity(): Promise<boolean> {
    const db = this.getDatabase();

    try {
      const result = db.prepare("PRAGMA integrity_check").get() as {
        integrity_check: string;
      };
      return result.integrity_check === "ok";
    } catch (error) {
      logger.error("数据库完整性检查失败:", error);
      return false;
    }
  }

  // ============ 用户相关方法 ============

  async getUserByEmail(email: string): Promise<any> {
    const db = this.getDatabase();
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  }

  async getUserById(id: number): Promise<any> {
    const db = this.getDatabase();
    return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  }

  async createUser(userData: {
    email: string;
    password: string;
    name: string;
    userType: string;
  }): Promise<number> {
    const db = this.getDatabase();
    const result = db
      .prepare(
        "INSERT INTO users (email, password_hash, name, user_type) VALUES (?, ?, ?, ?)",
      )
      .run(userData.email, userData.password, userData.name, userData.userType);
    return result.lastInsertRowid as number;
  }

  async updateUser(
    id: number,
    updates: Partial<{ name: string; password: string }>,
  ): Promise<void> {
    const db = this.getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.password !== undefined) {
      fields.push("password_hash = ?");
      values.push(updates.password);
    }

    if (fields.length > 0) {
      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(id);
      db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(
        ...values,
      );
    }
  }

  async getUserStats(userId: number): Promise<any> {
    const db = this.getDatabase();

    const resumeCount = (
      db
        .prepare("SELECT COUNT(*) as count FROM resumes WHERE user_id = ?")
        .get(userId) as { count: number }
    ).count;
    const completedCount = (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM resumes WHERE user_id = ? AND status = ?",
        )
        .get(userId, "completed") as { count: number }
    ).count;

    return {
      totalResumes: resumeCount,
      completedResumes: completedCount,
      processingResumes: resumeCount - completedCount,
    };
  }

  // ============ 简历相关方法 ============

  async createResume(resumeData: {
    userId: number;
    originalFilename: string;
    originalPath: string;
    originalSize: number;
    originalMimetype: string;
    jobDescription?: string;
    status: string;
  }): Promise<number> {
    const db = this.getDatabase();
    const result = db
      .prepare(
        `
      INSERT INTO resumes (user_id, original_filename, original_path, original_size, original_mimetype, job_description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        resumeData.userId,
        resumeData.originalFilename,
        resumeData.originalPath,
        resumeData.originalSize,
        resumeData.originalMimetype,
        resumeData.jobDescription || null,
        resumeData.status,
      );
    return result.lastInsertRowid as number;
  }

  async createResumeWithDedup(resumeData: {
    userId: number;
    originalFilename: string;
    originalPath: string;
    originalSize: number;
    originalMimetype: string;
    jobDescription?: string;
    status: string;
    contentHash?: string;
    personHash?: string | null;
    groupId?: number | null;
    isPrimary?: number;
    versionLabel?: string | null;
    versionNotes?: string | null;
  }): Promise<number> {
    const db = this.getDatabase();
    const result = db
      .prepare(
        `
      INSERT INTO resumes (
        user_id, original_filename, original_path, original_size, original_mimetype,
        job_description, status, content_hash, person_hash, group_id, is_primary,
        version_label, version_notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        resumeData.userId,
        resumeData.originalFilename,
        resumeData.originalPath,
        resumeData.originalSize,
        resumeData.originalMimetype,
        resumeData.jobDescription || null,
        resumeData.status,
        resumeData.contentHash || null,
        resumeData.personHash || null,
        resumeData.groupId || null,
        resumeData.isPrimary ?? 1,
        resumeData.versionLabel || null,
        resumeData.versionNotes || null,
      );
    return result.lastInsertRowid as number;
  }

  async getResumeById(id: number): Promise<any> {
    const db = this.getDatabase();
    return db.prepare("SELECT * FROM resumes WHERE id = ?").get(id);
  }

  async getResumesByUserId(
    userId: number,
    page: number = 1,
    limit: number = 10,
  ): Promise<any[]> {
    const db = this.getDatabase();
    const offset = (page - 1) * limit;
    return db
      .prepare(
        `
      SELECT * FROM resumes
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
      )
      .all(userId, limit, offset);
  }

  async getResumeCount(userId: number): Promise<number> {
    const db = this.getDatabase();
    const result = db
      .prepare("SELECT COUNT(*) as count FROM resumes WHERE user_id = ?")
      .get(userId) as { count: number };
    return result.count;
  }

  async updateResumeStatus(id: number, status: string): Promise<void> {
    const db = this.getDatabase();
    db.prepare(
      "UPDATE resumes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(status, id);
  }

  async updateResumeAnalysis(
    id: number,
    data: {
      processedContent?: string;
      evaluation?: any;
    },
  ): Promise<void> {
    const db = this.getDatabase();

    if (data.evaluation) {
      db.prepare(
        `
        UPDATE resumes
        SET processed_content = ?,
            evaluation = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      ).run(
        data.processedContent || null,
        JSON.stringify(data.evaluation),
        "completed",
        id,
      );
    } else {
      db.prepare(
        `
        UPDATE resumes
        SET processed_content = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      ).run(data.processedContent || null, id);
    }
  }

  async updateResumeInterviewQuestions(
    id: number,
    questions: any[],
  ): Promise<void> {
    const db = this.getDatabase();
    db.prepare(
      `
      UPDATE resumes
      SET interview_questions = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    ).run(JSON.stringify(questions), id);
  }

  async deleteResume(id: number): Promise<void> {
    const db = this.getDatabase();
    db.prepare("DELETE FROM resumes WHERE id = ?").run(id);
  }

  // ============ LLM 供应商相关方法 ============

  /**
   * 创建 LLM 供应商
   */
  async createLLMProvider(
    data: LLMProviderCreateRequest,
  ): Promise<LLMProvider> {
    const db = this.getDatabase();
    const providerId = uuidv4();

    // 加密 API Key
    const encryptedApiKey = data.api_key ? encrypt(data.api_key) : null;

    // 如果设置为默认，先取消其他默认设置
    if (data.is_default) {
      db.prepare("UPDATE llm_providers SET is_default = 0").run();
    }

    // 获取当前最大排序序号
    const maxSortOrder = (
      db.prepare("SELECT MAX(sort_order) as max_sort FROM llm_providers").get() as {
        max_sort: number | null;
      }
    ).max_sort || 0;

    db.prepare(`
      INSERT INTO llm_providers (
        provider_id, name, type, base_url, api_key, models,
        is_enabled, is_default, parameters, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      providerId,
      data.name,
      data.type,
      data.base_url,
      encryptedApiKey,
      JSON.stringify(data.models || []),
      data.is_enabled !== undefined ? (data.is_enabled ? 1 : 0) : 1,
      data.is_default !== undefined ? (data.is_default ? 1 : 0) : 0,
      JSON.stringify(data.parameters || {}),
      maxSortOrder + 1,
    );

    return (await this.getLLMProvider(providerId))!;
  }

  /**
   * 获取 LLM 供应商（返回脱敏的 API Key）
   */
  async getLLMProvider(providerId: string): Promise<LLMProvider | null> {
    const db = this.getDatabase();
    const row = db
      .prepare("SELECT * FROM llm_providers WHERE provider_id = ?")
      .get(providerId) as any;

    if (!row) {
      return null;
    }

    return this.rowToLLMProvider(row);
  }

  /**
   * 获取 LLM 供应商完整配置（包含解密的 API Key）
   */
  async getLLMProviderFull(providerId: string): Promise<any | null> {
    const db = this.getDatabase();
    const row = db
      .prepare("SELECT * FROM llm_providers WHERE provider_id = ?")
      .get(providerId) as any;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      provider_id: row.provider_id,
      name: row.name,
      type: row.type,
      base_url: row.base_url,
      api_key: row.api_key ? decrypt(row.api_key) : undefined,
      models: JSON.parse(row.models || "[]"),
      is_enabled: row.is_enabled === 1,
      is_default: row.is_default === 1,
      parameters: JSON.parse(row.parameters || "{}"),
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * 列出所有 LLM 供应商
   */
  async listLLMProviders(): Promise<LLMProvider[]> {
    const db = this.getDatabase();
    const rows = db
      .prepare("SELECT * FROM llm_providers ORDER BY sort_order ASC")
      .all() as any[];

    return rows.map((row) => this.rowToLLMProvider(row));
  }

  /**
   * 更新 LLM 供应商
   */
  async updateLLMProvider(
    providerId: string,
    data: LLMProviderUpdateRequest,
  ): Promise<LLMProvider | null> {
    const db = this.getDatabase();

    // 检查供应商是否存在
    const existing = await this.getLLMProviderFull(providerId);
    if (!existing) {
      return null;
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push("name = ?");
      values.push(data.name);
    }
    if (data.type !== undefined) {
      fields.push("type = ?");
      values.push(data.type);
    }
    if (data.base_url !== undefined) {
      fields.push("base_url = ?");
      values.push(data.base_url);
    }
    if (data.api_key !== undefined) {
      fields.push("api_key = ?");
      values.push(encrypt(data.api_key));
    }
    if (data.models !== undefined) {
      fields.push("models = ?");
      values.push(JSON.stringify(data.models));
    }
    if (data.is_enabled !== undefined) {
      fields.push("is_enabled = ?");
      values.push(data.is_enabled ? 1 : 0);
    }
    if (data.is_default !== undefined) {
      // 如果设置为默认，先取消其他默认设置
      if (data.is_default) {
        db.prepare("UPDATE llm_providers SET is_default = 0").run();
      }
      fields.push("is_default = ?");
      values.push(data.is_default ? 1 : 0);
    }
    if (data.parameters !== undefined) {
      fields.push("parameters = ?");
      values.push(JSON.stringify(data.parameters));
    }

    if (fields.length > 0) {
      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(providerId);
      db.prepare(
        `UPDATE llm_providers SET ${fields.join(", ")} WHERE provider_id = ?`,
      ).run(...values);
    }

    return (await this.getLLMProvider(providerId))!;
  }

  /**
   * 删除 LLM 供应商
   */
  async deleteLLMProvider(providerId: string): Promise<void> {
    const db = this.getDatabase();
    db.prepare("DELETE FROM llm_providers WHERE provider_id = ?").run(providerId);
  }

  /**
   * 设置默认 LLM 供应商
   */
  async setDefaultLLMProvider(providerId: string): Promise<void> {
    const db = this.getDatabase();

    // 先取消所有默认设置
    db.prepare("UPDATE llm_providers SET is_default = 0").run();

    // 设置新的默认供应商
    db
      .prepare("UPDATE llm_providers SET is_default = 1 WHERE provider_id = ?")
      .run(providerId);
  }

  /**
   * 获取默认 LLM 供应商
   */
  async getDefaultLLMProvider(): Promise<LLMProvider | null> {
    const db = this.getDatabase();
    const row = db
      .prepare("SELECT * FROM llm_providers WHERE is_default = 1 LIMIT 1")
      .get() as any;

    if (!row) {
      // 如果没有默认供应商，返回第一个启用的供应商
      const firstRow = db
        .prepare(
          "SELECT * FROM llm_providers WHERE is_enabled = 1 ORDER BY sort_order ASC LIMIT 1",
        )
        .get() as any;

      if (!firstRow) {
        return null;
      }
      return this.rowToLLMProvider(firstRow);
    }

    return this.rowToLLMProvider(row);
  }

  /**
   * 获取默认 LLM 供应商完整配置（包含解密的 API Key）
   */
  async getDefaultLLMProviderFull(): Promise<any | null> {
    const db = this.getDatabase();
    const row = db
      .prepare("SELECT * FROM llm_providers WHERE is_default = 1 LIMIT 1")
      .get() as any;

    if (!row) {
      // 如果没有默认供应商，返回第一个启用的供应商
      const firstRow = db
        .prepare(
          "SELECT * FROM llm_providers WHERE is_enabled = 1 ORDER BY sort_order ASC LIMIT 1",
        )
        .get() as any;

      if (!firstRow) {
        return null;
      }

      return {
        id: firstRow.id,
        provider_id: firstRow.provider_id,
        name: firstRow.name,
        type: firstRow.type,
        base_url: firstRow.base_url,
        api_key: firstRow.api_key ? decrypt(firstRow.api_key) : undefined,
        models: JSON.parse(firstRow.models || "[]"),
        is_enabled: firstRow.is_enabled === 1,
        is_default: firstRow.is_default === 1,
        parameters: JSON.parse(firstRow.parameters || "{}"),
        sort_order: firstRow.sort_order,
        created_at: firstRow.created_at,
        updated_at: firstRow.updated_at,
      };
    }

    return {
      id: row.id,
      provider_id: row.provider_id,
      name: row.name,
      type: row.type,
      base_url: row.base_url,
      api_key: row.api_key ? decrypt(row.api_key) : undefined,
      models: JSON.parse(row.models || "[]"),
      is_enabled: row.is_enabled === 1,
      is_default: row.is_default === 1,
      parameters: JSON.parse(row.parameters || "{}"),
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * 将数据库行转换为 LLMProvider 对象（API Key 脱敏）
   */
  private rowToLLMProvider(row: any): LLMProvider {
    return {
      id: row.id,
      provider_id: row.provider_id,
      name: row.name,
      type: row.type,
      base_url: row.base_url,
      api_key: row.api_key ? maskApiKey(row.api_key) : undefined,
      models: JSON.parse(row.models || "[]"),
      is_enabled: row.is_enabled === 1,
      is_default: row.is_default === 1,
      parameters: JSON.parse(row.parameters || "{}"),
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ============ LLM 任务配置相关方法 ============

  /**
   * 获取任务配置
   */
  async getLLMTaskConfig(taskName: string): Promise<LLMTaskConfig | null> {
    const db = this.getDatabase();
    const row = db
      .prepare("SELECT * FROM llm_task_config WHERE task_name = ?")
      .get(taskName) as any;

    if (!row) {
      return null;
    }

    return {
      task_name: row.task_name,
      provider_id: row.provider_id,
      model: row.model,
      parameters: JSON.parse(row.parameters || "{}"),
    };
  }

  /**
   * 更新任务配置
   */
  async updateLLMTaskConfig(config: LLMTaskConfig): Promise<void> {
    const db = this.getDatabase();

    db.prepare(`
      INSERT INTO llm_task_config (task_name, provider_id, model, parameters)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(task_name) DO UPDATE SET
        provider_id = excluded.provider_id,
        model = excluded.model,
        parameters = excluded.parameters,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      config.task_name,
      config.provider_id || null,
      config.model || null,
      JSON.stringify(config.parameters),
    );
  }

  /**
   * 列出所有任务配置
   */
  async listLLMTaskConfigs(): Promise<LLMTaskConfig[]> {
    const db = this.getDatabase();
    const rows = db
      .prepare("SELECT * FROM llm_task_config ORDER BY task_name ASC")
      .all() as any[];

    return rows.map((row) => ({
      task_name: row.task_name,
      provider_id: row.provider_id,
      model: row.model,
      parameters: JSON.parse(row.parameters || "{}"),
    }));
  }

  // ============ LLM 调用日志相关方法 ============

  /**
   * 记录 LLM 调用日志
   */
  async logLLMCall(data: {
    provider_id: string;
    model: string;
    task_name?: string;
    request_tokens?: number;
    response_tokens?: number;
    status: "success" | "failed";
    error_message?: string;
    duration_ms?: number;
  }): Promise<void> {
    const db = this.getDatabase();

    db.prepare(`
      INSERT INTO llm_call_logs (
        provider_id, model, task_name, request_tokens, response_tokens,
        status, error_message, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.provider_id,
      data.model,
      data.task_name || null,
      data.request_tokens || 0,
      data.response_tokens || 0,
      data.status,
      data.error_message || null,
      data.duration_ms || null,
    );
  }

  /**
   * 清理旧的调用日志
   */
  async cleanupLLMCallLogs(daysToKeep: number = 30): Promise<number> {
    const db = this.getDatabase();

    const result = db.prepare(`
      DELETE FROM llm_call_logs
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `).run(daysToKeep);

    return result.changes;
  }
}

// 导出单例实例
export const database = new DatabaseService();
