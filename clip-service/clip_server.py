"""
CLIP视频打标服务
用于视频素材的自动标签生成、场景描述、情绪识别

打标原理：
1. 使用OpenAI CLIP模型（ViT-B/32）
2. 将视频关键帧编码为512维向量
3. 将预定义标签文本也编码为向量
4. 计算余弦相似度，选择最匹配的标签

支持的标签类型：
- 景别：特写、近景、中景、全景、远景
- 场景：室内、室外、街道、房间、自然
- 人物：人物、面部、手部、群体
- 动作：行走、奔跑、静坐、对话
- 情绪：紧张、平静、激动、悲伤、快乐、恐惧
"""

import os
import json
import logging
from typing import List, Dict, Optional
from pathlib import Path
from datetime import datetime

import torch
import numpy as np
from PIL import Image
import cv2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from transformers import CLIPProcessor, CLIPModel

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI应用
app = FastAPI(
    title="CLIP视频打标服务",
    description="基于OpenAI CLIP模型的视频内容分析和自动标签生成",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# 预定义标签库
# ============================================
PREDEFINED_TAGS = {
    "shot_type": ["特写镜头", "近景镜头", "中景镜头", "全景镜头", "远景镜头"],
    "scene": ["室内场景", "室外场景", "街道", "房间", "自然风景", "办公室", "城市"],
    "subject": ["人物", "面部特写", "手部特写", "群体场景", "无人场景"],
    "action": ["行走", "奔跑", "静坐", "对话交流", "工作", "休息"],
    "emotion": ["紧张氛围", "平静氛围", "激动氛围", "悲伤氛围", "快乐氛围", "恐惧氛围", "中性氛围"],
    "lighting": ["明亮光线", "昏暗光线", "自然光", "人工光"],
    "time": ["白天", "夜晚", "黄昏", "清晨"],
}

# 所有标签平铺列表
ALL_TAGS = []
for category, tags in PREDEFINED_TAGS.items():
    ALL_TAGS.extend(tags)

# ============================================
# CLIP模型管理
# ============================================
class CLIPModelManager:
    def __init__(self, model_name: str = "openai/clip-vit-base-patch32"):
        self.model_name = model_name
        self.model = None
        self.processor = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tag_embeddings = None
        
    def load_model(self):
        """加载CLIP模型"""
        if self.model is not None:
            return
            
        logger.info(f"加载CLIP模型: {self.model_name}")
        logger.info(f"使用设备: {self.device}")
        
        self.processor = CLIPProcessor.from_pretrained(self.model_name)
        self.model = CLIPModel.from_pretrained(self.model_name).to(self.device)
        self.model.eval()
        
        # 预计算标签embeddings
        self._precompute_tag_embeddings()
        
        logger.info("✅ CLIP模型加载完成")
        
    def _precompute_tag_embeddings(self):
        """预计算所有标签的文本embeddings"""
        logger.info("预计算标签embeddings...")
        
        with torch.no_grad():
            inputs = self.processor(text=ALL_TAGS, return_tensors="pt", padding=True)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            text_features = self.model.get_text_features(**inputs)
            self.tag_embeddings = text_features / text_features.norm(dim=-1, keepdim=True)
            
        logger.info(f"✅ 预计算完成, 标签数: {len(ALL_TAGS)}")
        
    def encode_image(self, image: Image.Image) -> np.ndarray:
        """编码图像为CLIP向量"""
        with torch.no_grad():
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            image_features = self.model.get_image_features(**inputs)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            return image_features.cpu().numpy()[0]
            
    def get_tags(self, image: Image.Image, top_k: int = 5) -> List[Dict]:
        """获取图像的标签（基于相似度）"""
        with torch.no_grad():
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            image_features = self.model.get_image_features(**inputs)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
            # 计算相似度
            similarities = (image_features @ self.tag_embeddings.T).squeeze(0)
            
            # 获取top-k标签
            top_indices = similarities.argsort(descending=True)[:top_k]
            
            results = []
            for idx in top_indices:
                tag = ALL_TAGS[idx.item()]
                score = similarities[idx].item()
                results.append({"tag": tag, "confidence": round(score, 3)})
                
            return results
            
    def get_tags_by_category(self, image: Image.Image) -> Dict[str, str]:
        """按类别获取最佳标签"""
        with torch.no_grad():
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            image_features = self.model.get_image_features(**inputs)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
            results = {}
            for category, tags in PREDEFINED_TAGS.items():
                # 计算该类别标签的embeddings
                cat_inputs = self.processor(text=tags, return_tensors="pt", padding=True)
                cat_inputs = {k: v.to(self.device) for k, v in cat_inputs.items()}
                cat_features = self.model.get_text_features(**cat_inputs)
                cat_features = cat_features / cat_features.norm(dim=-1, keepdim=True)
                
                # 计算相似度
                similarities = (image_features @ cat_features.T).squeeze(0)
                best_idx = similarities.argmax().item()
                results[category] = tags[best_idx]
                
            return results

    def generate_description(self, image: Image.Image) -> str:
        """生成图像描述"""
        tags_by_cat = self.get_tags_by_category(image)
        
        # 组合描述
        parts = []
        if tags_by_cat.get("scene"):
            parts.append(tags_by_cat["scene"])
        if tags_by_cat.get("shot_type"):
            parts.append(tags_by_cat["shot_type"])
        if tags_by_cat.get("subject"):
            parts.append(tags_by_cat["subject"])
        if tags_by_cat.get("emotion"):
            parts.append(tags_by_cat["emotion"])
            
        return "，".join(parts) if parts else "通用镜头"
        
    def detect_emotions(self, image: Image.Image) -> List[str]:
        """检测情绪"""
        emotion_tags = PREDEFINED_TAGS["emotion"]
        
        with torch.no_grad():
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            image_features = self.model.get_image_features(**inputs)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
            em_inputs = self.processor(text=emotion_tags, return_tensors="pt", padding=True)
            em_inputs = {k: v.to(self.device) for k, v in em_inputs.items()}
            em_features = self.model.get_text_features(**em_inputs)
            em_features = em_features / em_features.norm(dim=-1, keepdim=True)
            
            similarities = (image_features @ em_features.T).squeeze(0)
            
            # 返回相似度>0.2的情绪
            emotions = []
            for i, score in enumerate(similarities):
                if score > 0.2:
                    emotions.append(emotion_tags[i].replace("氛围", ""))
            
            return emotions if emotions else ["中性"]

    def encode_text(self, text: str) -> np.ndarray:
        """编码文本为CLIP向量"""
        with torch.no_grad():
            inputs = self.processor(text=[text], return_tensors="pt", padding=True)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            text_features = self.model.get_text_features(**inputs)
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)
            return text_features.cpu().numpy()[0]

    def compute_similarity(self, text_embedding: np.ndarray, image_embedding: List[float]) -> float:
        """计算文本和图像向量的余弦相似度"""
        image_emb = np.array(image_embedding)
        # 归一化
        text_norm = text_embedding / (np.linalg.norm(text_embedding) + 1e-8)
        image_norm = image_emb / (np.linalg.norm(image_emb) + 1e-8)
        return float(np.dot(text_norm, image_norm))

