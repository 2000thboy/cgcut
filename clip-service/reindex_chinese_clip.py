"""
使用Chinese-CLIP重新对素材库进行向量化
目标：提升中文检索效果
"""
import os
import sys
import time
import requests
import torch
import cv2
import numpy as np
from PIL import Image
from pathlib import Path
from typing import List, Dict

# 设置离线模式，使用本地缓存
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

# 加载Chinese-CLIP
print("1. 加载Chinese-CLIP模型（离线模式）...", flush=True)
from transformers import ChineseCLIPModel, ChineseCLIPProcessor

MODEL_NAME = "OFA-Sys/chinese-clip-vit-base-patch16"
try:
    processor = ChineseCLIPProcessor.from_pretrained(MODEL_NAME, local_files_only=True)
    model = ChineseCLIPModel.from_pretrained(MODEL_NAME, local_files_only=True)
    print("   模型加载成功!", flush=True)
except Exception as e:
    print(f"   离线加载失败: {e}", flush=True)
    print("   尝试在线加载...", flush=True)
    os.environ.pop("HF_HUB_OFFLINE", None)
    os.environ.pop("TRANSFORMERS_OFFLINE", None)
    processor = ChineseCLIPProcessor.from_pretrained(MODEL_NAME)
    model = ChineseCLIPModel.from_pretrained(MODEL_NAME)

device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device)
model.eval()

print(f"   模型: {MODEL_NAME}")
print(f"   设备: {device}")

QDRANT_URL = "http://localhost:6333"
COLLECTION_NAME = "video_assets"

def get_image_features(image: Image.Image) -> np.ndarray:
    """获取图像的Chinese-CLIP向量"""
    with torch.no_grad():
        inputs = processor(images=image, return_tensors="pt")
        pixel_values = inputs["pixel_values"].to(device)
        vision_outputs = model.vision_model(pixel_values=pixel_values)
        pooled_output = vision_outputs.last_hidden_state[:, 0, :]
        image_features = model.visual_projection(pooled_output)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        return image_features.cpu().numpy()[0]

def extract_frame(video_path: str, time_sec: float = 1.0) -> Image.Image:
    """从视频中提取关键帧"""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception(f"Cannot open video: {video_path}")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_num = int(time_sec * fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
    
    ret, frame = cap.read()
    cap.release()
    
    if not ret:
        raise Exception(f"Cannot read frame at {time_sec}s")
    
    # BGR to RGB
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    return Image.fromarray(frame_rgb)

def get_all_points():
    """获取Qdrant中所有素材点"""
    all_points = []
    offset = None
    
    while True:
        payload = {
            "limit": 100,
            "with_payload": True,
            "with_vector": False
        }
        if offset is not None:
            payload["offset"] = offset
        
        resp = requests.post(
            f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/scroll",
            json=payload
        )
        resp.raise_for_status()
        result = resp.json()["result"]
        
        points = result.get("points", [])
        all_points.extend(points)
        
        next_offset = result.get("next_page_offset")
        if next_offset is None or len(points) == 0:
            break
        offset = next_offset
    
    return all_points

def update_vector(point_id: int, new_vector: List[float]):
    """更新Qdrant中的向量"""
    resp = requests.put(
        f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/vectors",
        json={
            "points": [
                {"id": point_id, "vector": new_vector}
            ]
        }
    )
    resp.raise_for_status()

def main():
    print("\n2. 获取所有素材...")
    points = get_all_points()
    total = len(points)
    print(f"   共 {total} 个素材")
    
    print("\n3. 开始重新向量化...")
    success_count = 0
    fail_count = 0
    start_time = time.time()
    
    for i, point in enumerate(points):
        point_id = point["id"]
        payload = point["payload"]
        file_path = payload.get("filePath", "")
        
        try:
            # 提取关键帧
            if os.path.exists(file_path):
                image = extract_frame(file_path, time_sec=1.0)
                
                # 获取新向量
                new_vector = get_image_features(image)
                
                # 更新Qdrant
                update_vector(point_id, new_vector.tolist())
                
                success_count += 1
            else:
                fail_count += 1
                
        except Exception as e:
            fail_count += 1
            if i < 5:  # 只打印前5个错误
                print(f"   Error [{point_id}]: {str(e)[:50]}")
        
        # 进度显示
        if (i + 1) % 50 == 0 or (i + 1) == total:
            elapsed = time.time() - start_time
            speed = (i + 1) / elapsed
            eta = (total - i - 1) / speed if speed > 0 else 0
            print(f"   进度: {i+1}/{total} ({(i+1)/total*100:.1f}%) | 成功: {success_count} | 失败: {fail_count} | ETA: {eta:.0f}s")
    
    elapsed = time.time() - start_time
    print(f"\n4. 完成!")
    print(f"   总素材: {total}")
    print(f"   成功: {success_count}")
    print(f"   失败: {fail_count}")
    print(f"   耗时: {elapsed:.1f}s")
    print(f"   速度: {success_count/elapsed:.1f} 个/秒")

if __name__ == "__main__":
    main()
