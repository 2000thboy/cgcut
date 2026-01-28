# CGCUT 播放组件修复计划

## TL;DR

> **Quick Summary**: 修复播放组件缩放崩坏和剧本段落关联问题，确保分镜预览功能正常工作
> 
> **Deliverables**: 
> - 响应式时间轴组件
> - 修复的剧本段落关联机制
> - 稳定的视频播放功能
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: 时间轴响应式修复 → 剧本段落关联修复 → 集成测试

---

## Context

### Original Request
用户报告了两个关键问题：
1. 播放组件因缩放而崩坏不能播放
2. 引用出来的段落和正文匹配的剧本拆分并没有什么关联，看上去是直接按照顺序播放

### Interview Summary
**Key Discussions**:
- 通过代码分析发现了缩放相关的硬编码问题
- 识别了剧本段落与播放内容关联的断链问题
- 测试报告显示占位符clips与实际视频素材的缺失

**Research Findings**:
- `PIXELS_PER_SECOND = 60` 硬编码导致响应式问题
- `scriptScenes`始终为空，场景分组逻辑失效
- 播放状态中的`current_script_block_id`未正确更新

### Metis Review
**Identified Gaps** (addressed):
- 需要添加响应式设计测试用例
- 需要验证剧本段落关联的边界情况
- 需要考虑不同屏幕尺寸的兼容性

---

## Work Objectives

### Core Objective
修复播放组件的缩放崩坏问题，并建立正确的剧本段落与播放内容关联机制。

### Concrete Deliverables
- 响应式时间轴组件，支持动态缩放
- 修复的剧本段落高亮和同步机制
- 稳定的视频播放功能，支持不同屏幕尺寸

### Definition of Done
- [ ] 播放组件在不同缩放级别下正常工作
- [ ] 剧本段落与播放内容正确关联
- [ ] 时间轴布局不崩坏
- [ ] 播放指示器位置准确

### Must Have
- 响应式时间轴设计
- 剧本段落同步机制
- 稳定的视频播放

### Must NOT Have (Guardrails)
- 破坏现有的拖拽排序功能
- 影响素材匹配逻辑
- 改变现有的数据模型结构

---

## Verification Strategy (MANDATORY)

> This section is determined during interview based on Test Infrastructure Assessment.
> The choice here affects ALL TODO acceptance criteria.

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: Tests-after
- **Framework**: Playwright (现有测试框架)

### If Automated Verification Only (NO User Intervention)

> **CRITICAL PRINCIPLE: ZERO USER INTERVENTION**
>
> **NEVER** create acceptance criteria that require:
> - "User manually tests..." / "사용자가 직접 테스트..."
> - "User visually confirms..." / "사용자가 눈으로 확인..."
> - "User interacts with..." / "사용자가 직접 조작..."
> - "Ask user to verify..." / "사용자에게 확인 요청..."
> - ANY step that requires a human to perform an action
>
> **ALL verification MUST be automated and executable by the agent.**
> If a verification cannot be automated, find an automated alternative or explicitly note it as a known limitation.

Each TODO includes EXECUTABLE verification procedures that agents can run directly:

**By Deliverable Type:**

| Type | Verification Tool | Automated Procedure |
|------|------------------|---------------------|
| **Frontend/UI** | Playwright browser via playwright skill | Agent navigates, clicks, screenshots, asserts DOM state |
| **TUI/CLI** | interactive_bash (tmux) | Agent runs command, captures output, validates expected strings |
| **API/Backend** | curl / httpie via Bash | Agent sends request, parses response, validates JSON fields |
| **Library/Module** | Node/Python REPL via Bash | Agent imports, calls function, compares output |
| **Config/Infra** | Shell commands via Bash | Agent applies config, runs state check, validates output |

**Evidence Requirements (Agent-Executable):**
- Command output captured and compared against expected patterns
- Screenshots saved to .sisyphus/evidence/ for visual verification
- JSON response fields validated with specific assertions
- Exit codes checked (0 = success)

---

## Execution Strategy

### Parallel Execution Waves

> Maximize throughput by grouping independent tasks into parallel waves.
> Each wave completes before the next begins.

