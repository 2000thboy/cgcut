"""
批量补充情绪和场景标签到现有素材
从Qdrant读取素材 -> 重新打标 -> 更新Qdrant
"""
import json
import requests
from typing import List, Dict, Any
from pathlib import Path
import sys

# 添加父目录到路径
sys.path.insert(0, '.')

# 情绪映射：从CLIP检测的情绪氛围 -> 简化标签
EMOTION_MAPPING = {
    "紧张氛围": "紧张",
    "平静氛围": "平静", 
    "激动氛围": "激动",
    "悲伤氛围": "悲伤",
    "快乐氛围": "快乐",
    "恐惧氛围": "恐惧",
    "中性氛围": "中性",
    "愤怒氛围": "愤怒",
}

# 场景类型扩展映射
SCENE_EXPANSION = {
    "办公室": ["室内场景", "工作场所"],
    "房间": ["室内场景"],
    "街道": ["室外场景", "城市"],
    "自然风景": ["室外场景"],
}


def get_all_points_from_qdrant(collection_name: str = "video_assets", batch_size: int = 100) -> List[Dict]:
    """从Qdrant获取所有点"""
    base_url = "http://127.0.0.1:6333"
    all_points = []
    offset = None
    
    while True:
        payload = {
            "limit": batch_size,
            "with_payload": True,
            "with_vector": True
        }
        if offset:
            payload["offset"] = offset
            
        resp = requests.post(
            f"{base_url}/collections/{collection_name}/points/scroll",
            json=payload
        )
        resp.raise_for_status()
        result = resp.json()["result"]
        
        points = result.get("points", [])
        if not points:
            break
            
        all_points.extend(points)
        offset = result.get("next_page_offset")
        
        if not offset:
            break
            
        print(f"已加载 {len(all_points)} 个素材...")
    
    return all_points


def detect_emotion_from_description(description: str) -> List[str]:
    """从描述中推断情绪标签"""
    emotions = []
    desc_lower = description.lower()
    
    # 关键词匹配
    if any(kw in desc_lower for kw in ["紧张", "恐惧", "惊恐", "战斗", "追逐"]):
        emotions.append("紧张")
    if any(kw in desc_lower for kw in ["平静", "宁静", "祥和", "日常"]):
        emotions.append("平静")
    if any(kw in desc_lower for kw in ["激动", "兴奋", "热血", "战斗"]):
        emotions.append("激动")
    if any(kw in desc_lower for kw in ["悲伤", "哭泣", "伤心", "悲痛"]):
        emotions.append("悲伤")
    if any(kw in desc_lower for kw in ["快乐", "开心", "欢乐", "微笑"]):
        emotions.append("快乐")
    if any(kw in desc_lower for kw in ["恐惧", "害怕", "惊吓", "阴森"]):
        emotions.append("恐惧")
        
    return emotions if emotions else ["中性"]


def expand_scene_tags(tags: List[str]) -> List[str]:
    """扩展场景标签"""
    expanded = set(tags)
    
    for tag in tags:
        if tag in SCENE_EXPANSION:
            expanded.update(SCENE_EXPANSION[tag])
    
    # 根据现有标签推断更多场景
    if "昏暗光线" in tags or "夜晚" in tags:
        expanded.add("昏暗场景")
    if "明亮光线" in tags or "白天" in tags:
        expanded.add("明亮场景")
    if "行走" in tags or "奔跑" in tags:
        expanded.add("动态场景")
    if "静坐" in tags or "休息" in tags:
        expanded.add("静态场景")
        
    return list(expanded)


def update_points_in_qdrant(points: List[Dict], collection_name: str = "video_assets"):
    """批量更新Qdrant中的点"""
    base_url = "http://127.0.0.1:6333"
    
    # 准备更新数据
    updates = []
    for point in points:
        updates.append({
            "id": point["id"],
            "vector": point["vector"],
            "payload": point["payload"]
        })
    
    # 批量更新
    batch_size = 100
    for i in range(0, len(updates), batch_size):
        batch = updates[i:i+batch_size]
        resp = requests.put(
            f"{base_url}/collections/{collection_name}/points",
            json={"points": batch}
        )
        resp.raise_for_status()
        print(f"已更新 {min(i+batch_size, len(updates))}/{len(updates)} 个素材...")


def main():
    print("=" * 50)
    print("批量补充情绪和场景标签")
    print("=" * 50)
    
    # 1. 获取所有素材
    print("\n[1/3] 从Qdrant加载素材...")
    points = get_all_points_from_qdrant()
    print(f"共加载 {len(points)} 个素材")
    
    # 2. 补充标签
    print("\n[2/3] 补充情绪和场景标签...")
    updated_count = 0
    emotion_added = 0
    scene_added = 0
    
    for point in points:
        payload = point.get("payload", {})
        tags = payload.get("tags", [])
        description = payload.get("description", "")
        emotions = payload.get("emotions", [])
        
        original_tags_count = len(tags)
        original_emotions_count = len(emotions)
        
        # 补充情绪标签
        if not emotions or emotions == []:
            new_emotions = detect_emotion_from_description(description)
            payload["emotions"] = new_emotions
            emotion_added += 1
        
        # 扩展场景标签
        expanded_tags = expand_scene_tags(tags)
        if len(expanded_tags) > original_tags_count:
            payload["tags"] = expanded_tags
            scene_added += 1
        
        point["payload"] = payload
        updated_count += 1
    
    print(f"处理完成: {updated_count} 个素材")
    print(f"  - 补充情绪标签: {emotion_added} 个")
    print(f"  - 扩展场景标签: {scene_added} 个")
    
    # 3. 更新到Qdrant
    print("\n[3/3] 更新到Qdrant...")
    update_points_in_qdrant(points)
    
    print("\n" + "=" * 50)
    print("标签补充完成!")
    print("=" * 50)


if __name__ == "__main__":
    main()
