# AGENTS.md - CGCUT 项目开发指南

## 🚀 项目概述

**CGCUT** 是一个基于 AI 的影视分镜验证工具，帮助导演快速将剧本转换为可视化分镜预览。

### 架构概览
- **前端**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **后端服务**: Python + FastAPI (CLIP 视频分析 + VLM 视频描述 + LLM 剧本分析)
- **端口配置**: 前端(5173), CLIP服务(8000), VLM服务(8001)

## 🔧 构建与测试命令

### 核心命令
```bash
# 开发环境
npm run dev          # 启动开发服务器 (localhost:5173)
npm run build        # 构建生产版本
npm run preview      # 预览生产构建

# Electron 应用
npm run electron     # 直接运行 Electron
npm run electron:dev  # 开发模式运行 Electron

# 依赖安装
npm install          # 安装 Node.js 依赖
cd clip-service && pip install -r requirements.txt
cd vlm-service && pip install -r requirements.txt
```

### 测试命令
```bash
# 完整测试套件
node tests/full-e2e-test.js          # 完整 E2E 测试
node tests/frontend-flow-test.js      # 前端流程测试
node tests/mvp-api-test.js            # MVP API 测试

# 单独测试文件
node tests/frontend-flow-test.js      # 运行前端流程测试
```

### 服务启动
```bash
# 前端 (终端1)
npm run dev

# CLIP 服务 (终端2)
cd clip-service && python clip_server.py

# VLM 服务 (终端3)  
cd vlm-service && python vlm_server.py
```

## 📝 代码风格指南

### TypeScript 配置
- **目标版本**: ES2020
- **模块系统**: ESNext with ES modules
- **JSX**: React JSX transform
- **严格模式**: 启用 (strict: true)

### 导入规范
```typescript
✅ 正确:
import { ScriptBlock } from '../types/DataModel';
import { calculateDuration } from '../utils/duration';

❌ 错误:
import ScriptBlock from '../types/DataModel';
const duration = require('../utils/duration');
```

### 命名约定
```typescript
// 类型和接口：PascalCase
interface ScriptBlock {
  scene_id: string;
  script_block_id: string;
}

// 函数和变量：camelCase
function calculateScriptBlockDuration(block: ScriptBlock): number {
  const duration = block.duration || 0;
  return duration;
}

// 常量：ALL_CAPS_SNAKE_CASE
const NVIDIA_CONFIG = {
  model: 'meta/llama-3.1-405b-instruct',
  apiKey: process.env.VITE_NVIDIA_API_KEY
};
```

### 文件结构约定
```
src/
├── components/          # React 组件
├── services/           # API 服务层
├── store/             # Zustand 状态管理
├── types/             # TypeScript 类型定义
├── utils/             # 工具函数
└── App.tsx            # 应用入口
```

### 错误处理模式
```typescript
// 服务层错误处理
class LLMService {
  async processScript(script: string): Promise<ScriptBlock[]> {
    try {
      const response = await fetch('/api/llm/analyze', {
        method: 'POST',
        body: JSON.stringify({ script })
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      return this.robustJSONParse(data.content);
    } catch (error) {
      console.error('LLM processing failed:', error);
      throw new Error(`剧本分析失败，请检查网络连接和API配置`);
    }
  }

  private robustJSONParse(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      try {
        // 尝试提取 JSON 部分
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('无法解析响应内容');
      } catch {
        // 最后的降级方案
        console.warn('响应格式异常，使用默认结构');
        return { blocks: [] };
      }
    }
  }
}
```

### 数据模型规范
```typescript
// 接口定义清晰完整
interface ScriptBlock {
  scene_id: string;
  script_block_id: string;
  content: string;
  duration: number;
  shot_type: string;
  description?: string;
}

// 工具函数类型安全
export function loadJSON<T>(path: string): Promise<T> {
  return fetch(path).then(res => res.json() as T);
}

// 状态管理使用类型
interface AppState {
  scriptBlocks: ScriptBlock[];
  selectedBlock: ScriptBlock | null;
  isLoading: boolean;
}
```

## 🎨 UI/UX 规范

### Tailwind CSS 配置
- **内容扫描**: `./src/**/*.{js,ts,jsx,tsx}`
- **主题扩展**: 使用默认配置
- **PostCSS**: 启用 Tailwind + Autoprefixer

### 组件开发原则
```typescript
// 组件文件命名：PascalCase
// 使用 TypeScript 泛型时明确类型
interface ScriptBlockPanelProps<T> {
  data: T[];
  onSelect: (item: T) => void;
}

// 状态管理使用 Zustand
const useAppStore = create<AppStore>((set) => ({
  scriptBlocks: [],
  addScriptBlock: (block) => set((state) => ({
    scriptBlocks: [...state.scriptBlocks, block]
  }))
}));
```

## 🔌 API 集成规范

### 环境变量配置
```typescript
// 从环境变量读取配置
const config = {
  zhipu: {
    apiKey: import.meta.env.VITE_ZHIPU_API_KEY,
    model: import.meta.env.VITE_ZHIPU_MODEL || 'glm-4-plus'
  },
  nvidia: {
    apiKey: import.meta.env.VITE_NVIDIA_API_KEY,
    model: import.meta.env.VITE_NVIDIA_MODEL || 'meta/llama-3.1-405b-instruct'
  },
  clipService: import.meta.env.VITE_CLIP_SERVICE_URL || 'http://localhost:8000',
  vlmService: import.meta.env.VITE_VLM_SERVICE_URL || 'http://localhost:8001'
};
```

### 服务层模式
```typescript
// 单例模式导出服务
export const llmService = new LLMService({
  provider: 'zhipu', // 或 'nvidia'
  apiKey: config.zhipu.apiKey
});

// 配置切换
export const useZhipu = () => llmService.switchProvider('zhipu');
export const useNvidia = () => llmService.switchProvider('nvidia');
```

## 🧪 测试策略

### 测试文件组织
```
tests/
├── full-e2e-test.js         # 完整端到端测试
├── frontend-flow-test.js    # 前端功能流程测试
├── mvp-api-test.js         # API 接口测试
└── screenshots/            # 测试截图
```

### 测试运行注意事项
- 使用 Playwright 进行浏览器自动化测试
- 测试结果保存为 JSON 和 Markdown 格式
- 截图保存到 `tests/screenshots/` 目录

## ⚠️ 重要约束

### 严格禁止的功能
- 多轨道时间线编辑
- 音频编辑/混音
- 视觉效果和转场
- 复杂渲染参数
- 帧级精度编辑

### MVP 核心功能
- 单轨道时间线拖拽排序
- 镜头替换和占位符机制
- 时长验证和播放预览
- LLM 剧本分析和 CLIP 内容分析

## 📚 参考资源

### 相关文档
- **设计原则**: `.qoder/repowiki/zh/content/项目概述/设计原则与验收标准.md`
- **开发指南**: `.qoder/repowiki/zh/content/开发指南/开发指南.md`
- **MVP 规范**: `.qoder/quests/director-storyboard-validation-mvp.md`
- **使用指南**: `docs/USAGE_GUIDE.md`

### 配置文件
- **TypeScript**: `tsconfig.json`, `tsconfig.node.json`
- **构建工具**: `vite.config.ts`
- **样式**: `tailwind.config.js`, `postcss.config.js`
- **环境变量**: `.env.example`

---

**最后更新**: 2026-01-26  
**维护者**: CGCUT 开发团队  
**版本**: 1.0.0