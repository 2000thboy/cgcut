"""
直接测试Qdrant向量搜索
"""
import requests
import json

# 从Qdrant获取一个素材的向量作为查询向量
print("1. 获取一个样本向量...")
resp = requests.post(
    "http://localhost:6333/collections/video_assets/points/scroll",
    json={"limit": 1, "with_vector": True, "with_payload": True}
)
sample = resp.json()["result"]["points"][0]
sample_vector = sample["vector"]
sample_payload = sample["payload"]

print(f"   样本文件: ...{sample_payload.get('filePath', '')[-50:]}")
print(f"   样本标签: {sample_payload.get('tags', [])[:5]}")
print(f"   向量维度: {len(sample_vector)}")

# 使用这个向量搜索相似素材
print("\n2. 用样本向量搜索相似素材...")
resp = requests.post(
    "http://localhost:6333/collections/video_assets/points/search",
    json={
        "vector": sample_vector,
        "limit": 5,
        "with_payload": True,
        "with_vector": False
    }
)
results = resp.json()["result"]

print(f"   找到 {len(results)} 个结果:")
for i, r in enumerate(results):
    print(f"\n   [{i+1}] 分数: {r['score']:.4f}")
    payload = r["payload"]
    print(f"       文件: ...{payload.get('filePath', '')[-50:]}")
    print(f"       标签: {payload.get('tags', [])[:5]}")

# 测试：用一个随机向量搜索
print("\n3. 用随机向量搜索（应该分数较低）...")
import random
random_vector = [random.uniform(-0.1, 0.1) for _ in range(512)]

resp = requests.post(
    "http://localhost:6333/collections/video_assets/points/search",
    json={
        "vector": random_vector,
        "limit": 3,
        "with_payload": True,
        "with_vector": False
    }
)
results = resp.json()["result"]

print(f"   找到 {len(results)} 个结果:")
for i, r in enumerate(results):
    print(f"   [{i+1}] 分数: {r['score']:.4f}")

print("\n4. 检查collection配置...")
resp = requests.get("http://localhost:6333/collections/video_assets")
info = resp.json()["result"]
print(f"   总点数: {info['points_count']}")
print(f"   已索引向量数: {info['indexed_vectors_count']}")
print(f"   向量维度: {info['config']['params']['vectors']['size']}")
print(f"   距离度量: {info['config']['params']['vectors']['distance']}")

if info['indexed_vectors_count'] == 0:
    print("\n   ⚠️ 警告: indexed_vectors_count = 0")
    print("   这意味着向量没有被HNSW索引！")
    print("   搜索仍然可以工作（全量扫描），但速度会慢")
