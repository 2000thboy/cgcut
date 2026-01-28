# Draft: Storyboard Skill as QA Owner

## Requirements (confirmed)
- 设立“分镜师 skill/agent”作为验收标准负责人，明确职责、输入输出与判定规则。
- 重新规划项目整体路线，结合现有 MVP 设计原则与验收标准。

## Technical Decisions
- 待定：分镜师 skill 的具体形态（前端校验、后端脚本、自动化验收流程）。

## Research Findings
- 设计原则与验收标准：`.qoder/repowiki/zh/content/项目概述/设计原则与验收标准.md` 已列出 MVP 必须满足的功能与禁止项（单轨时间轴、无音频/特效、多轨禁止）。
- 目标用户含分镜师角色：`.qoder/repowiki/zh/content/项目概述/项目介绍.md` 说明分镜师负责拆解剧本、验证镜头数量与时长。
- MVP 验收标准已在项目概述中列出：加载示例剧本、占位 Clip、单轨拖拽/删除/裁剪、替换后时长同步、刻度显示、支持服务器素材加载。
- 现有草稿：`.sisyphus/drafts/retrieval-improvement.md` 关注素材召回/向量搜索、阈值与前端虚拟化；其中新增问题提到需要“分镜 agent/skill 作为验收标准人”。
- 项目深度设计文档：`.qoder/quests/director-storyboard-validation-mvp.md` 定义能力边界（禁止多轨、音频、特效、语义搜索/向量数据库等），给出 MVP 验收条目 AC-1..AC-7、30 分钟验证流程、性能指标、测试清单。
- 外部最佳实践（librarian 调研）：分镜/shot list QA 要求包含：
  - 视觉质量：构图、角色/道具位置、光照连续性、色彩一致、技术注记（镜头/焦点/景深）。
  - 时长与节奏：动作时长、节奏/缓冲、转场时间；覆盖公式：setup+action+buffer。
  - 机位/镜头：景别、机位、运动、镜头焦段、对焦点；覆盖/安全角度与可行性。
  - 连贯性：妆造/道具/光线/地理与情感连贯；切换逻辑与过场。
  - 注释/文档：场次号、镜头编号、音效/音乐提示、设备需求、特效/安全说明、版本号与变更记录。
  - 交付物：给剪辑/摄影/美术/声音/VFX 的具体包；日拍对账、排期对齐、call sheet 引用。
  - 审阅流程：部门→导演/制片→客户三级审核；指标：完整性/清晰度/可行性/一致性/安全。

## Open Questions
- skill 形态：是人机协作流程（人工确认）、自动脚本校验，还是基于 LLM 的审阅 agent？
- 验收维度：仅检查分镜数量/时长/情绪标签，还是包含镜头景别、连贯性、节奏偏差、素材匹配度？
- 输出形式：通过报告（JSON/Markdown）、UI 面板提示，还是测试脚本断言？
- 挂载位置：前端运行（浏览器校验）、后端服务（FastAPI 任务）、独立脚本（tests/*）、或 CI 流水线。
- 数据来源：使用现有 DataModel/store 状态与 knowledge/cinematography-basics.md，是否需要新建验收配置或基准数据集？
- 测试策略：沿用现有 node 测试脚本（tests/*.js）还是新增针对分镜验收的测试文件？

## Scope Boundaries
- INCLUDE: 分镜师 skill 定义与验收流程设计；将其纳入整体项目规划；与现有 MVP 验收标准对齐。
- EXCLUDE: 实际实现代码与具体素材/模型训练；音频、多轨、特效等已禁用功能。