# 全局模型实例
clip_manager = CLIPModelManager()

# ============================================
# API数据模型
# ============================================
class ScanRequest(BaseModel):
    directory: str
    file_patterns: List[str] = ["*.mp4", "*.mov", "*.avi"]
    skip_processed: bool = True
    extract_keyframes: bool = True
    model_version: str = "ViT-B/32"
    batch_size: int = 5

class ProcessRequest(BaseModel):
    file_path: str
    extract_keyframes: bool = True
    model_version: str = "ViT-B/32"

class ListRequest(BaseModel):
    directory: str
    file_patterns: List[str] = ["*.mp4", "*.mov", "*.avi"]
    limit: int = 0  # 0 表示不限制
    get_duration: bool = False

class SearchRequest(BaseModel):
    """文字搜索请求"""
    query: str                          # 搜索文本，如"一个人在街上行走"
    top_k: int = 10                     # 返回结果数量
    threshold: float = 0.0             # 相似度阈值，低于此值不返回
    filter_tags: Optional[List[str]] = None  # 可选：按标签过滤

class CLIPMetadata(BaseModel):
    embeddings: List[float]
    tags: List[str]
    description: str
    emotions: List[str]
    keyframes: Optional[List[str]] = None
    processed_at: str
    model_version: str

# ============================================
# 视频处理工具
# ============================================
def extract_keyframes_from_video(video_path: str, num_frames: int = 3) -> List[Image.Image]:
    """从视频中提取关键帧"""
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        raise ValueError(f"无法打开视频: {video_path}")
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if total_frames == 0:
        raise ValueError(f"视频帧数为0: {video_path}")
    
    # 均匀采样帧
    frame_indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)
    
    frames = []
    for idx in frame_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if ret:
            # BGR转RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(Image.fromarray(frame_rgb))
    
    cap.release()
    return frames