```
Wave 1 (Start Immediately):
├── Task 1: 修复时间轴响应式问题
└── Task 2: 修复剧本段落关联机制

Wave 2 (After Wave 1):
├── Task 3: 集成测试和验证
└── Task 4: 边界情况处理

Critical Path: Task 1 → Task 3
Parallel Speedup: ~50% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3 | 2 |
| 2 | None | 3 | 1 |
| 3 | 1, 2 | None | 4 |
| 4 | 3 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | delegate_task(category="visual-engineering", load_skills=["frontend-ui-ux"], run_in_background=true) |
| 2 | 3, 4 | dispatch parallel after Wave 1 completes |

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info.

- [ ] 1. 修复时间轴响应式问题

  **What to do**:
  - 将 `PIXELS_PER_SECOND = 60` 改为动态计算
  - 添加容器尺寸监听和响应式布局
  - 修复播放指示器位置计算
  - 优化视频元素响应式设计

  **Must NOT do**:
  - 破坏现有的拖拽排序功能
  - 改变时间轴的基本交互逻辑

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `visual-engineering`
    - Reason: 需要处理UI响应式设计和布局问题
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: 需要处理React组件的响应式设计和CSS布局
  - **Skills Evaluated but Omitted**:
    - `playwright`: 虽然需要测试，但主要工作是UI修复而非测试

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  > The executor has NO context from your interview. References are their ONLY guide.
  > Each reference must answer: "What should I look at and WHY?"

  **Pattern References** (existing code to follow):
  - `src/components/SimpleTimeline.tsx:8` - PIXELS_PER_SECOND 常量定义位置
  - `src/components/SimpleTimeline.tsx:27` - 播放指示器位置计算逻辑
  - `src/components/SimpleTimeline.tsx:191-196` - 时间轴点击事件处理
  - `src/components/SimpleTimeline.tsx:121-126` - 视频元素样式定义

  **API/Type References** (contracts to implement against):
  - `src/types/DataModel.ts` - 确保不改变现有数据结构
  - `src/hooks/useTimelinePlayer.ts` - 播放状态管理接口

  **Test References** (testing patterns to follow):
  - `tests/video-display-report.json` - 现有测试报告格式
  - `tests/full-e2e-test.js` - E2E测试模式参考

  **Documentation References** (specs and requirements):
  - `AGENTS.md` - 项目代码风格和架构规范
  - `README.md` - 项目功能说明和技术栈

  **External References** (libraries and frameworks):
  - React useEffect 和 useRef 文档 - 用于处理容器尺寸监听
  - CSS 响应式设计最佳实践 - 用于时间轴布局优化

  **WHY Each Reference Matters** (explain the relevance):
  - `SimpleTimeline.tsx:8` - 需要修改硬编码的像素比例常量
  - `SimpleTimeline.tsx:27` - 播放指示器位置计算需要适配动态缩放
  - `SimpleTimeline.tsx:191-196` - 时间轴点击事件需要考虑动态像素比例
  - `SimpleTimeline.tsx:121-126` - 视频元素样式需要更好的响应式设计

  **Acceptance Criteria**:

  > **CRITICAL: AGENT-EXECUTABLE VERIFICATION ONLY**
  >
  > - Acceptance = EXECUTION by the agent, not "user checks if it works"
  > - Every criterion MUST be verifiable by running a command or using a tool
  > - NO steps like "user opens browser", "user clicks", "user confirms"
  > - If you write "[placeholder]" - REPLACE IT with actual values based on task context

  **Automated Verification (ALWAYS include, choose by deliverable type):**

  **For Frontend/UI changes** (using playwright skill):
  ```typescript
  // Agent executes via playwright browser automation:
  1. 启动开发服务器: npm run dev
  2. 导航到: http://localhost:5173
  3. 等待页面加载完成
  4. 检查时间轴元素是否存在: document.querySelector('.relative.min-h-[80px]')
  5. 模拟窗口缩放: browser.setViewportSize({width: 800, height: 600})
  6. 检查时间轴布局是否正常: document.querySelector('.relative.min-h-[80px]').offsetWidth > 0
  7. 模拟窗口缩放: browser.setViewportSize({width: 1920, height: 1080})
  8. 检查时间轴布局是否正常: document.querySelector('.relative.min-h-[80px]').offsetWidth > 0
  9. 截图保存: .sisyphus/evidence/task-1-responsive-timeline.png
  ```

  **Evidence to Capture:**
  - [ ] 不同屏幕尺寸下的时间轴截图
  - [ ] 播放指示器位置验证日志
  - [ ] 控制台错误日志（应为空）

  **Commit**: YES | NO (groups with N)
  - Message: `fix(timeline): implement responsive timeline scaling`
  - Files: `src/components/SimpleTimeline.tsx`
  - Pre-commit: `npm run dev` (确保开发服务器正常启动)

- [ ] 2. 修复剧本段落关联机制

  **What to do**:
  - 修复 `scriptScenes` 为空的问题
  - 更新播放状态中的 `current_script_block_id`
  - 修复 `getCurrentBlockId()` 逻辑
  - 确保剧本段落高亮与播放同步

  **Must NOT do**:
  - 改变现有的数据模型结构
  - 破坏素材匹配逻辑

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `unspecified-low`
    - Reason: 主要是逻辑修复，不需要复杂的UI或架构设计
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: 需要处理React组件状态管理和同步逻辑
  - **Skills Evaluated but Omitted**:
    - `git-master`: 虽然需要修改代码，但不需要复杂的git操作

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/components/ScriptBlockPanel.tsx:44-54` - getCurrentBlockId() 函数实现
  - `src/components/ScriptBlockPanel.tsx:56` - currentPlayingBlockId 计算逻辑
  - `src/store/appStore.ts:74-80` - 播放状态结构定义
  - `src/components/ScriptBlockPanel.tsx:36-41` - 自动滚动到高亮段落的逻辑

  **API/Type References** (contracts to implement against):
  - `src/types/DataModel.ts:PlaybackState` - 播放状态接口定义
  - `src/types/DataModel.ts:ScriptScene` - 场景数据结构

  **Test References** (testing patterns to follow):
  - `tests/video-display-report.json` - 现有测试中的状态检查模式

  **Documentation References** (specs and requirements):
  - `AGENTS.md` - 状态管理和组件通信规范

  **External References** (libraries and frameworks):
  - Zustand 状态管理文档 - 用于正确更新播放状态

  **WHY Each Reference Matters** (explain the relevance):
  - `ScriptBlockPanel.tsx:44-54` - 需要修复段落查找逻辑
  - `ScriptBlockPanel.tsx:56` - 需要确保播放段落正确计算
  - `appStore.ts:74-80` - 需要正确更新播放状态中的段落ID
  - `ScriptBlockPanel.tsx:36-41` - 需要确保高亮同步机制正常工作

  **Acceptance Criteria**:

  **Automated Verification (ALWAYS include, choose by deliverable type):**

  **For Frontend/UI changes** (using playwright skill):
  ```typescript
  // Agent executes via playwright browser automation:
  1. 启动开发服务器: npm run dev
  2. 导航到: http://localhost:5173
  3. 导入测试剧本（如果有测试数据）
  4. 检查 scriptScenes 是否不为空: document.querySelector('[data-scene]') !== null
  5. 开始播放: document.querySelector('button[title="播放"]').click()
  6. 等待 1 秒
  7. 检查播放状态中的 current_script_block_id 是否更新: 
     const state = JSON.parse(localStorage.getItem('app-store') || '{}')
     console.log('Current script block ID:', state.playbackState?.current_script_block_id)
  8. 检查是否有段落被高亮: document.querySelector('.bg-yellow-900') !== null
  9. 截图保存: .sisyphus/evidence/task-2-script-sync.png
  ```

  **Evidence to Capture:**
  - [ ] 剧本段落高亮同步截图
  - [ ] 播放状态更新日志
  - [ ] scriptScenes 数据验证日志

  **Commit**: YES | NO (groups with N)
  - Message: `fix(script): repair script block association with playback`
  - Files: `src/components/ScriptBlockPanel.tsx`, `src/store/appStore.ts`
  - Pre-commit: `npm run dev` (确保开发服务器正常启动)

