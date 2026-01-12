# GitHub 上传指南

项目文件已经准备就绪，只需按照以下步骤完成上传：

## 第一步：在 GitHub 上创建仓库

1. 访问 https://github.com/new
2. 登录您的 GitHub 账户 (2000thboy)
3. 创建一个新的仓库，命名为 `cgcut`
4. 设置为公共仓库
5. **不要**初始化仓库（不添加 README、.gitignore 或 license）

## 第二步：推送项目

完成仓库创建后，在终端中运行以下命令：

```bash
git push -u origin main
```

## 验证上传

推送完成后，您应该能够在 GitHub 上看到以下内容：

- 项目源代码（src/, clip-service/, vlm-service/ 等）
- 配置文件（package.json, vite.config.ts 等）
- 文档和测试文件
- README.md 文件

## 项目概述

CGCUT 是一个导演分镜验证工具，具备以下特性：

- 剧本分析功能
- CLIP 服务用于视频片段标记
- VLM 服务用于视觉语言模型
- 智谱AI 集成
- 前端 React/Vite 应用
- 时间轴和镜头库组件

---

恭喜！您的项目现在已经准备好上传到 GitHub。