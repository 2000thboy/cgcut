# CGCUT AI 模型使用指南

> 本指南涵盖项目中使用的所有 AI 模型的配置和使用方法
> 更新时间：2026-01-15

---

## 1. 模型概览

| 服务 | 端口 | 模型                         | 用途                             |
| ---- | ---- | ---------------------------- | -------------------------------- |
| CLIP | 8000 | openai/clip-vit-base-patch32 | 视频内容编码、标签生成、向量搜索 |
| VLM  | 8001 | nvidia/neva-22b              | 视频自然语言描述生成             |
| LLM  | 云端 | zhipu/glm-4-plus             | 剧本分析、分镜拆解               |

---

## 2. CLIP 服务 (端口 8000)

### 2.1 模型信息

- **模型**: OpenAI CLIP ViT-B/32
- **向量维度**: 512
- **支持设备**: CPU/CUDA

### 2.2 核心功能

#### 视频打标

```bash
POST /clip/process
{
    "file_path": "U:/PreVis_Assets/video.mp4",
    "extract_keyframes": true
}
```

**返回**:

```json
{
    "file_path": "...",
    "embeddings": [0.1, 0.2, ...],  // 512维向量
    "tags": ["特写镜头", "人物", "紧张"],
    "description": "室内场景，人物特写，情绪紧张",
    "emotions": ["紧张"],
    "processed_at": "2026-01-15T12:00:00"
}
```

#### 批量扫描

```bash
POST /clip/scan
{
    "directory": "U:/PreVis_Assets/originals/动漫素材",
    "file_patterns": ["*.mp4", "*.mov"],
    "skip_processed": true,
    "batch_size": 5
}
```

#### 向量搜索

```bash
POST /clip/search
{
    "query": "一个人在黑暗的走廊中行走",
    "top_k": 10,
    "threshold": 0.2,
    "filter_tags": ["紧张", "恐惧"]
}
```

### 2.3 预定义标签库

```
景别: 特写镜头, 近景镜头, 中景镜头, 全景镜头, 远景镜头
场景: 室内场景, 室外场景, 街道, 房间, 自然风景, 办公室, 城市
人物: 人物, 面部特写, 手部特写, 群体场景, 无人场景
动作: 行走, 奔跑, 静坐, 对话交流, 工作, 休息
情绪: 紧张, 平静, 激动, 悲伤, 快乐, 恐惧, 中性
光线: 明亮, 昏暗, 自然光, 人工光
时间: 白天, 夜晚, 黄昏, 清晨
```

### 2.4 使用建议

- **批处理**: 大量素材使用 batch_size=5-10
- **阈值调整**: 搜索无结果时降低 threshold 到 0.15
- **GPU 加速**: 有 CUDA 时自动使用 GPU

---

## 3. VLM 服务 (端口 8001)

### 3.1 模型信息

- **模型**: NVIDIA neva-22b
- **API**: NVIDIA AI Endpoints (云端)
- **需要**: NVIDIA_API_KEY

### 3.2 核心功能

#### 单个视频描述

```bash
POST /vlm/describe
{
    "file_path": "U:/PreVis_Assets/video.mp4",
    "prompt": "详细描述这个视频画面的内容，包括场景、人物、动作、情绪氛围等"
}
```

**返回**:

```json
{
  "description": "室内办公场景，一个穿着西装的男性坐在电脑前，神情焦虑，灯光昏暗，营造出紧张的氛围",
  "model": "nvidia/neva-22b",
  "processed_at": "2026-01-15T12:00:00"
}
```

#### 批量描述

```bash
POST /vlm/batch
{
    "directory": "U:/PreVis_Assets/originals",
    "file_patterns": ["*.mp4"]
}
```

### 3.3 环境配置

```env
# vlm-service/.env
NVIDIA_API_KEY=nvapi-xxxxx
```

### 3.4 降级机制

- API 不可用时自动使用 Mock 描述
- Mock 描述格式: "场景类型，主体类型，氛围情绪"

### 3.5 使用建议

- **缓存结果**: 避免重复调用相同视频
- **Prompt 优化**: 根据需求定制 prompt 获取更精确描述
- **配合 CLIP**: VLM 描述补充 CLIP 标签

---

## 4. LLM 服务 (智谱 AI)

### 4.1 模型信息

- **模型**: GLM-4-Plus
- **API**: 智谱 AI 开放平台
- **需要**: VITE_ZHIPU_API_KEY

### 4.2 核心功能

#### 剧本分镜拆解

输入剧本文本，输出结构化分镜数据。

**请求参数**:

```typescript
{
    scriptContent: string,    // 剧本内容
    fileName: string,         // 文件名
    options: {
        language: 'zh',
        includeEmotions: true
    }
}
```

**返回格式**:

