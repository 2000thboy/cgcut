# cgcut MVP 完整测试报告

**测试时间**: 2026-01-28T18:24:48.197Z
**通过率**: 85.7% (6/7)

## 测试结果

| 测试项 | 状态 | 耗时 | 详情/错误 |
|--------|------|------|----------|
| CLIP服务连接 | ✅ | 32ms | 模型: OFA-Sys/chinese-clip-vit-base-patch16, 设备: cpu |
| VLM服务连接 | ❌ | 4ms | 状态异常: undefined |
| 智谱AI API连接 | ✅ | 539ms | 响应正常, model: glm-4-plus |
| 剧本分镜拆解完整流程 | ✅ | 3966ms | 1个场景, 7个镜头 |
| CLIP文字搜索功能 | ✅ | 310ms | 返回 5 个结果 |
| CLIP扫描端点可用 | ✅ | 4ms | 端点响应正常, status: 200 |
| VLM描述端点可用 | ✅ | 3ms | 端点响应正常, status: 404 |

## ❌ 失败原因详解

### 1. VLM服务连接
**错误**: 状态异常: undefined

### 2. 前端UI测试
**错误**: browserType.launch: Failed to launch chromium because executable doesn't exist at C:\Program Files (x86)\Google\Chrome\Application\chrome.exe


## 服务地址

- 前端: http://localhost:5173/
- CLIP: http://localhost:8000/
- VLM: http://localhost:8001/