- [ ] 3. 集成测试和验证

  **What to do**:
  - 运行完整的 E2E 测试
  - 验证修复后的功能
  - 检查边界情况
  - 生成测试报告

  **Must NOT do**:
  - 引入新的测试失败
  - 修改现有测试逻辑

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: 主要是运行现有测试和验证，不需要复杂开发
  - **Skills**: `playwright`
    - `playwright`: 需要运行浏览器自动化测试
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: 虽然涉及UI，但主要是测试而非开发

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: None (final verification)
  - **Blocked By**: Tasks 1, 2

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `tests/full-e2e-test.js` - 完整 E2E 测试脚本
  - `tests/frontend-flow-test.js` - 前端功能测试
  - `tests/video-display-report.json` - 测试报告格式

  **Test References** (testing patterns to follow):
  - 现有的所有测试文件和测试模式

  **Documentation References** (specs and requirements):
  - `AGENTS.md` - 测试命令和流程

  **WHY Each Reference Matters** (explain the relevance):
  - `full-e2e-test.js` - 需要运行完整的功能验证
  - `frontend-flow-test.js` - 需要验证前端交互流程
  - `video-display-report.json` - 需要生成对比测试报告

  **Acceptance Criteria**:

  **Automated Verification (ALWAYS include, choose by deliverable type):**

  **For TUI/CLI changes** (using interactive_bash):
  ```bash
  # Agent runs:
  1. 运行完整 E2E 测试: node tests/full-e2e-test.js
  2. 检查测试结果: cat tests/video-display-report.json | jq '.summary.passed'
  3. 运行前端流程测试: node tests/frontend-flow-test.js
  4. 验证无控制台错误: grep -i "error" tests/video-display-report.json || echo "No errors found"
  5. 生成测试报告: echo "Integration test completed" > .sisyphus/evidence/task-3-test-result.txt
  ```

  **Evidence to Capture:**
  - [ ] 测试报告 JSON 文件
  - [ ] 测试结果摘要
  - [ ] 错误日志（如有）

  **Commit**: NO (verification only)

