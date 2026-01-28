"""
测试Chinese-CLIP搜索效果
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

print("1. 加载clip_server模块...")
from clip_server import clip_manager

print("\n2. 加载模型...")
clip_manager.load_model()

print(f"\n3. 模型信息:")
print(f"   模型: {clip_manager.model_name}")
print(f"   类型: {'Chinese-CLIP' if clip_manager.is_chinese_clip else 'OpenAI CLIP'}")
print(f"   设备: {clip_manager.device}")

print("\n4. 测试文本编码...")
test_queries = [
    "紧张的办公室场景",
    "夜晚的街道",
    "人物特写 恐惧",
    "汽车追逐",
    "室内对话",
]

for query in test_queries:
    vec = clip_manager.encode_text(query)
    print(f"   '{query}' -> 向量维度: {len(vec)}, 范数: {sum(v*v for v in vec)**0.5:.4f}")

print("\n5. 测试搜索（需要CLIP服务运行）...")
import requests

# 如果服务已经在运行，测试搜索
try:
    for query in test_queries[:2]:
        resp = requests.post(
            "http://localhost:8000/clip/search",
            json={"query": query, "top_k": 3, "threshold": 0.0},
            timeout=30
        )
        if resp.status_code == 200:
            result = resp.json()
            print(f"\n   查询: '{query}'")
            if result.get("results"):
                for i, r in enumerate(result["results"][:3]):
                    print(f"   [{i+1}] 分数: {r.get('similarity', 0):.4f} | 标签: {r.get('tags', [])[:4]}")
            else:
                print("   无结果")
except Exception as e:
    print(f"   搜索测试跳过 (服务未运行): {e}")

print("\n=== 测试完成 ===")