def get_video_files(directory: str, patterns: List[str]) -> List[str]:
    """获取目录下的视频文件"""
    video_files = []
    dir_path = Path(directory)
    
    if not dir_path.exists():
        return video_files
    
    for pattern in patterns:
        # 移除通配符前缀
        ext = pattern.replace("*", "")
        for file_path in dir_path.rglob(f"*{ext}"):
            video_files.append(str(file_path))
    
    return video_files

def get_video_duration(video_path: str) -> float:
    """获取视频时长（秒）"""
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return 5.0
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        cap.release()
        if fps > 0:
            return frame_count / fps
        return 5.0
    except:
        return 5.0

# ============================================
# API路由
# ============================================

# 处理结果存储路径
RESULTS_FILE = Path(__file__).parent / "clip_results.json"

@app.get("/", response_class=HTMLResponse)
async def admin_page():
    """返回管理后台页面"""
    template_path = Path(__file__).parent / "templates" / "admin.html"
    if template_path.exists():
        return HTMLResponse(content=template_path.read_text(encoding='utf-8'))
    return HTMLResponse(content="<h1>CLIP Service Running</h1><p>Admin template not found</p>")

@app.get("/clip")
async def clip_status():
    """CLIP服务状态"""
    return {
        "status": "ok",
        "model": clip_manager.model_name,
        "device": clip_manager.device,
        "tags_count": len(ALL_TAGS),
        "categories": list(PREDEFINED_TAGS.keys())
    }

class SaveResultsRequest(BaseModel):
    results: List[Dict]

