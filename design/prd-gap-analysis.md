# PRD 与当前实现差距分析报告

## 产品定位对比

| 维度 | PRD 要求 | 当前实现 | 状态 |
|-----|---------|---------|------|
| **产品名称** | 简历透视镜 (ResumeLens) | HRCopilot | 🔄 定位差异 |
| **目标用户** | 猎头、HR | 个人求职者为主 | ⚠️ 需调整 |
| **核心价值** | 结构化分析、判断显性化 | 简历优化、匹配度评估 | 🔄 部分重叠 |

---

## 核心功能模块差距分析

### 1. JD 拆解模块

#### PRD 要求输出结构：
```json
{
  "硬性要求": { "学历", "经验", "技能" },
  "隐性需求": { "管理经验", "风格", "潜力" },
  "潜在冲突": ["薪资倒挂", "汇报对象问题"],
  "用人风险": ["招聘难度高", "创业公司优先"]
}
```

#### 当前数据库字段 (`sqlite.ts:354-373`)：
```sql
jds (
  jd_id, user_id, title, department, seniority, location,
  salary_min, salary_max, description, requirements,
  responsibilities, skills, status, resume_count
)
```

#### 差距分析：

| 功能 | PRD 要求 | 当前实现 | 差距 |
|-----|----------|---------|:----:|
| **显性需求** | 学历、经验、技能 | requirements, skills | ✅ 基本满足 |
| **隐性需求** | 管理经验、风格、潜力 | ❌ 无 | ❌ 缺失 |
| **潜在冲突** | 自相矛盾要求预警 | ❌ 无 | ❌ 缺失 |
| **用人风险** | 招聘难度、背景偏好 | ❌ 无 | ❌ 缺失 |

**建议数据库扩展**：
```sql
ALTER TABLE jds ADD COLUMN implicit_requirements TEXT;  -- 隐性需求 (JSON)
ALTER TABLE jds ADD COLUMN potential_conflicts TEXT;     -- 潜在冲突 (JSON)
ALTER TABLE jds ADD COLUMN hiring_risks TEXT;           -- 用人风险 (JSON)
```

---

### 2. 简历解析模块

#### PRD 要求输出结构：
```json
{
  "基础信息": { "姓名", "工作年限", "当前职级" },
  "成长轨迹": {
    "职级跃迁": [{"时间", "公司", "职级"}],
    "稳定性评分": "7/10",
    "空窗期": ["2020.03-2020.07 4个月"]
  },
  "能力图谱": { "硬技能", "软技能", "行业经验" },
  "决策风格": { "类型", "特征" },
  "风险信号": ["最近跳槽仅1年", "空窗期4个月"]
}
```

#### 当前数据库字段：
- `parsed_info` 字段存在，但结构化程度未知
- 无专门的成长轨迹、决策风格、风险信号字段

#### 差距分析：

| 功能 | PRD 要求 | 当前实现 | 差距 |
|-----|----------|---------|:----:|
| **基础信息** | 姓名、工作年限、职级 | 依赖 parsed_info | ⚠️ 需确认 |
| **成长轨迹** | 职级跃迁时间线 | ❌ 无独立字段 | ⚠️ 可能缺失 |
| **稳定性评分** | 可量化评分 | ❌ 无 | ❌ 缺失 |
| **空窗期追踪** | 空窗时间段列表 | ❌ 无 | ❌ 缺失 |
| **能力图谱** | 硬/软技能、行业 | 依赖 parsed_info | ⚠️ 需确认 |
| **决策风格** | 稳定型/冒险型 | ❌ 无 | ❌ 缺失 |
| **风险信号** | 主动识别风险 | ❌ 无 | ❌ 缺失 |

**建议数据库扩展**：
```sql
ALTER TABLE resumes ADD COLUMN career_trajectory TEXT;     -- 职级跃迁 (JSON)
ALTER TABLE resumes ADD COLUMN stability_score INTEGER;     -- 稳定性评分 1-10
ALTER TABLE resumes ADD COLUMN gap_periods TEXT;           -- 空窗期 (JSON)
ALTER TABLE resumes ADD COLUMN decision_style TEXT;         -- 决策风格 (JSON)
ALTER TABLE resumes ADD COLUMN risk_signals TEXT;           -- 风险信号 (JSON)
```

