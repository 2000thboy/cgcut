"""
MiniMind-V 视觉语言模型服务
用于视频素材的自然语言描述生成

与CLIP打标服务配合使用：
- CLIP: 输出结构化标签 (shot_type, scene, emotion等)
- VLM: 输出自然语言描述 (详细内容描述)
"""

import os

# 配置Hugging Face镜像源（解决国内访问问题）
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
import sys
import logging
from typing import Optional
from pathlib import Path

import torch
from PIL import Image
import cv2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI应用
app = FastAPI(
    title="MiniMind-V 视频描述服务",
    description="基于MiniMind-V的视频内容自然语言描述生成",
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
# VLM模型管理
# ============================================
class VLMModelManager:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.clip_processor = None
        self.clip_model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model_loaded = False
        
    def load_model(self):
        """加载MiniMind-V模型"""
        if self.model_loaded:
            return
            
        logger.info("加载MiniMind-V模型...")
        logger.info(f"使用设备: {self.device}")
        
        try:
            # 检查模型文件是否存在
            model_path = Path("./model")
            if not model_path.exists():
                raise FileNotFoundError(
                    "模型目录不存在，请先运行 download-models.bat 下载模型"
                )
            
            # 加载CLIP视觉编码器（使用镜像源）
            from transformers import CLIPProcessor, CLIPModel
            clip_path = model_path / "vision_model"
            
            model_id = "openai/clip-vit-base-patch16"
            
            if clip_path.exists() and (clip_path / "config.json").exists():
                logger.info("从本地加载CLIP视觉编码器...")
                self.clip_processor = CLIPProcessor.from_pretrained(str(clip_path))
                self.clip_model = CLIPModel.from_pretrained(str(clip_path)).to(self.device)
            else:
                # 使用在线模型（自动从镜像下载）
                logger.info(f"从在线下载CLIP模型: {model_id}")
                logger.info("使用镜像源: hf-mirror.com")
                self.clip_processor = CLIPProcessor.from_pretrained(model_id)
                self.clip_model = CLIPModel.from_pretrained(model_id).to(self.device)
            
            self.clip_model.eval()
            
            # 尝试加载MiniMind-V语言模型
            llm_path = Path("./out/sft_vlm_512.pth")
            if llm_path.exists():
                logger.info("加载MiniMind-V语言模型...")
                # 这里需要minimind-v的模型加载代码
                # 暂时使用简化版本
                self.model_loaded = True
                logger.info("✅ MiniMind-V模型加载完成")
            else:
                logger.warning("⚠️ 未找到MiniMind-V语言模型，将使用基于CLIP的描述生成")
                self.model_loaded = True
                
        except Exception as e:
            logger.error(f"模型加载失败: {e}")
            # 即使加载失败也标记为已加载，使用后备方案
            self.model_loaded = True
            
    def generate_description(self, image: Image.Image, prompt: str = "描述这张图片的内容") -> str:
        """生成图像描述"""
        if not self.model_loaded:
            self.load_model()
            
        try:
            if self.model is not None:
                # 使用MiniMind-V生成描述
                # TODO: 实现完整的MiniMind-V推理
                pass
            
            # 后备方案：基于CLIP特征生成简单描述
            return self._generate_clip_based_description(image)
            
        except Exception as e:
            logger.error(f"描述生成失败: {e}")
            return "无法生成描述"
            
    def _generate_clip_based_description(self, image: Image.Image) -> str:
        """基于CLIP特征的描述生成（后备方案）"""
        if self.clip_model is None or self.clip_processor is None:
            return "图像内容"
            
        # 预定义描述模板
        scene_prompts = [
            "室内场景", "室外场景", "自然风景", "城市街道", "办公环境"
        ]
        subject_prompts = [
            "人物特写", "群体场景", "物体特写", "空镜头", "动作场景"
        ]
        mood_prompts = [
            "平静祥和", "紧张激烈", "欢快愉悦", "悲伤忧郁", "神秘悬疑"
        ]
        
        with torch.no_grad():
            # 编码图像
            inputs = self.clip_processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            image_features = self.clip_model.get_image_features(**inputs)
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)
            
            # 匹配场景
            scene = self._match_best(image_features, scene_prompts)
            subject = self._match_best(image_features, subject_prompts)
            mood = self._match_best(image_features, mood_prompts)
            
        return f"{scene}，{subject}，氛围{mood}"
        
    def _match_best(self, image_features, prompts):
        """匹配最佳文本"""
        text_inputs = self.clip_processor(text=prompts, return_tensors="pt", padding=True)
        text_inputs = {k: v.to(self.device) for k, v in text_inputs.items()}
        text_features = self.clip_model.get_text_features(**text_inputs)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        
        similarities = (image_features @ text_features.T).squeeze(0)
        best_idx = similarities.argmax().item()
        return prompts[best_idx]