@app.post("/clip/save-results")
async def save_results(request: SaveResultsRequest):
    """保存处理结果到JSON文件"""
    try:
        # 加载现有结果
        existing = []
        if RESULTS_FILE.exists():
            with open(RESULTS_FILE, 'r', encoding='utf-8') as f:
                existing = json.load(f)
        
        # 合并新结果（按文件路径去重）
        existing_paths = {r.get('filePath') for r in existing}
        for result in request.results:
            if result.get('filePath') not in existing_paths:
                existing.append(result)
            else:
                # 更新已存在的
                for i, e in enumerate(existing):
                    if e.get('filePath') == result.get('filePath'):
                        existing[i] = result
                        break
        
        # 保存
        with open(RESULTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
        
        logger.info(f"保存了 {len(request.results)} 个结果，总计 {len(existing)} 个")
        
        return {"status": "success", "saved": len(request.results), "total": len(existing)}
    except Exception as e:
        logger.error(f"保存结果失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/clip/results")
async def get_results():
    """获取已处理的结果"""
    if not RESULTS_FILE.exists():
        return {"results": [], "total": 0}
    
    with open(RESULTS_FILE, 'r', encoding='utf-8') as f:
        results = json.load(f)
    
    return {"results": results, "total": len(results)}

# ============================================
# 文字搜索视频片段 API
# ============================================
@app.post("/clip/search")
async def search_by_text(request: SearchRequest):
    """
    用文字描述搜索视频片段
    
    原理：
    1. 将用户输入的文字编码为CLIP向量
    2. 与已处理视频的图像向量计算余弦相似度
    3. 返回相似度最高的视频片段
    
    示例查询：
    - "一个人在街上行走"
    - "室内对话场景"
    - "夜晚的城市"
    - "紧张的氛围"
    """
    logger.info(f"文字搜索: '{request.query}', top_k={request.top_k}")
    
    # 确保模型已加载
    clip_manager.load_model()
    
    # 加载已处理的结果
    if not RESULTS_FILE.exists():
        return {
            "status": "success",
            "query": request.query,
            "results": [],
            "total": 0,
            "message": "暂无已处理的视频数据，请先使用 /clip/scan 扫描视频目录"
        }
    
    with open(RESULTS_FILE, 'r', encoding='utf-8') as f:
        all_results = json.load(f)
    
    if not all_results:
        return {
            "status": "success",
            "query": request.query,
            "results": [],
            "total": 0,
            "message": "暂无已处理的视频数据"
        }
    
    # 编码查询文本
    query_embedding = clip_manager.encode_text(request.query)
    
    # 计算相似度
    matches = []
    for item in all_results:
        # 检查是否有embeddings
        clip_metadata = item.get('clipMetadata', {})
        embeddings = clip_metadata.get('embeddings')
        
        if not embeddings:
            continue
        
        # 标签过滤
        if request.filter_tags:
            item_tags = clip_metadata.get('tags', [])
            if not any(tag in item_tags for tag in request.filter_tags):
                continue
        
        # 计算相似度
        similarity = clip_manager.compute_similarity(query_embedding, embeddings)
        
        # 阈值过滤
        if similarity < request.threshold:
            continue
        
        matches.append({
            "filePath": item.get('filePath'),
            "shotId": item.get('shotId'),
            "label": item.get('label', Path(item.get('filePath', '')).stem),
            "similarity": round(similarity, 4),
            "tags": clip_metadata.get('tags', []),
            "description": clip_metadata.get('description', ''),
            "emotions": clip_metadata.get('emotions', []),
            "duration": item.get('duration', 5.0)
        })
    
    # 按相似度排序
    matches.sort(key=lambda x: x['similarity'], reverse=True)
    
    # 取top_k
    top_matches = matches[:request.top_k]
    
    logger.info(f"搜索完成: 找到 {len(top_matches)} 个匹配结果")
    
    return {
        "status": "success",
        "query": request.query,
        "results": top_matches,
        "total": len(top_matches),
        "searched": len(all_results)
    }

@app.get("/clip/search")
async def search_by_text_get(query: str, top_k: int = 10, threshold: float = 0.0):
    """GET方式的文字搜索（便于浏览器测试）"""
    request = SearchRequest(query=query, top_k=top_k, threshold=threshold)
    return await search_by_text(request)

@app.post("/clip/search-multi")
async def search_multi_query(queries: List[str], top_k: int = 5):
    """
    多条件组合搜索
    
    将多个查询的相似度加权平均，找到同时满足多个条件的视频
    
    示例：queries=["室内场景", "两个人对话", "平静氛围"]
    """
    logger.info(f"多条件搜索: {queries}")
    
    clip_manager.load_model()
    
    if not RESULTS_FILE.exists():
        return {"status": "success", "results": [], "total": 0}
    
    with open(RESULTS_FILE, 'r', encoding='utf-8') as f:
        all_results = json.load(f)
    
    # 编码所有查询
    query_embeddings = [clip_manager.encode_text(q) for q in queries]
    
    matches = []
    for item in all_results:
        clip_metadata = item.get('clipMetadata', {})
        embeddings = clip_metadata.get('embeddings')
        
        if not embeddings:
            continue
        
        # 计算每个查询的相似度，取平均
        similarities = [
            clip_manager.compute_similarity(qe, embeddings) 
            for qe in query_embeddings
        ]
        avg_similarity = sum(similarities) / len(similarities)
        
        matches.append({
            "filePath": item.get('filePath'),
            "shotId": item.get('shotId'),
            "label": item.get('label', Path(item.get('filePath', '')).stem),
            "similarity": round(avg_similarity, 4),
            "query_scores": {q: round(s, 4) for q, s in zip(queries, similarities)},
            "tags": clip_metadata.get('tags', []),
            "description": clip_metadata.get('description', ''),
            "duration": item.get('duration', 5.0)
        })
    
    matches.sort(key=lambda x: x['similarity'], reverse=True)
    
    return {
        "status": "success",
        "queries": queries,
        "results": matches[:top_k],
        "total": len(matches[:top_k])
    }

@app.post("/clip/list")
async def list_files(request: ListRequest):
    """快速列出目录中的视频文件（不做CLIP处理）"""
    logger.info(f"快速列出目录: {request.directory}")
    
    video_files = get_video_files(request.directory, request.file_patterns)
    logger.info(f"发现 {len(video_files)} 个视频文件")
    
    # 限制数量（0表示不限制）
    if request.limit > 0:
        video_files = video_files[:request.limit]
    
    files = []
    for i, file_path in enumerate(video_files):
        file_name = Path(file_path).stem
        duration = get_video_duration(file_path) if request.get_duration else 5.0
        
        files.append({
            "filePath": file_path,
            "shotId": f"shot_{hash(file_path) % 1000000}",
            "label": file_name,
            "duration": round(duration, 1),
            "status": "pending"
        })
        
        # 每处理100个文件输出一次日志
        if (i + 1) % 100 == 0:
            logger.info(f"已处理 {i + 1}/{len(video_files)} 个文件")
    
    logger.info(f"列表完成，共 {len(files)} 个文件")
    
    return {
        "status": "success",
        "files": files,
        "summary": {
            "totalFiles": len(files),
            "directory": request.directory
        }
    }

@app.get("/clip")
async def clip_status():
    """CLIP服务状态"""
    return {
        "status": "ok",
        "model": clip_manager.model_name,
        "device": clip_manager.device,
        "tags_count": len(ALL_TAGS),
        "categories": list(PREDEFINED_TAGS.keys())
    }

@app.post("/clip/scan")
async def scan_directory(request: ScanRequest):
    """批量扫描并处理目录中的视频"""
    logger.info(f"扫描目录: {request.directory}")
    
    # 确保模型已加载
    clip_manager.load_model()
    
    # 获取视频文件
    video_files = get_video_files(request.directory, request.file_patterns)
    logger.info(f"发现 {len(video_files)} 个视频文件")
    
    processed_files = []
    failed_count = 0
    
    for video_path in video_files:
        try:
            # 提取关键帧
            frames = extract_keyframes_from_video(video_path, num_frames=3)
            
            if not frames:
                failed_count += 1
                continue
            
            # 使用中间帧进行分析
            main_frame = frames[len(frames) // 2]
            
            # 获取标签
            tags_result = clip_manager.get_tags(main_frame, top_k=5)
            tags = [t["tag"] for t in tags_result]
            
            # 获取描述
            description = clip_manager.generate_description(main_frame)
            
            # 获取情绪
            emotions = clip_manager.detect_emotions(main_frame)
            
            # 获取embeddings
            embeddings = clip_manager.encode_image(main_frame).tolist()
            
            from datetime import datetime
            
            metadata = {
                "embeddings": embeddings,
                "tags": tags,
                "description": description,
                "emotions": emotions,
                "keyframes": None,  # 可选保存关键帧
                "processed_at": datetime.now().isoformat(),
                "model_version": request.model_version,
            }
            
            processed_files.append({
                "filePath": video_path,
                "shotId": f"shot_{hash(video_path) % 100000}",
                "clipMetadata": metadata,
                "status": "success"
            })
            
        except Exception as e:
            logger.error(f"处理失败 {video_path}: {e}")
            failed_count += 1
            processed_files.append({
                "filePath": video_path,
                "shotId": f"shot_{hash(video_path) % 100000}",
                "clipMetadata": {},
                "status": "error",
                "error": str(e)
            })
    
    return {
        "status": "success",
        "processedFiles": processed_files,
        "summary": {
            "totalFiles": len(video_files),
            "processed": len(video_files) - failed_count,
            "skipped": 0,
            "failed": failed_count,
            "processingTime": 0
        }
    }

@app.post("/clip/process")
async def process_single_file(request: ProcessRequest):
    """处理单个视频文件"""
    logger.info(f"处理文件: {request.file_path}")
    
    # 确保模型已加载
    clip_manager.load_model()
    
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"文件不存在: {request.file_path}")
    
    try:
        # 提取关键帧
        frames = extract_keyframes_from_video(request.file_path, num_frames=3)
        
        if not frames:
            raise HTTPException(status_code=400, detail="无法从视频提取帧")
        
        # 使用中间帧进行分析
        main_frame = frames[len(frames) // 2]
        
        # 获取标签
        tags_result = clip_manager.get_tags(main_frame, top_k=5)
        tags = [t["tag"] for t in tags_result]
        
        # 获取描述
        description = clip_manager.generate_description(main_frame)
        
        # 获取情绪
        emotions = clip_manager.detect_emotions(main_frame)
        
        # 获取embeddings
        embeddings = clip_manager.encode_image(main_frame).tolist()
        
        from datetime import datetime
        
        return {
            "embeddings": embeddings,
            "tags": tags,
            "description": description,
            "emotions": emotions,
            "keyframes": None,
            "processed_at": datetime.now().isoformat(),
            "model_version": request.model_version,
        }
        
    except Exception as e:
        logger.error(f"处理失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# 启动服务
# ============================================
if __name__ == "__main__":
    import uvicorn
    
    print("=" * 50)
    print("CLIP视频打标服务")
    print("=" * 50)
    print(f"模型: {clip_manager.model_name}")
    print(f"设备: {clip_manager.device}")
    print(f"标签类别: {len(PREDEFINED_TAGS)}")
    print(f"标签总数: {len(ALL_TAGS)}")
    print("=" * 50)
    
    # 预加载模型
    clip_manager.load_model()
    
    # 启动服务
    uvicorn.run(app, host="0.0.0.0", port=8000)
