"""
使用VLM为素材生成更精准的中文描述
目标：提升检索效果的语义匹配
"""
import os
import sys
import time
import requests
from typing import List, Dict

QDRANT_URL = "http://localhost:6333"
VLM_URL = "http://localhost:8001"
COLLECTION_NAME = "video_assets"

def get_sample_points(limit: int = 20):
    """获取样本素材"""
    resp = requests.post(
        f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/scroll",
        json={
            "limit": limit,
            "with_payload": True,
            "with_vector": False
        }
    )
    resp.raise_for_status()
    return resp.json()["result"]["points"]

def vlm_describe(file_path: str, prompt: str = None) -> str:
    """调用VLM服务生成描述"""
    payload = {"file_path": file_path}
    if prompt:
        payload["prompt"] = prompt
    
    resp = requests.post(
        f"{VLM_URL}/vlm/describe",
        json=payload,
        timeout=60
    )
    resp.raise_for_status()
    return resp.json()["description"]

def update_payload(point_id: int, new_fields: Dict):
    """更新Qdrant中的payload字段"""
    resp = requests.post(
        f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points/payload",
        json={
            "points": [point_id],
            "payload": new_fields
        }
    )
    resp.raise_for_status()

def main():
    print("=== VLM素材描述增强 ===\n")
    
    # 1. 检查服务
    print("1. 检查服务状态...")
    try:
        resp = requests.get(f"{VLM_URL}/vlm", timeout=5)
        vlm_status = resp.json()
        print(f"   VLM服务: {vlm_status.get('status')}")
        print(f"   模型: {vlm_status.get('model')}")
    except Exception as e:
        print(f"   VLM服务不可用: {e}")
        print("   请先启动VLM服务 (端口8001)")
        return
    
    # 2. 获取样本
    print("\n2. 获取样本素材...")
    points = get_sample_points(limit=10)
    print(f"   获取 {len(points)} 个素材")
    
    # 3. 为每个素材生成描述
    print("\n3. 生成VLM描述...")
    
    # 定制prompt，让VLM生成更适合检索的描述
    prompt = """请用简洁的中文描述这个视频画面，包括：
1. 场景类型（室内/室外/城市/自然等）
2. 主要物体或人物
3. 动作或状态
4. 氛围或情绪
请直接输出描述，不要解释。"""
    
    success_count = 0
    for i, point in enumerate(points):
        point_id = point["id"]
        payload = point["payload"]
        file_path = payload.get("filePath", "")
        old_desc = payload.get("description", "")
        
        print(f"\n   [{i+1}/{len(points)}] ID: {point_id}")
        print(f"   文件: ...{file_path[-50:]}")
        print(f"   旧描述: {old_desc[:50]}")
        
        if not os.path.exists(file_path):
            print(f"   跳过: 文件不存在")
            continue
        
        try:
            start = time.time()
            new_desc = vlm_describe(file_path, prompt)
            elapsed = time.time() - start
            
            print(f"   新描述: {new_desc[:80]}")
            print(f"   耗时: {elapsed:.1f}s")
            
            # 更新到Qdrant
            update_payload(point_id, {
                "vlm_description": new_desc,
                "vlm_updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
            })
            
            success_count += 1
            
        except Exception as e:
            print(f"   错误: {str(e)[:50]}")
    
    print(f"\n4. 完成!")
    print(f"   成功: {success_count}/{len(points)}")

if __name__ == "__main__":
    main()
