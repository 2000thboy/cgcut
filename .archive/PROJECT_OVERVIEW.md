# cgcut 项目概述

## 项目简介

cgcut 是一个 AI 驱动的影视分镜验证工具，帮助导演快速将剧本转换为可视化分镜预览。

## 技术架构

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **状态管理**: Zustand
- **拖拽功能**: @dnd-kit
- **后端服务**:
  - CLIP 服务 (Python + FastAPI) - 视频内容分析
  - VLM 服务 (Python + FastAPI) - 视频描述生成
  - LLM 服务 - 智谱 AI GLM-4-Plus 剧本分析

## 项目结构

```
cgcut/
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── services/          # API 服务层
│   ├── store/             # 状态管理
│   └── types/             # TypeScript 类型
├── clip-service/          # CLIP 视频分析服务
├── vlm-service/           # VLM 视频描述服务
├── tests/                 # 测试文件
├── docs/                  # 文档
└── scripts/               # 启动脚本
```

## 主要功能模块

### 1. 前端组件

- **[App.tsx](file:///f:/100qoder%20project/CGCUT/src/App.tsx)** - 主应用组件
- **[ScriptBlockPanel.tsx](file:///f:/100qoder%20project/CGCUT/src/components/ScriptBlockPanel.tsx)** - 剧本段落面板
- **[SimpleTimeline.tsx](file:///f:/100qoder%20project/CGCUT/src/components/SimpleTimeline.tsx)** - 时间轴组件
- **[ShotLibrary.tsx](file:///f:/100qoder%20project/CGCUT/src/components/ShotLibrary.tsx)** - 素材库组件

### 2. 服务层

- **[llmService.ts](file:///f:/100qoder%20project/CGCUT/src/services/llmService.ts)** - LLM 剧本分析服务
- **[clipService.ts](file:///f:/100qoder%20project/CGCUT/src/services/clipService.ts)** - CLIP 视频分析服务
- **[taggingService.ts](file:///f:/100qoder%20project/CGCUT/src/services/taggingService.ts)** - 统一打标服务
- **[searchService.ts](file:///f:/100qoder%20project/CGCUT/src/services/searchService.ts)** - 搜索服务

### 3. 状态管理

- **[appStore.ts](file:///f:/100qoder%20project/CGCUT/src/store/appStore.ts)** - 应用全局状态管理

### 4. 数据模型

- **[DataModel.ts](file:///f:/100qoder%20project/CGCUT/src/types/DataModel.ts)** - 数据类型定义

## API 端点

### CLIP 服务 (localhost:8000)

- `GET /clip` - 服务状态
- `POST /clip/process` - 处理单个视频
- `POST /clip/scan` - 批量扫描
- `POST /clip/search` - 文字搜索视频
- `POST /clip/list` - 快速列出文件

### VLM 服务 (localhost:8001)

- `GET /vlm` - 服务状态
- `POST /vlm/describe` - 生成视频描述

### 前端 API 调用

- 智谱 AI API - 剧本分镜拆解
- 本地 CLIP/VLM 服务 - 素材分析

## 启动说明

1. **安装依赖**: 运行 `install-dependencies.bat`
2. **启动服务**: 运行 `start-all-services.bat`
3. **访问应用**: 打开 http://localhost:5173

## 文件说明

- **[INSTALLATION_GUIDE.md](file:///f:/100qoder%20project/CGCUT/INSTALLATION_GUIDE.md)** - 详细安装指南
- **[system-check.js](file:///f:/100qoder%20project/CGCUT/system-check.js)** - 系统环境检查工具
- **[install-dependencies.bat](file:///f:/100qoder%20project/CGCUT/install-dependencies.bat)** - 依赖安装脚本
- **[start-all-services.bat](file:///f:/100qoder%20project/CGCUT/start-all-services.bat)** - 一键启动脚本

## 按钮功能与 API 映射

1. **导入剧本**: 调用 LLM 服务进行 AI 分镜拆解
2. **一键检查**: 检查项目完整性和状态
3. **导出项目**: 本地 JSON 文件导出
4. **保存项目**: localStorage 保存
5. **素材库功能**: 调用 CLIP 服务进行视频分析