---

### 3. 匹配对齐模块

#### PRD 要求输出结构：
```json
{
  "匹配度": {
    "综合评分[表情] "82/100",
    "硬性匹配": "90%",
    "隐性匹配": "75%"
  },
  "结论": {
    "标签": "推荐",
    "置信度": "高",
    "理由": "技术深度匹配度高，管理经验略弱"
  },
  "优势": ["Go + 微服务经验匹配", "有从0到1架构经验"],
  "风险": ["团队管理经验仅3年", "最近跳槽周期短"],
  "追问引导": ["为何离开上一家公司？", "对管理岗位的兴趣程度？"]
}
```

#### 当前数据库字段 (`sqlite.ts:376-384`)：
```sql
resume_jd_matches (
  resume_id, jd_id, match_score,
  skill_match_score, experience_match_score, education_match_score,
  overall_assessment, strengths, weaknesses, recommendation, rank
)
```

#### 差距分析：

| 功能 | PRD 要求 | 当前实现 | 差距 |
|-----|----------|---------|:----:|
| **综合评分** | 0-100 评分 | match_score | ✅ 满足 |
| **硬性匹配** | 可量化评分 | skill/experience/education | ✅ 部分满足 |
| **隐性匹配** | 可量化评分 | ❌ 无 | ❌ 缺失 |
| **标签** | 推荐/谨慎/高风险 | recommendation | ✅ 满足 |
| **置信度** | 高/中/低 | ❌ 无 | ❌ 缺失 |
| **理由** | 匹配原因说明 | overall_assessment | ✅ 满足 |
| **优势** | 优势列表 | strengths | ✅ 满足 |
| **风险** | 风险列表 | weaknesses | ✅ 满足 |
| **追问引导** | 帮助深度对谈的问题 | ❌ 无 | ❌ 缺失 |

**建议数据库扩展**：
```sql
ALTER TABLE resume_jd_matches ADD COLUMN implicit_match_score INTEGER;  -- 隐性匹配评分
ALTER TABLE resume_jd_matches ADD COLUMN confidence_level TEXT;         -- 置信度
ALTER TABLE resume_jd_matches ADD COLUMN follow_up_questions TEXT;        -- 追问引导 (JSON)
```

#### ⚠️ 关键问题：
`jdHandler.ts:174` 处的匹配分析使用模拟数据：
```typescript
// TODO: 调用 AI 服务进行匹配分析
// 这里先使用模拟数据
const matchScore = Math.floor(Math.random() * 40) + 60;
```

---

## 功能优先级对比

| 优先级 | 功能 | PRD MVP | 当前实现 | 差距 |
|--------|------|---------|---------|------|
| **P0** | JD 拆解 | ✅ | 基础实现 | ⚠️ 缺隐性需求分析 |
| **P0** | 简历解析 | ✅ | 基础实现 | ⚠️ 缺决策风格、风险信号 |
| **P0** | 匹配对齐 | ✅ | 数据结构完整 | ❌ 使用模拟数据 |
| **P1** | JD 库管理 | ✅ | ✅ 完整 | ✅ |
| **P1** | 分析历史 | ✅ | ✅ 完整 | ✅ |
| **P2** | 团队协作 | ❌ | ❌ | ✅ |
| **P2** | API 开放 | ❌ | ❌ | ✅ |

---

## 前端服务差距分析

### `jdIpcService.ts:117-121`

```typescript
async getMatchesByResume(resumeId: number): Promise<ResumeJDMatch[]> {
  // 调用数据库方法，但需要通过后端添加对应的 IPC 通道
  // 暂时返回空数组
  return [];
}
```

**问题**：数据库层 `getMatchesByResume()` 已实现，但 IPC 层未连接。

---

## 总结与建议