```json
{
  "scenes": [
    {
      "id": "scene_1",
      "name": "INT. 办公室 - 夜晚",
      "blocks": [
        {
          "id": "block_1_1",
          "text": "[全景] 办公室内，荧光灯发出微弱的嗡嗡声...",
          "emotion": "焦虑",
          "expected_duration": 6.0
        }
      ]
    }
  ]
}
```

### 4.3 环境配置

```env
# 项目根目录 .env
VITE_ZHIPU_API_KEY=your-api-key
```

### 4.4 分镜拆解规则

- 每场景 3-10 个镜头
- 镜头格式: `[景别] 描述 | 情绪 | 时长`
- 情绪标签: 紧张、焦虑、恐惧、释然、平静、愤怒、悲伤、喜悦

### 4.5 使用建议

- **温度参数**: 0.3（保证格式一致）
- **超时设置**: 180 秒（处理长剧本）
- **结果校验**: 使用 JSON 修复引擎处理格式问题

---

## 5. 服务间协作流程

### 5.1 完整工作流

```
剧本.txt
    ↓
[LLM] 智谱AI分镜拆解
    ↓
分镜数据 (ScriptBlock[])
    ↓
[CLIP] 向量搜索匹配素材
    ↓
素材匹配结果
    ↓
[VLM] 补充素材描述 (可选)
    ↓
时间轴编辑
    ↓
视频导出
```

### 5.2 素材入库流程

```
视频文件
    ↓
[CLIP] 关键帧提取 + 向量编码
    ↓
[CLIP] 自动标签生成
    ↓
[VLM] 自然语言描述 (可选)
    ↓
存储元数据 (.clip.json)
```

### 5.3 智能匹配流程

```
分镜描述 (如"办公室内，主角焦虑地看着电脑")
    ↓
[CLIP] 文本向量编码
    ↓
与素材库向量计算余弦相似度
    ↓
按情绪标签过滤
    ↓
返回Top-K匹配结果
```

---

## 6. API 调用示例 (Python)

### 6.1 CLIP 搜索

```python
import requests

# 向量搜索
response = requests.post(
    "http://localhost:8000/clip/search",
    json={
        "query": "紧张的办公室场景",
        "top_k": 5,
        "threshold": 0.2
    }
)
results = response.json()
```

### 6.2 VLM 描述

```python
# 生成描述
response = requests.post(
    "http://localhost:8001/vlm/describe",
    json={
        "file_path": "U:/PreVis_Assets/video.mp4",
        "prompt": "描述画面内容和情绪氛围"
    }
)
description = response.json()["description"]
```

### 6.3 前端调用

```typescript
// src/services/clipService.ts
const results = await clipService.searchByText({
  query: "紧张的追逐场景",
  top_k: 10,
});

// src/services/taggingService.ts
const metadata = await taggingService.processFile(filePath);
```

---

## 7. 性能优化

### 7.1 CLIP 优化

- 批量处理: `batch_size=5-10`
- 跳过已处理: `skip_processed=true`
- GPU 加速: 自动检测 CUDA

### 7.2 VLM 优化

- 本地缓存描述结果
- 异步批量处理
- 降级机制确保可用性

### 7.3 LLM 优化

- 分段处理长剧本
- 结果缓存
- 重试机制

---

## 8. 故障排查

### 8.1 CLIP 服务问题

| 问题       | 可能原因 | 解决方案               |
| ---------- | -------- | ---------------------- |
| 搜索无结果 | 阈值过高 | 降低 threshold 到 0.15 |
| 处理慢     | CPU 运算 | 安装 CUDA 支持         |
| 标签不准   | 模型限制 | 结合 VLM 描述          |

### 8.2 VLM 服务问题

| 问题      | 可能原因    | 解决方案            |
| --------- | ----------- | ------------------- |
| 返回 Mock | API 未配置  | 检查 NVIDIA_API_KEY |
| 超时      | 网络问题    | 增加 timeout 设置   |
| 描述不准  | Prompt 不当 | 优化 prompt 内容    |

### 8.3 LLM 服务问题

| 问题          | 可能原因     | 解决方案           |
| ------------- | ------------ | ------------------ |
| JSON 解析失败 | 格式错误     | 启用 JSON 修复引擎 |
| 镜头数不足    | 模型理解问题 | 优化 system prompt |
| 超时          | 剧本过长     | 分段处理           |

---

## 9. 模型更新指南

### 9.1 更换 CLIP 模型

```python
# clip_server.py
MODEL_NAME = "openai/clip-vit-large-patch14"  # 更大的模型
```

### 9.2 更换 VLM 模型

```python
# vlm_server.py
self.model_name = "nvidia/llama-3.2-11b-vision-instruct"  # 其他VLM
```

### 9.3 更换 LLM 模型

```typescript
// src/services/llmService.ts
model: "glm-4-flash"; // 更快的模型
```

---

_本指南随项目迭代持续更新_
