# 素材召回与验收体系改进工作计划

## Context

### Original Request
- 已完成一次 scan，但需重新扫描验证标签体系；推荐存储规模；分镜验收需求：抓取/生成知识库，在前端设置触发与一键测试按钮，可从 CLI 运行并在前端查看结果；独立部署且可升级。

### Interview Summary
- 现状：Qdrant 默认 http://127.0.0.1:6333, collection `video_assets`；score_threshold = 前端阈值/100，返回前乘 logit_scale≈100；MMR λ=0.7，过采样 3x；clip_results.json 作为 JSON 回退；/clip/scan 分片但不持久化；/clip/save-results 写 JSON。
- 前端：searchService 有 tags/semantic/hybrid；AssetManagerModal/ShotLibrary 无虚拟化且未暴露向量入口，相似度/标签不展示；display limit 500+ 易卡。
- 知识源：`knowledge/*.md`，`.qoder/repowiki` 设计与验收文档；无现成“验收 agent”。
- 测试：Vitest (jsdom) 已配置，Playwright 依赖存在但未见配置文件；tests/ 有 JS E2E 脚本与截图目录。

### Assumptions (defaults applied)
- 存储：Qdrant 为主索引+payload，`clip_results.json` 仅回退；不新增 SQLite/duckdb。
- 重扫：默认增量重扫并同步 Qdrant 与 clip_results.json；若标签体系重构则全量重扫并重建 collection。
- 验收 agent：独立服务（可与 clip-service 并行部署），输入“分镜+素材匹配结果+指标配置”，输出“通过/不通过+理由+指标分数”；支持 CLI 触发与前端按钮；知识库可热更新（挂载 repo 文档/knowledge/*.md 及 repowiki 摘要）。

### References
- 后端检索与阈值缩放：`clip-service/clip_server.py`（/clip/search, /clip/scan, MMR, logit_scale）、`clip-service/qdrant_search.py`（collection、过采样、score_threshold 除以 100）。
- 前端检索：`src/services/searchService.ts`（tags/semantic/hybrid）、`src/services/clipService.ts`（scan/process/search API 调用）。
- 知识库：`knowledge/cinematography-basics.md`, `knowledge/asset-classification.md`; 设计/验收：`.qoder/repowiki/zh/content/项目概述/设计原则与验收标准.md` 等。
- 测试脚本：`tests/frontend-flow-test.js`, `tests/full-e2e-test.js`, `tests/mvp-api-test.js`；Vitest 配置 `vitest.config.ts`。

### Metis Review
- （Metis 尝试失败后，Momus 复审要求补充的关键缺口已在下文落实：鉴权链路、增量/全量重扫机制、阈值统一定义、验收 agent 契约与前端落点、测试命令与依赖。）

## Work Objectives
- 提升素材召回质量：统一阈值缩放、暴露向量搜索、展示多候选与标签/相似度。
- 支撑 5k-100k 规模：给出 Qdrant 参数/容量预估与备份策略。
- 搭建分镜验收 agent：可独立部署、CLI/前端可触发、基于知识库判定通过/不通过并给出理由。
- 改善性能与体验：前端虚拟化/分页，避免大列表卡顿。
- 验证与可升级：完善 Vitest/Playwright 烟测，定义升级与回退流程。

### Fixed Decisions (per Momus feedback)
- 鉴权：所有前端/CLI/测试调用 clip-service 必须带 `Authorization: Bearer $CLIP_SERVICE_API_KEY`；在 `src/services/clipService.ts` 统一添加 header；测试与 CLI 通过环境变量注入；如本地禁用鉴权需在 .env 或启动参数中显式关闭。
  - 本地禁用开关需新增：`CLIP_AUTH_DISABLED=1` 时 clip-service 跳过 HTTPBearer 校验（仅本地开发使用），默认关闭。
- 阈值/分数域：输入阈值统一为“放大百分值 0-100”，后端 Qdrant 阈值 = 输入/100；输出相似度统一展示为“放大后”值（Qdrant 原始分数×100，或 JSON 路径同一 scale=100）。模型 logit_scale 仅用于内部缩放，前端展示固定按 100 维度。
- 增量/全量重扫机制：增量以 filePath + mtime（必要时 hash）比对；point_id 采用稳定 `sha1(filePath)`（或显式字段）避免数组下标错位；全量需 drop/recreate collection 后重新 upsert；`clip_results.json` 与 Qdrant 以 point_id 对齐同步。
  - 对分片：point_id = sha1(`${filePath}#${segment.index}`) 确保唯一；scan 结果需包含 mtime/hash/segmentIndex 写入 JSON 与 payload。
- 验收 agent 技术栈/契约：选 FastAPI（Python）单体；HTTP `POST /accept/review` + CLI 同路由；请求/响应 JSON schema 固定（见任务 7）；规则/KB 使用本地文件挂载，支持 reload。
- 测试命令：继续用 Vitest；新增 Playwright（需添加 playwright.config.ts、npm script `test:pw`）；保留 JS E2E 脚本但要求用 env 注入 API key、禁止硬编码密钥。
- 迁移声明：现有 `clip-service/sync_qdrant.py` 以数组下标为 point_id、`clip-service/verify_tags.py` 无鉴权且阈值语义为 0-1；计划要求重写/修复这些文件并标注兼容策略。
  - point_id 规范：统一使用 POSIX 形式的绝对路径（盘符转小写、反斜杠转 `/`），分片时附加 `#seg${index}`，再做 `sha1(canonical_path)`。
  - 迁移策略：首个发布必须执行 FULL_RESCAN 到新 collection `video_assets_v2`（sha1 id 规范），验证通过后将前端/服务 env 的 COLLECTION_NAME 切换到新 collection；如需回滚，切回旧 collection 并保留旧 `clip_results.json` 备份。
  - clip_results.json 目标 schema（示例单条）：
    ```json
    {
      "canonical_path": "/media/a.mp4", "file_path_raw": "D:\\media\\a.mp4", "mtime": 1710000000,
      "file_hash": "sha1:abcd..." (可选),
      "segment": {"index":0,"start":0,"end":5},
      "shotId": "shot_123", "label": "a", "duration": 5.0,
      "clipMetadata": {"embeddings": [...], "tags": ["室外场景","中景"], "emotions": ["紧张"], "description": "..."}
    }
    ```
    `/clip/save-results` 去重键 = canonical_path + segment.index（或无 segment 时仅 canonical_path），禁止覆盖其他 segment；需调整为保持多分片。

### Definition of Done
- Qdrant 与 JSON 回退数据一致性校验通过，阈值缩放统一；重扫策略可执行且跑通。
- 前端提供三种搜索模式入口（标签/语义/向量混合），支持相似度/标签可见，列表不卡顿。
- 验收 agent 可在 CLI 一键运行并在前端展示结果，支持热更新知识库/规则。
- 测试：Vitest 通过；Playwright 烟测覆盖搜索入口、相似度显示、验收按钮与结果展示。

## Verification Strategy
- 自动化：`npm run test` (Vitest)；新增 Playwright 配置后运行 `npm run test:pw`；保留现有 E2E JS 脚本（`CLIP_SERVICE_API_KEY=... node tests/frontend-flow-test.js`）。
- 手动/CLI：curl 调 /clip/search（Qdrant+JSON 回退）、/clip/scan 试跑；CLI 触发验收 agent 并核对输出；前端手动验证按钮与结果渲染。

## Tasks (ordered, with parallel hints)

- [ ] 0. 基线与备份（并行允许）
  - 备份 `clip-service/clip_results.json`；记录 Qdrant collection `video_assets` stats（点数量、payload 示例）。
  - 验证 logit_scale（clip_server.py 内部打印或代码常量），确认 threshold 缩放路径前后保持一致。
  - Acceptance: 备份文件存在；Qdrant stats（count, vectors）记录到 `docs/ops/retrieval-notes.md`（新增文件），附获取命令。

- [ ] 1. 重扫策略与执行开关（先决）
  - 在 README/运维说明写明：默认增量；标签体系变化时显式 FULL_RESCAN=1 才 drop/recreate collection 并全量重扫。
  - 定义增量判断：以 filePath+mtime（或 hash）与已存 point_id=sha1(filePath) 对比；新增/变更才 upsert。
  - 明确 Qdrant upsert 责任：重写/替换 `clip-service/sync_qdrant.py`（目前以数组下标为 id）；新脚本需支持 `--json clip_results.json --collection video_assets --id sha1 --upsert --dry-run`，输出新增/更新/跳过计数，point_id=sha1(filePath)。
  - 鉴权开关实现：在 `clip-service/clip_server.py` 添加 `CLIP_AUTH_DISABLED`（默认 false），true 时跳过 HTTPBearer；文档说明仅限本地/内网调试。
  - 新文档落点：`docs/ops/retrieval-ops.md`（或 README 指定章节）。
  - Acceptance: 文档落地；dry-run 输出将新增/更新/跳过数量；point_id 规则被记录；CLIP_AUTH_DISABLED 开关说明已写入文档。

- [ ] 2. 重扫执行（可按需要全量/增量）
  - 首次发布：强制 FULL_RESCAN 到新 collection `video_assets_v2`（sha1 id 规范），完成后切换 env 的 COLLECTION_NAME 指向新 collection；如需回滚，切回旧 collection 并保留备份。
  - 增量：`curl /clip/scan`（带 auth）获取结果 -> `/clip/save-results` 更新 JSON -> `sync_qdrant.py --json clip_results.json --collection $COLLECTION_NAME --id sha1 --upsert`；仅新增/变更 filePath upsert。
  - 全量：drop/recreate target collection (dim=512, metric=cosine, m=16, ef_construct=200) -> `/clip/scan` -> `/clip/save-results` -> 同步脚本 upsert 全量。
  - 为增量对比，scan 阶段需写入 mtime(秒) / file_hash(可选, sha1, 若开销可跳过) / segmentIndex；point_id=sha1(canonical_path[+#seg])，canonical_path=绝对路径转小写、反斜杠转 `/`。
  - Acceptance: Qdrant count 与 JSON 数量一致（±1%）；抽样 20 条 filePath/segment 的 point_id=sha1(canonical_path[#seg])；阈值放大/缩放一致；JSON 记录含 mtime 字段且 canonical_path 可复算。
  - 字段对齐：sync_qdrant.py 新版需逐字段映射 JSON -> payload：canonical_path、segment、tags、description、duration、mtime、file_hash；id 采用 canonical_path+segment.index 的 sha1。

- [ ] 2b. 阈值/分数域统一（与 5/6/8 关联）
  - 修改 `clip-service/qdrant_search.py`：保留阈值输入域 0-100，score_threshold=threshold/100；LOGIT_SCALE 固定 100，仅用于阈值换算。
  - 修改 `clip-service/clip_server.py`：Qdrant 模式返回的 similarity 不再乘模型 logit_scale，统一输出 scale=100；JSON 模式同一逻辑；如需兼容旧客户端（0-1 输入），提供临时开关（例如 `ACCEPT_LEGACY_THRESHOLD=1`）并计划移除。
  - 修改 `src/services/clipService.ts`：移除 “>1 则认为 0-100” 的双义逻辑，固定期望输入 0-100；必要时在 1.x 版本窗口内保留兼容并警告；更新前端显示/校验；JSON 回退模式输出也按 0-100 scale。
  - 同步更新 UI/类型：`src/types/DataModel.ts` 的 similarity 语义固定 0-100；`src/components/ShotLibrary.tsx`、`src/components/AssetManagerModal.tsx`、`src/components/ScriptBlockPanel.tsx`、`src/App.tsx` 等任何显示/过滤 similarity 的地方改为 0-100；兼容旧数据时显示警告。
  - 测试更新：`src/test/useScriptBlockMatcher.test.ts` 等依赖 similarity 的测试需同步改为 0-100 预期。
  - Acceptance: curl/UI/CLI 对同一查询阈值 25 时，Qdrant/JSON 输出分数一致（±0.5）；旧接口兼容策略在文档中注明退场时间；单元测试覆盖 0-100 输入域。

- [ ] 3. 标签体系验证与修正
  - 用 `clip-service/analyze_tags.py`/`verify_tags.py` 统计缺失/脏标签；修复 `verify_tags.py` 使其支持 Authorization 头，阈值输入改为 0-100（内部 /100），并输出清洗建议。
  - 定义允许标签列表与清洗规则；更新前端展示的标签映射（若有）。
  - Acceptance: 报告缺失/异常标签清单；清洗后随机抽样 30 条标签符合预期分类。

- [ ] 4. 存储与规模建议（文档任务）
  - 估算 100k 向量（512 dim, f32）占用 ≈ 200MB vectors + payload；推荐 Qdrant HNSW: m=16, ef_construct=200, ef_search=128；若磁盘敏感，开启 scalar quantization；启用 mmap + snapshot 备份。
  - 给出创建 collection 示例请求（REST）：
    ```json
    {
      "vectors": {"size":512,"distance":"Cosine"},
      "hnsw_config": {"m":16,"ef_construct":200},
      "optimizers_config": {"default_segment_number":4},
      "quantization_config": {"scalar": {"type":"int8","always_ram":false}}
    }
    ```
    示例命令：`curl -X PUT "$QDRANT_URL/collections/video_assets" -H "Content-Type: application/json" -d @collection.json`
  - 记录备份策略（Qdrant snapshot + clip_results.json 备份路径/频率）。
  - Acceptance: 文档列出参数、容量估算、备份与恢复步骤。

- [ ] 5. 前端检索体验改造（并行于 6）
  - 在 `src/services/searchService.ts` 接入向量/混合模式入口，并暴露 UI 选择：标签/语义/向量混合。
  - `src/components/AssetManagerModal.tsx` 与 `src/components/ShotLibrary.tsx`：
    - 虚拟化选型固定：使用 `react-virtuoso`（新增依赖），避免 500+ 列表卡顿。
    - 展示相似度、完整标签列表，支持按相似度/标签过滤。
    - 提供向量搜索输入与阈值调节（传入放大阈值，固定 scale=100 展示，与后端缩放一致）。
    - 在 clipService fetch 统一加 `Authorization` header；如需本地禁用鉴权，需在 env/注释中显式说明。
  - Acceptance: 前端可选择三种模式；列表流畅（<100ms 交互滞后）；相似度/标签可见且与 curl 抽样 10 条一致；阈值调节生效。

- [ ] 5c. 相似度/阈值触点补丁
  - 补充必须改动的文件：`src/services/assetMatchingService.ts`（阈值与日志 0-1 -> 0-100），`src/App.tsx` 中 matchThreshold 相关 UI/逻辑改 0-100，`src/components/ShotLibrary.tsx` 的相似度分段着色阈值改 0-100；如有其他以 0-1 比例写死的逻辑，统一改为 0-100 并显示警告（兼容期）。
  - Acceptance: 以上文件改动并通过单测；UI 显示/过滤均以 0-100 为准，curl 抽样可对齐。

- [ ] 5b. 前端/测试鉴权注入（与 6/8 关联）
  - 前端 key 来源：`import.meta.env.VITE_CLIP_SERVICE_API_KEY`（仅内网/本地），通过 clipService 统一 header 注入；若使用 Vite 代理 `/api/clip`，确保 proxy 不剥离 auth 头。
  - 测试/CLI：要求通过环境变量 `CLIP_SERVICE_API_KEY` 注入；不得硬编码。
  - 安全约束：该工具假定内网使用；若需公共部署，需转向服务端代理鉴权（不在本迭代）。
  - Acceptance: grep 无明文 key（尤其 `tests/full-e2e-test.js`）；本地/CI 均可通过 env 注入；前端调用实际携带 Authorization（可在网络面板/日志验证），代理模式下请求头未被剥离（通过 dev server 日志或抓包验证）。

- [ ] 6. API/CLI 校验（并行于 5）
  - curl /clip/search（use_qdrant=true/false）对比 JSON 回退与 Qdrant 结果，确认阈值缩放一致（输入域 0-100，输出域放大后）。
  - 提供 CLI 脚本（Python/Node 任选其一），放置 `scripts/clip_cli.py` 或 `scripts/clip-cli.mjs`：封装 auth 头、--mode(qdrant/json)、--threshold(0-100)、--full-rescan flag；输出 JSON/表格，示例命令与输出样本写入 README 段落。
  - 鉴权覆盖：默认对 /clip/search /clip/scan /clip/save-results /clip/results 全部要求 Authorization；若 CLIP_AUTH_DISABLED=1 则全部路由跳过鉴权（仅本地）。
  - Acceptance: CLI 能查询并打印 topK，支持 --threshold（放大值）与 --mode(qdrant/json)，自动加 Authorization 头；full-rescan 有 dry-run/confirm 开关；README/`docs/ops/retrieval-ops.md` 有示例输出；确认 /clip/results 也需 auth（或文档标注例外）。

- [ ] 7. 分镜验收 agent（核心）
  - 技术栈与目录：FastAPI 独立服务，目录 `acceptance-service/`，默认端口 9000；同一代码暴露 HTTP + CLI（调用相同 Python 入口）。
  - HTTP 契约（固定）：`POST /accept/review`
    - Request JSON:
      ```json
      {
        "storyboard": [{"scene_id":"s1","block_id":"b1","text":"...","emotion":"紧张","expected_duration":8}],
        "matches": [{"block_id":"b1","shot_id":"shot_123","file_path":"/media/a.mp4","similarity":78.5,"tags":["室外场景","中景"],"emotion":"紧张","duration":7.5}],
        "rules": {"coverage_min":0.9,"similarity_min":70,"emotion_match_min":0.6,"duration_tolerance":0.2},
        "kb_paths": ["knowledge/cinematography-basics.md","knowledge/asset-classification.md",".qoder/repowiki/zh/content/项目概述/设计原则与验收标准.md"]
      }
      ```
    - Response JSON:
      ```json
      {"pass":false,"score":{"coverage":0.85,"similarity":0.72,"emotion":0.6},"reasons":["block b1 similarity below 75"],"items":[{"block_id":"b1","status":"fail","details":"similarity 72<75"}]}
      ```
  - 判定算法（固定口径）：
    - coverage: 有匹配的 block 数 / 总 block 数（相似度 ≥ similarity_min 且通过情绪/时长判定即视为覆盖）。
    - similarity: 对每个 block 取 top1 similarity（scale=100）并裁剪到 [0,1] 后平均，或若无匹配则计 0；判定阈值为 rules.similarity_min。
    - emotion: 默认严格字符串匹配；可选同义词表 `acceptance-service/resources/emotion_synonyms.json`（key=标准情绪，value=同义词数组）命中即计 1；emotion_match_min=0.6 表示需 ≥60% 匹配；如无同义词文件则仅 exact-match。
    - KB 作用：当前版本 KB 用于同义词扩展与理由模板；规则阈值由 rules JSON 定义；reload 验证方式：修改同义词文件或 rules.json -> 调用 `/accept/reload` -> 对同一输入请求 reasons/score 可观察变化。
    - duration: |duration - expected| / expected ≤ duration_tolerance 视为通过；默认相对误差 20%。
    - 总体 pass: 所有维度都 >= 阈值，且 coverage >= coverage_min。
    - 示例：规则 similarity_min=75，emotion_match_min=0.6，duration_tolerance=0.2；若 b1 similarity=72、情绪匹配、时长误差 10% => coverage=1, similarity=0.72<0.75, emotion=1, duration=1 => pass=false, reason 指出 similarity 不足。
  - 数据映射（前端/后端）：
    - storyboard 来源：`src/store/appStore.ts` 中的 `scriptBlocks`（id -> block_id, scene_id -> scene_id, text -> text, emotion -> emotion, expected_duration -> expected_duration）。
    - matches 来源：已放置的 clips/shots（clip -> shot_id/file_path/duration，emotion 从 shot.emotion 或 clip_metadata.emotions[0]，similarity 从搜索结果写入的 `Shot.similarity` scale=100，tags 从 clip_metadata.tags）。允许 topN，但默认取每 block 的 top1（若无匹配则 coverage 记 0）。
  - 鉴权：验收服务需要 `ACCEPT_API_KEY`，Header `Authorization: Bearer $ACCEPT_API_KEY`；CLI 通过 `--auth` 注入；前端通过 env `VITE_ACCEPT_API_KEY` 注入。
  - CLI：`acceptance-cli review --storyboard story.json --matches matches.json --rules rules.json --kb knowledge/ --auth $ACCEPT_API_KEY`。
  - 热更新：提供 `POST /accept/reload` 重新加载 rules/kb；或监听文件变更。
  - 前端集成：在 `src/components/ShotLibrary.tsx`（或新建验收面板组件）添加“分镜验收”按钮，调用 API，结果放入本地 state 或 store（新增 acceptance slice），展示通过/不通过、理由、分项分数；无匹配时展示提示。
  - Acceptance: CLI 与 HTTP 返回一致；前端按钮可触发并渲染响应；规则/KB 变更后 reload 生效；接口字段与上方 schema 一致；无匹配时 coverage 正确为 0。

- [ ] 8. 测试与验证
  - Vitest：为阈值缩放、mode 选择、Authorization header 注入、searchService 输出增加单测（mock clipService/searchService）。
  - Playwright：新增 Playwright Test runner（`playwright.config.ts`）、测试放 `tests/playwright/*.spec.ts`，`package.json` 添加 `test:pw="playwright test"`；运行前需设置 `CLIP_SERVICE_API_KEY`。
  - 复用/更新 `tests/frontend-flow-test.js` 等 JS E2E：改为从 env 读取 API key，避免硬编码；若调用外部 LLM 需 mock 或跳过付费段。
  - 处理硬编码密钥：移除 `tests/full-e2e-test.js` 等脚本中的明文 key，改为读取环境变量；新增 grep 检查（如 `rg "KEY" tests` 或针对特定字符串）作为验收；CI/本地需提供示例 .env。
  - 前置说明：Playwright smoke 需要已启动前端(`npm run dev` 或 webServer 配置)、clip-service(8000, 带 API key) 与 acceptance-service(9000, 带 API key)；计划在 playwright.config.ts 里配置 webServer（可选）或要求手动预启动，必须在文档写明。
  - Acceptance: `npm run test` 通过；`npm run test:pw` 通过（前置启动说明满足）；JS E2E 脚本通过或标注跳过外部依赖；所有测试请求均带 Authorization；grep 检查确认无明文密钥。

- [ ] 9. 升级与回退
  - 文档化升级步骤：重扫策略、备份/恢复 snapshot、回退 JSON。
  - 定义 config/env：QDRANT_URL, COLLECTION_NAME, THRESHOLD_SCALE, ENABLE_MMR, KB_PATH, RULES_PATH, ACCEPTANCE_API_URL。
  - Acceptance: 文档可执行；环境变量清单齐全；回退路径明确。

## Self-Review
- 重大假设：用户接受默认存储/重扫/agent 形态；若不接受需调整任务 1/7。
- 风险：Playwright 配置缺失需先初始化；全量重扫可能耗时与算力需窗口；前端虚拟化引入新依赖需确认许可。
- 未决：如需 SQLite/duckdb 离线缓存或前端离线模式，需追加任务。

## Parallelization Notes
- 5（前端）与 6（API/CLI）可并行；7（验收 agent）可与 5/6 并行但依赖知识库梳理。
- 测试 8 在功能完成后统一跑；文档 9 收尾。

## Evidence & Commands
- Vitest: `npm run test`
- Playwright: `npm run test:pw`（需先添加 playwright.config.ts 和脚本；运行前设置 CLIP_SERVICE_API_KEY）
- E2E JS: `CLIP_SERVICE_API_KEY=... node tests/frontend-flow-test.js`
- API 手验：
  - `curl -X POST http://localhost:8000/clip/search -H "Content-Type: application/json" -H "Authorization: Bearer $CLIP_SERVICE_API_KEY" -d '{"query":"室外行走","top_k":5,"threshold":25,"use_qdrant":true}'`
  - `curl -X POST http://localhost:8000/clip/search -H ... -d '{"query":"室外行走","top_k":5,"threshold":25,"use_qdrant":false}'`
- 验收 agent CLI（待实现示例）：`acceptance-cli --storyboard story.json --matches matches.json --rules rules.yaml --kb ./knowledge`

---

Plan saved to `.sisyphus/plans/retrieval-improvement.md`.
