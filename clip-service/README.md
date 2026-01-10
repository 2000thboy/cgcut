# CLIP视频打标服务

## 打标原理

### 使用的模型
**OpenAI CLIP (ViT-B/32)**
- 模型大小: ~400MB
- 向量维度: 512维
- 支持: 图像编码 + 文本编码

### 打标流程

```
视频文件
    ↓
[1] 关键帧提取 (OpenCV)
    - 均匀采样3帧
    - 选取中间帧作为代表
    ↓
[2] 图像编码 (CLIP ViT-B/32)
    - 输入: 224x224 RGB图像
    - 输出: 512维归一化向量
    ↓
[3] 标签匹配 (余弦相似度)
    - 预定义标签也编码为向量
    - 计算图像向量与标签向量相似度
    - 选择相似度最高的标签
    ↓
[4] 输出元数据
    - tags: 匹配的标签列表
    - description: 组合描述
    - emotions: 情绪标签
    - embeddings: 512维向量(用于相似搜索)
```

### 预定义标签库

| 类别 | 标签 |
|------|------|
| 景别 | 特写、近景、中景、全景、远景 |
| 场景 | 室内、室外、街道、房间、自然、办公室、城市 |
| 主体 | 人物、面部、手部、群体、无人 |
| 动作 | 行走、奔跑、静坐、对话、工作、休息 |
| 情绪 | 紧张、平静、激动、悲伤、快乐、恐惧、中性 |
| 光线 | 明亮、昏暗、自然光、人工光 |
| 时间 | 白天、夜晚、黄昏、清晨 |

## 快速启动

### 前置要求
- Python 3.9+
- 首次启动需下载CLIP模型(~400MB)
- 推荐: NVIDIA GPU (CUDA) 加速

### 启动服务

```bash
# Windows
双击 start-clip-service.bat

# 或手动启动
cd clip-service
pip install -r requirements.txt
python clip_server.py
```

### 验证服务
```bash
# 检查状态
curl http://localhost:8000/clip

# 查看API文档
浏览器打开: http://localhost:8000/docs
```

## API接口

### GET /clip
获取服务状态

### POST /clip/scan
批量扫描目录
```json
{
  "directory": "D:/Videos",
  "file_patterns": ["*.mp4", "*.mov"],
  "skip_processed": true
}
```

### POST /clip/process
处理单个文件
```json
{
  "file_path": "D:/Videos/scene_01.mp4",
  "extract_keyframes": true
}
```

### POST /clip/search ⭐ 新增
用文字描述搜索视频片段（类似 VCED 的核心功能）
```json
{
  "query": "一个人在街上行走",
  "top_k": 10,
  "threshold": 0.2,
  "filter_tags": ["室外场景"]
}
```

返回示例：
```json
{
  "status": "success",
  "query": "一个人在街上行走",
  "results": [
    {
      "filePath": "D:/Videos/walk_01.mp4",
      "shotId": "shot_12345",
      "similarity": 0.3245,
      "tags": ["室外场景", "人物", "行走"],
      "description": "室外场景，中景镜头，人物，平静氛围"
    }
  ],
  "total": 5
}
```

### GET /clip/search
GET方式搜索（便于浏览器测试）
```
http://localhost:8000/clip/search?query=夜晚的城市&top_k=5
```

### POST /clip/search-multi
多条件组合搜索
```json
{
  "queries": ["室内场景", "两个人对话", "平静氛围"],
  "top_k": 5
}
```

## 返回数据示例

```json
{
  "embeddings": [0.012, -0.034, ...],  // 512维向量
  "tags": ["室内场景", "中景镜头", "人物", "平静氛围"],
  "description": "室内场景，中景镜头，人物，平静氛围",
  "emotions": ["平静"],
  "processed_at": "2026-01-08T19:20:00",
  "model_version": "ViT-B/32"
}
```

## 性能参考

| 配置 | 处理速度 |
|------|----------|
| CPU only | ~2秒/帧 |
| GTX 1060 | ~0.3秒/帧 |
| RTX 3080 | ~0.1秒/帧 |

## 扩展

### 自定义标签
编辑 `clip_server.py` 中的 `PREDEFINED_TAGS` 字典

### 使用更强模型
- ViT-L/14: 更高精度，更慢
- ViT-B/16: 平衡选择
- open-clip: 支持更多模型变体
