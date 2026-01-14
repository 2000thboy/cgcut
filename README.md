# cgcut - 导演分镜验证 MVP 工具

一个基于 AI 的影视分镜验证工具，帮助导演快速将剧本转换为可视化分镜预览。

## 🎯 核心功能

- **剧本导入**: 支持 .txt/.json 格式剧本文件
- **AI 分镜拆解**: 使用 LLM (智谱 GLM-4-Plus) 自动生成专业分镜
- **智能素材匹配**: CLIP 模型自动为镜头匹配合适的视频素材
- **可视化时间轴**: 拖拽排序、实时预览
- **视频预览**: 支持多格式视频播放和剪辑

## 🏗️ 技术架构

### 前端
- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** - 样式框架
- **Zustand** - 状态管理
- **@dnd-kit** - 拖拽功能

### 后端服务
- **CLIP 服务** (Python + FastAPI) - 视频内容分析和向量搜索
- **VLM 服务** (Python + FastAPI) - 视频描述生成
- **LLM 服务** - 智谱 AI GLM-4-Plus 剧本分析

## 🚀 快速开始

### 1. 环境准备

#### 方法一：使用 PowerShell 一键安装（推荐）

```powershell
# 在 PowerShell 中运行
.\setup-environment.ps1
```

#### 方法二：手动安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 Python 依赖 (CLIP 服务)
cd clip-service
pip install -r requirements.txt

# 安装 Python 依赖 (VLM 服务)
cd ../vlm-service
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的 API 密钥
# VITE_ZHIPU_API_KEY=your_zhipu_api_key_here
```

### 3. 启动服务

```bash
# 启动前端 (终端1)
npm run dev

# 启动 CLIP 服务 (终端2)
cd clip-service && python clip_server.py

# 启动 VLM 服务 (终端3)
cd vlm-service && python vlm_server.py
```

### 4. 访问应用

打开浏览器访问: http://localhost:5173/

## 📋 使用流程

1. **导入剧本**: 点击"导入剧本"按钮，选择 .txt 文件
2. **AI 分析**: 等待 LLM 自动分析剧本并生成分镜 (10-30秒)
3. **加载素材**: 在右侧素材库中加载视频素材
4. **匹配素材**: 拖拽素材到时间轴对应的镜头
5. **预览播放**: 点击播放按钮预览分镜效果
6. **导出项目**: 保存或导出项目文件

## 🔧 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 5173 | React 开发服务器 |
| CLIP | 8000 | 视频分析服务 |
| VLM | 8001 | 视频描述服务 |

## 📁 项目结构

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

## 🧪 测试

```bash
# 运行完整 E2E 测试
node tests/full-e2e-test.js

# 运行前端流程测试
node tests/frontend-flow-test.js

# 运行 MVP API 测试
node tests/mvp-api-test.js
```

## 📊 MVP 状态

- ✅ 前端功能完成度: **100%**
- ✅ 后端服务: **CLIP + VLM + LLM 全部就绪**
- ✅ 核心流程: **剧本导入 → AI分镜 → 素材匹配 → 预览播放**
- ✅ 测试覆盖: **API测试 + E2E测试 + 前端流程测试**

## 🔑 API 配置

### 智谱 AI (推荐)
- 注册: https://open.bigmodel.cn/
- 模型: GLM-4-Plus
- 配置: `VITE_ZHIPU_API_KEY`

### NVIDIA (备选)
- 注册: https://build.nvidia.com/
- 模型: Llama 3.1 405B
- 配置: `VITE_NVIDIA_API_KEY`

## 📖 文档

- [API 测试报告](docs/API_TEST_REPORT.md)
- [前端功能完成度报告](docs/FRONTEND_COMPLETION_REPORT.md)
- [MVP 测试报告](docs/MVP_TEST_REPORT.md)
- [使用指南](docs/USAGE_GUIDE.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**开发状态**: MVP 完成 ✅  
**最后更新**: 2026-01-10