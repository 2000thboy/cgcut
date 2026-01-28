# cgcut 项目设置说明

本项目包含多个自动化工具来帮助您完成安装和配置。

## 可用工具

### 1. 完整设置向导

- **文件**: `full-setup.bat`
- **功能**: 交互式菜单，引导您完成所有设置步骤
- **运行方法**: 双击运行或在命令行中执行

### 2. 自动化安装脚本

- **文件**: `auto-setup.ps1` 和 `run-auto-setup.bat`
- **功能**: 自动检查并安装 Node.js、Python 和项目依赖
- **运行方法**: 以管理员身份运行 `run-auto-setup.bat`

### 3. 配置验证脚本

- **文件**: `verify-setup.ps1`
- **功能**: 检查系统环境和项目配置状态
- **运行方法**: `powershell -ExecutionPolicy Bypass -File "verify-setup.ps1"`

### 4. 一键启动脚本

- **文件**: `start-all-services.bat`
- **功能**: 同时启动前端、CLIP 和 VLM 服务
- **运行方法**: 双击运行

### 5. 依赖安装脚本

- **文件**: `install-dependencies.bat`
- **功能**: 安装前端和后端的所有依赖
- **运行方法**: 双击运行

## 推荐设置流程

### 方案一：使用完整设置向导（推荐）

1. 运行 `full-setup.bat`
2. 选择选项 5 运行完整设置流程
3. 按照提示操作

### 方案二：手动逐步设置

1. 首先运行环境验证: `verify-setup.ps1`
2. 如缺少必要环境，安装 Node.js 和 Python
3. 运行自动化安装: `auto-setup.ps1`
4. 验证安装结果: `verify-setup.ps1`
5. 配置环境变量（编辑 `.env` 文件）
6. 启动服务: `start-all-services.bat`

## 注意事项

- 某些操作可能需要管理员权限
- 安装 Node.js 和 Python 时，请确保勾选 "Add to PATH" 选项
- 需要有效的智谱 AI API 密钥才能使用 LLM 服务
- 首次安装可能需要较长时间，特别是下载大型依赖包时

## API 端点和功能

所有前端按钮都连接到真实的 API 端点：

- 剧本导入 → 智谱 AI API
- 素材库功能 → CLIP 服务 (localhost:8000)
- 视频描述 → VLM 服务 (localhost:8001)

## IDE 配置

项目已配置 VS Code 设置，包括：

- 自动导入
- 代码格式化
- 错误检查
- 类型提示

安装完成后，您可以直接使用 cgcut 项目的所有功能。
