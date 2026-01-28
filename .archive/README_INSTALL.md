# cgcut 项目安装指南

## 项目概述

cgcut 是一个 AI 驱动的影视分镜验证工具，帮助导演快速将剧本转换为可视化分镜预览。

## 一键安装

我们提供了 PowerShell 脚本来自动化安装所有依赖：

### 在 PowerShell 中运行：

```powershell
.\install-all.ps1
```

此脚本将自动：

- 检查并安装 Node.js（如果未安装）
- 检查并安装 Python（如果未安装）
- 安装前端依赖（npm install）
- 为后端服务创建 Python 虚拟环境
- 安装 CLIP 和 VLM 服务依赖
- 配置环境文件

## 手动安装步骤

如果您不想使用一键安装脚本，也可以手动安装：

### 1. 系统要求

- Node.js (v16.0 或更高版本)
- Python (v3.9 或更高版本)
- npm (通常随 Node.js 一起安装)
- pip (通常随 Python 一起安装)

### 2. 安装前端依赖

```bash
npm install
```

### 3. 安装后端依赖

```bash
# 安装 CLIP 服务依赖
cd clip-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# 安装 VLM 服务依赖
cd ../vlm-service
../clip-service/venv/Scripts/activate
pip install -r requirements.txt
```

### 4. 配置环境变量

复制 `.env.example` 文件并重命名为 `.env`，然后填入您的 API 密钥：

- `VITE_ZHIPU_API_KEY`: 智谱 AI API 密钥

## 启动服务

### 1. 启动 CLIP 服务

```bash
cd clip-service
python clip_server.py
```

### 2. 启动 VLM 服务

```bash
cd vlm-service
python vlm_server.py
```

### 3. 启动前端

```bash
npm run dev
```

或者使用一键启动脚本：

```bash
.\start-all-services.bat
```

## API 端点

- 前端: http://localhost:5173
- CLIP 服务: http://localhost:8000
- VLM 服务: http://localhost:8001

## 功能验证

所有前端按钮都已连接到真实的 API 端点：

- **导入剧本**: 调用智谱 AI API 进行 AI 分镜拆解
- **素材库功能**: 调用 CLIP 服务 API 进行视频分析
- **视频描述**: 调用 VLM 服务 API 生成描述
- **保存/导出**: 本地存储 API

## IDE 配置

项目已配置 VS Code 设置，包括：

- 自动导入
- 代码格式化
- 错误检查
- 类型提示

## 故障排除

如果遇到问题：

1. 检查 Node.js 和 Python 是否正确安装并添加到 PATH
2. 运行 `verify-setup.ps1` 检查环境配置
3. 确保防火墙没有阻止本地端口
4. 检查 `.env` 文件中的 API 密钥是否正确配置

## 项目文件

- `install-all.ps1`: 一键安装脚本
- `start-all-services.bat`: 一键启动所有服务
- `full-setup.bat`: 完整设置向导
- `verify-setup.ps1`: 环境验证脚本