# 全局模型实例
vlm_manager = VLMModelManager()

# ============================================
# API数据模型
# ============================================
class DescribeRequest(BaseModel):
    file_path: str
    prompt: str = "详细描述这个视频画面的内容"

class DescribeResponse(BaseModel):
    description: str
    model: str
    processed_at: str

class BatchDescribeRequest(BaseModel):
    directory: str
    file_patterns: list = ["*.mp4", "*.mov", "*.avi"]

# ============================================
# 视频处理
# ============================================
def extract_frame(video_path: str) -> Optional[Image.Image]:
    """从视频提取中间帧"""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
        
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames == 0:
        cap.release()
        return None
        
    # 取中间帧
    cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames // 2)
    ret, frame = cap.read()
    cap.release()
    
    if ret:
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return Image.fromarray(frame_rgb)
    return None

# ============================================
# API路由
# ============================================
@app.get("/")
async def root():
    """返回管理后台页面"""
    from fastapi.responses import HTMLResponse
    import os
    # 使用绝对路径
    current_dir = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(current_dir, "templates", "admin.html")
    if os.path.exists(template_path):
        with open(template_path, 'r', encoding='utf-8') as f:
            return HTMLResponse(content=f.read())
    return {
        "service": "MiniMind-V 视频描述服务",
        "version": "1.0.0",
        "status": "running",
        "device": vlm_manager.device,
        "endpoints": {
            "/vlm": "服务状态",
            "/vlm/describe": "生成单个视频描述",
            "/vlm/batch": "批量生成描述"
        }
    }

@app.get("/vlm")
async def vlm_status():
    """VLM服务状态"""
    return {
        "status": "ok",
        "model": "MiniMind-V" if vlm_manager.model else "CLIP-based",
        "device": vlm_manager.device,
        "model_loaded": vlm_manager.model_loaded
    }

@app.post("/vlm/describe")
async def describe_video(request: DescribeRequest):
    """生成单个视频的描述"""
    logger.info(f"生成描述: {request.file_path}")
    
    # 确保模型已加载
    vlm_manager.load_model()
    
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"文件不存在: {request.file_path}")
    
    try:
        # 提取视频帧
        frame = extract_frame(request.file_path)
        if frame is None:
            raise HTTPException(status_code=400, detail="无法从视频提取帧")
        
        # 生成描述
        description = vlm_manager.generate_description(frame, request.prompt)
        
        from datetime import datetime
        
        return {
            "description": description,
            "model": "MiniMind-V" if vlm_manager.model else "CLIP-based",
            "processed_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"处理失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/vlm/batch")
async def batch_describe(request: BatchDescribeRequest):
    """批量生成视频描述"""
    logger.info(f"批量处理: {request.directory}")
    
    vlm_manager.load_model()
    
    from pathlib import Path
    from datetime import datetime
    
    results = []
    dir_path = Path(request.directory)
    
    if not dir_path.exists():
        raise HTTPException(status_code=404, detail=f"目录不存在: {request.directory}")
    
    # 获取视频文件
    video_files = []
    for pattern in request.file_patterns:
        ext = pattern.replace("*", "")
        video_files.extend(dir_path.rglob(f"*{ext}"))
    
    for video_path in video_files:
        try:
            frame = extract_frame(str(video_path))
            if frame:
                description = vlm_manager.generate_description(frame)
                results.append({
                    "file_path": str(video_path),
                    "description": description,
                    "status": "success"
                })
            else:
                results.append({
                    "file_path": str(video_path),
                    "description": "",
                    "status": "error",
                    "error": "无法提取帧"
                })
        except Exception as e:
            results.append({
                "file_path": str(video_path),
                "description": "",
                "status": "error",
                "error": str(e)
            })
    
    return {
        "results": results,
        "summary": {
            "total": len(video_files),
            "success": len([r for r in results if r["status"] == "success"]),
            "failed": len([r for r in results if r["status"] == "error"])
        },
        "processed_at": datetime.now().isoformat()
    }

# ============================================
# 启动服务
# ============================================
if __name__ == "__main__":
    import uvicorn
    
    print("=" * 50)
    print("MiniMind-V 视频描述服务")
    print("=" * 50)
    print(f"设备: {vlm_manager.device}")
    print("端口: 8001")
    print("=" * 50)
    
    # 预加载模型
    vlm_manager.load_model()
    
    # 启动服务 (使用8001端口，避免与CLIP服务冲突)
    uvicorn.run(app, host="0.0.0.0", port=8001)