### 🔴 P0 - 阻塞性问题（必须立即解决）

1. **JD 拆解 AI 集成**
   - 当前：使用模拟数据
   - 需求：实现真实的 AI 拆解，识别隐性需求、潜在冲突、用人风险

2. **简历-JD 匹配 AI 集成**
   - 当前：`jdHandler.ts:176` 随机生成评分
   - 需求：基于 JD 和简历的真实 AI 匹配分析

3. **简历解析增强**
   - 当前：基础信息提取
   - 需求：增加成长轨迹、决策风格、风险信号识别

### 🟡 P1 - 功能增强（短期内完成）

4.**数据库字段扩展**
   ```sql
   -- jds 表
   ALTER TABLE jds ADD COLUMN implicit_requirements TEXT;
   ALTER TABLE jds ADD COLUMN potential_conflicts TEXT;
   ALTER TABLE jds ADD COLUMN hiring_risks TEXT;

   -- resumes 表
   ALTER TABLE resumes ADD COLUMN career_trajectory TEXT;
   ALTER TABLE resumes ADD COLUMN stability_score INTEGER;
   ALTER TABLE resumes ADD COLUMN gap_periods TEXT;
   ALTER TABLE resumes ADD COLUMN decision_style TEXT;
   ALTER TABLE resumes ADD COLUMN risk_signals TEXT;

   -- resume_jd_matches 表
   ALTER TABLE resume_jd_matches ADD COLUMN implicit_match_score INTEGER;
   ALTER TABLE resume_jd_matches ADD COLUMN confidence_level TEXT;
   ALTER TABLE resume_jd_matches ADD COLUMN follow_up_questions TEXT;
   ```

5. **IPC 通道补全**
   - `jdIpcService.getMatchesByResume()` 需要连接后端 Handler

6. **Prompt 工程优化**
   - JD 拆解 Prompt
   - 简历解析 Prompt（含决策风格识别）
   - 匹配分析 Prompt（含追问引导生成）

### 🟢 P2 - 产品化增强（中期规划）

7. **批量匹配功能**
   - 一次选择多个简历匹配同一 JD
   - 自动排序展示

8. **匹配报告导出**
   - PDF/Word 格式
   - 包含完整的匹配分析报告

9. **人才库管理**
   - 类似 PRD 中的 JD 库概念
   - 简历收藏、标签、备注

10. **追踪与改进**
    - 用户反馈收集
    - 匹配准确度统计

---

## 实施路线图

### 第一阶段：核心 AI 功能集成 (1-2周)

```yaml
任务列表:
  - 实现 JD 拆解 AI 服务
  - 实现简历-JD[表情]匹配 AI 服务
  - 增强简历解析（决策风格、风险信号）
  - 移除 jdHandler.ts 的模拟数据
```

### 第二阶段：数据结构完善 (1周)

```yaml
任务列表:
  - 数据库迁移（添加新字段）
  - 更新类型定义
  - 修改前后端适配代码
```

### 第三阶段：IPC 服务补全 (3-5天)

```yaml
任务列表:
  - 完成 jdIpcService.getMatchesByResume()
  - 添加新 IPC 通道（如 jd:analyze-implicit）
  - 测试所有 IPC 通道
```

### 第四阶段：前端展示优化 (1-2周)

```yaml
任务列表:
  - JD 详情页显示隐性需求、风险提示
  - 简历详情页显示决策风格、风险信号
  - 匹配报告页显示追问引导、置信度
 [表情]添加批量匹配功能
```

---

## 预期成果

完成上述增强后，HRCopilot 将更贴合 PRD 的"简历透视镜"定位：

| 维度 | 改进前 | 改进后 |
|-----|-------|-------|
| **分析深度** | 关键词匹配 | 语义级推理[表情]|
| **判断显性化** | 部分可见 | 全程透明 |
| **效率** | 可用 | 高效（批量）|
| **目标用户契合度** | 个人求职者 | 猎头/HR |

---

*生成时间: 2026-02-23*
*参考文档: design/prd-comment-v1.md*
