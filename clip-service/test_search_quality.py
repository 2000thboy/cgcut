"""
检索效果诊断脚本
测试不同查询方式的效果
"""
import os
import sys
import json
import requests

# 配置
CLIP_SERVICE = "http://localhost:8000"
QDRANT_SERVICE = "http://localhost:6333"

def test_clip_search(query: str, limit: int = 5):
    """测试CLIP语义搜索"""
    print(f"\n{'='*60}")
    print(f"测试查询: {query}")
    print(f"{'='*60}")
    
    try:
        # 调用CLIP搜索API
        response = requests.post(
            f"{CLIP_SERVICE}/clip/search",
            json={
                "query": query,
                "limit": limit,
                "threshold": 0.1  # 低阈值，看看能搜到什么
            },
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"CLIP服务返回错误: {response.status_code}")
            print(response.text)
            return None
            
        result = response.json()
        
        if result.get("status") == "success" and result.get("results"):
            print(f"\n找到 {len(result['results'])} 个结果:")
            for i, match in enumerate(result['results'][:limit]):
                # 字段名是 similarity 不是 score
                score = match.get('similarity', match.get('score', 0))
                print(f"\n[{i+1}] 分数: {score:.4f}")
                print(f"    文件: ...{match.get('filePath', '')[-60:]}")
                print(f"    标签: {match.get('tags', [])[:6]}")
                print(f"    情绪: {match.get('emotions', [])}")
                print(f"    描述: {match.get('description', '')[:50]}")
        else:
            print("无搜索结果")
            
        return result
        
    except requests.exceptions.ConnectionError:
        print("CLIP服务未运行，请先启动CLIP服务")
        return None
    except Exception as e:
        print(f"搜索出错: {e}")
        return None

def test_tag_filter(tags: list, limit: int = 5):
    """测试标签过滤"""
    print(f"\n{'='*60}")
    print(f"标签过滤: {tags}")
    print(f"{'='*60}")
    
    try:
        # 使用Qdrant的过滤查询
        filter_conditions = {
            "must": [
                {"key": "tags", "match": {"any": tags}}
            ]
        }
        
        response = requests.post(
            f"{QDRANT_SERVICE}/collections/video_assets/points/scroll",
            json={
                "limit": limit,
                "with_payload": True,
                "with_vector": False,
                "filter": filter_conditions
            },
            timeout=10
        )
        
        if response.status_code != 200:
            print(f"Qdrant返回错误: {response.status_code}")
            return None
            
        result = response.json()
        points = result.get("result", {}).get("points", [])
        
        print(f"\n找到 {len(points)} 个结果:")
        for i, point in enumerate(points[:limit]):
            payload = point.get("payload", {})
            print(f"\n[{i+1}] ID: {point.get('id')}")
            print(f"    文件: ...{payload.get('filePath', '')[-60:]}")
            print(f"    标签: {payload.get('tags', [])[:6]}")
            print(f"    情绪: {payload.get('emotions', [])}")
            
        return result
        
    except Exception as e:
        print(f"标签过滤出错: {e}")
        return None

def get_tag_statistics():
    """获取标签统计"""
    print(f"\n{'='*60}")
    print("标签统计分析")
    print(f"{'='*60}")
    
    try:
        # 获取所有素材的标签
        response = requests.post(
            f"{QDRANT_SERVICE}/collections/video_assets/points/scroll",
            json={
                "limit": 500,  # 抽样500条
                "with_payload": ["tags", "emotions"],
                "with_vector": False
            },
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"获取数据失败: {response.status_code}")
            return
            
        result = response.json()
        points = result.get("result", {}).get("points", [])
        
        from collections import Counter
        all_tags = []
        all_emotions = []
        
        for point in points:
            payload = point.get("payload", {})
            all_tags.extend(payload.get("tags", []))
            all_emotions.extend(payload.get("emotions", []))
        
        tag_counter = Counter(all_tags)
        emotion_counter = Counter(all_emotions)
        
        print(f"\n抽样 {len(points)} 条素材")
        print(f"\n=== 标签分布 (Top 20) ===")
        for tag, count in tag_counter.most_common(20):
            pct = count / len(points) * 100
            print(f"  {tag}: {count} ({pct:.1f}%)")
        
        print(f"\n=== 情绪分布 ===")
        for emotion, count in emotion_counter.most_common():
            pct = count / len(points) * 100
            print(f"  {emotion}: {count} ({pct:.1f}%)")
            
        print(f"\n=== 标签覆盖分析 ===")
        print(f"  不同标签数: {len(tag_counter)}")
        print(f"  不同情绪数: {len(emotion_counter)}")
        print(f"  平均每素材标签数: {len(all_tags) / len(points):.1f}")
        
    except Exception as e:
        print(f"统计出错: {e}")

if __name__ == "__main__":
    print("="*60)
    print("CGCUT 检索效果诊断")
    print("="*60)
    
    # 1. 先看标签统计
    get_tag_statistics()
    
    # 2. 测试几个典型查询
    test_queries = [
        "紧张的办公室场景",
        "夜晚的街道",
        "人物特写 恐惧",
        "汽车追逐",
        "室内 对话",
    ]
    
    print("\n\n" + "="*60)
    print("开始CLIP语义搜索测试")
    print("(需要CLIP服务运行在8000端口)")
    print("="*60)
    
    for query in test_queries:
        test_clip_search(query, limit=3)
    
    # 3. 测试标签过滤
    print("\n\n" + "="*60)
    print("开始标签过滤测试")
    print("="*60)
    
    test_tag_filter(["紧张", "办公室"], limit=3)
    test_tag_filter(["恐惧", "特写镜头"], limit=3)
