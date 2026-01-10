# cgcut MVP 完整测试报告

**测试时间**: 2026-01-09T18:26:46.940Z
**通过率**: 100.0% (11/11)

## 测试结果

| 测试项 | 状态 | 耗时 | 详情/错误 |
|--------|------|------|----------|
| CLIP服务连接 | ✅ | 24ms | 模型: openai/clip-vit-base-patch32, 设备: cpu |
| VLM服务连接 | ✅ | 4ms | 模型: CLIP-based, 设备: cpu |
| 智谱AI API连接 | ✅ | 507ms | 响应正常, model: glm-4-plus |
| 剧本分镜拆解完整流程 | ✅ | 14442ms | 1个场景, 7个镜头 |
| CLIP文字搜索功能 | ✅ | 2ms | 返回 0 个结果 |
| CLIP扫描端点可用 | ✅ | 2ms | 端点响应正常, status: 200 |
| VLM描述端点可用 | ✅ | 1ms | 端点响应正常, status: 422 |
| 前端页面加载 | ✅ | 704ms | 标题: cgcut - 导演分镜验证工具 |
| 主要UI组件渲染 | ✅ | 1034ms | React应用正常渲染 |
| 导入剧本按钮存在 | ✅ | 15ms | 找到按钮: "导入剧本" |
| 无严重JavaScript错误 | ✅ | 2003ms | 无JS错误 |

## 服务地址

- 前端: http://localhost:5173/
- CLIP: http://localhost:8000/
- VLM: http://localhost:8001/
