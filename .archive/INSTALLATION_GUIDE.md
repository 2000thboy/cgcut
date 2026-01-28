# cgcut 项目安装和配置指南

## 系统要求

在开始安装之前，请确保您的系统满足以下要求：

- Windows 10/11 或更高版本
- 至少 8GB RAM（推荐 16GB）
- 至少 5GB 可用磁盘空间
- 管理员权限（用于安装软件）

## 第一步：安装 Node.js 和 npm

cgcut 前端使用 React + Vite 构建，需要 Node.js 环境：

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 LTS 版本（推荐 18.x 或更高版本）
3. 运行安装程序并按照提示完成安装
4. 验证安装：
   ```cmd
   node --version
   npm --version
   ```

## 第二步：安装 Python 3.9+

cgcut 后端服务（CLIP 和 VLM）使用 Python + FastAPI 构建：

1. 访问 [Python 官网](https://www.python.org/downloads/)
2. 下载 Python 3.9、3.10 或 3.11（避免使用最新版本以确保兼容性）
3. 运行安装程序，注意勾选 "Add Python to PATH"
4. 验证安装：
   ```cmd
   python --version
   pip --version
   ```

## 第三步：克隆或下载项目

如果您还没有项目文件，请克隆或下载项目：

```cmd
git clone <repository-url>
# 或者直接下载 ZIP 文件并解压
```

## 第四步：安装前端依赖

1. 打开命令提示符或 PowerShell
2. 导航到项目根目录：
   ```cmd
   cd f:\100qoder project\CGCUT
   ```
3. 安装前端依赖：
   ```cmd
   npm install
   ```

## 第五步：安装后端服务依赖

### CLIP 服务安装

1. 导航到 CLIP 服务目录：
   ```cmd
   cd f:\100qoder project\CGCUT\clip-service
   ```
2. 创建虚拟环境（推荐）：
   ```cmd
   python -m venv venv
   ```
3. 激活虚拟环境：
   ```cmd
   venv\Scripts\activate
   ```
4. 安装依赖：
   ```cmd
   pip install -r requirements.txt
   ```

### VLM 服务安装

1. 导航到 VLM 服务目录：
   ```cmd
   cd f:\100qoder project\CGCUT\vlm-service
   ```
2. 激活相同的虚拟环境（如果仍在 CLIP 服务环境中）：
   ```cmd
   ..\clip-service\venv\Scripts\activate
   ```
3. 安装依赖：
   ```cmd
   pip install -r requirements.txt
   ```

## 第六步：配置 API 密钥

1. 在项目根目录复制 `.env.example` 文件为 `.env`：
   ```cmd
   copy .env.example .env
   ```
2. 编辑 `.env` 文件并填入您的 API 密钥：
   - 访问 [智谱 AI 开放平台](https://open.bigmodel.cn/) 获取 API 密钥
   - 填入 `VITE_ZHIPU_API_KEY=your_actual_api_key_here`

## 第七步：启动服务

### 方法一：分别启动服务

1. **启动 CLIP 服务（端口 8000）**：

   ```cmd
   cd f:\100qoder project\CGCUT\clip-service
   venv\Scripts\activate
   python clip_server.py
   ```

2. **启动 VLM 服务（端口 8001）**：

   ```cmd
   cd f:\100qoder project\CGCUT\vlm-service
   python vlm_server.py
   ```

3. **启动前端（端口 5173）**：
   ```cmd
   cd f:\100qoder project\CGCUT
   npm run dev
   ```

### 方法二：使用批处理脚本

项目中包含启动脚本，您可以使用它们：

1. **启动 CLIP 服务**：

   ```cmd
   cd f:\100qoder project\CGCUT\clip-service
   start-clip-service.bat
   ```

2. **启动 VLM 服务**：
   ```cmd
   cd f:\100qoder project\CGCUT\vlm-service
   start-vlm-service.bat
   ```

## 第八步：验证安装

1. 确认 CLIP 服务运行：访问 http://localhost:8000/
2. 确认 VLM 服务运行：访问 http://localhost:8001/
3. 确认前端运行：访问 http://localhost:5173/
4. 所有服务都应该正常响应

## IDE 配置建议

### VS Code 推荐插件

- **ESLint** - JavaScript/TypeScript 代码检查
- **Prettier** - 代码格式化
- **Tailwind CSS IntelliSense** - Tailwind CSS 支持
- **Python** - Python 语言支持
- **Jest** - JavaScript 测试框架支持
- **GitHub Copilot** - AI 辅助编程

### 配置文件

项目已包含以下配置文件：

- `tsconfig.json` - TypeScript 配置
- `vite.config.ts` - Vite 构建配置
- `tailwind.config.js` - Tailwind CSS 配置
- `.gitignore` - Git 忽略文件配置

## 常见问题及解决方案

### 1. 权限错误

如果遇到权限错误，请以管理员身份运行命令提示符或 PowerShell。

### 2. 端口占用

如果端口 8000、8001 或 5173 被占用，请终止占用进程或修改配置。

### 3. 依赖安装失败

- 确保网络连接正常
- 尝试使用国内镜像源：
  ```cmd
  npm config set registry https://registry.npmmirror.com
  pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple/
  ```

### 4. Python 路径问题

如果系统中有多个 Python 版本，请确保使用正确的 Python 版本：

```cmd
py -3.9 --version  # Windows
python3.9 --version  # macOS/Linux
```

## 故障排除

如果遇到问题，请检查以下几点：

1. **环境变量**：确保 Node.js、npm 和 Python 都已正确添加到 PATH
2. **防火墙设置**：确保本地端口（5173、8000、8001）未被阻止
3. **杀毒软件**：某些杀毒软件可能会阻止本地服务运行
4. **磁盘空间**：确保有足够的磁盘空间安装依赖

## 验证完整安装

完成上述步骤后，您应该能够：

1. 前端在 http://localhost:5173 正常运行
2. CLIP 服务在 http://localhost:8000 正常运行
3. VLM 服务在 http://localhost:8001 正常运行
4. 所有按钮都能正常调用对应的 API 服务
5. 剧本导入、AI 分镜拆解、素材匹配等功能正常工作

## 下一步

安装完成后，您可以：

1. 测试所有 UI 按钮的功能
2. 导入剧本文件进行 AI 分镜拆解
3. 添加视频素材并进行匹配
4. 查看时间轴和预览功能
5. 运行项目提供的测试套件