- [ ] 4. 边界情况处理

  **What to do**:
  - 处理空时间轴情况
  - 处理无视频素材情况
  - 处理异常窗口尺寸
  - 添加错误边界和降级方案

  **Must NOT do**:
  - 破坏现有功能
  - 引入新的错误

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `unspecified-low`
    - Reason: 主要是添加边界情况处理，复杂度较低
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: 需要处理React组件的错误边界和状态管理

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: None (final task)
  - **Blocked By**: Task 3

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/components/SimpleTimeline.tsx:144-149` - 空状态处理模式
  - `src/components/ScriptBlockPanel.tsx:465-474` - 空剧本处理模式

  **Test References** (testing patterns to follow):
  - 现有的错误处理和边界情况测试模式

  **Documentation References** (specs and requirements):
  - `AGENTS.md` - 错误处理和边界情况规范

  **WHY Each Reference Matters** (explain the relevance):
  - `SimpleTimeline.tsx:144-149` - 需要参考现有的空状态处理模式
  - `ScriptBlockPanel.tsx:465-474` - 需要参考现有的边界情况处理

  **Acceptance Criteria**:

  **Automated Verification (ALWAYS include, choose by deliverable type):**

  **For Frontend/UI changes** (using playwright skill):
  ```typescript
  // Agent executes via playwright browser automation:
  1. 启动开发服务器: npm run dev
  2. 测试空时间轴: 导航到页面，检查是否有"将镜头添加到时间轴开始预览"提示
  3. 测试异常窗口尺寸: browser.setViewportSize({width: 300, height: 200})
  4. 检查布局是否崩坏: document.querySelector('.flex.flex-col') !== null
  5. 测试无视频素材: 检查占位符显示是否正常
  6. 截图保存: .sisyphus/evidence/task-4-edge-cases.png
  ```

  **Evidence to Capture:**
  - [ ] 边界情况处理截图
  - [ ] 错误日志（应为空或包含预期的错误处理）
  - [ ] 降级方案验证日志

  **Commit**: YES | NO (groups with N)
  - Message: `fix(timeline): add edge case handling and error boundaries`
  - Files: `src/components/SimpleTimeline.tsx`, `src/components/ScriptBlockPanel.tsx`
  - Pre-commit: `npm run dev` (确保开发服务器正常启动)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(timeline): implement responsive timeline scaling` | `src/components/SimpleTimeline.tsx` | `npm run dev` |
| 2 | `fix(script): repair script block association with playback` | `src/components/ScriptBlockPanel.tsx`, `src/store/appStore.ts` | `npm run dev` |
| 3 | NO (verification only) | - | `node tests/full-e2e-test.js` |
| 4 | `fix(timeline): add edge case handling and error boundaries` | `src/components/SimpleTimeline.tsx`, `src/components/ScriptBlockPanel.tsx` | `npm run dev` |

---

## Success Criteria

### Verification Commands
```bash
npm run dev  # Expected: 开发服务器正常启动
node tests/full-e2e-test.js  # Expected: 所有测试通过
node tests/frontend-flow-test.js  # Expected: 前端功能测试通过
```

### Final Checklist
- [ ] 播放组件在不同缩放级别下正常工作
- [ ] 剧本段落与播放内容正确关联
- [ ] 时间轴布局不崩坏
- [ ] 播放指示器位置准确
- [ ] 所有测试通过
- [ ] 边界情况处理完善