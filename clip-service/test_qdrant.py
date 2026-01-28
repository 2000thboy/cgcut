"""
Qdrant混合检索测试脚本
"""
import sys
import json

# 设置控制台编码
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from qdrant_search import qdrant_service
from clip_server import clip_manager

# 加载CLIP模型
print("正在加载CLIP模型...")
clip_manager.load_model()
print("✅ CLIP模型加载完成")

# 测试查询
test_query = "办公室场景"
print(f"\n测试查询: '{test_query}'")

# 编码查询文本
query_vector = clip_manager.encode_text(test_query)
print(f"✅ 查询向量生成完成，维度: {len(query_vector)}")

# 测试Qdrant检索
print("\n执行Qdrant混合检索...")
results = qdrant_service.hybrid_search(
    query_vector=query_vector.tolist(),
    top_k=5,
    threshold=0.25,
    enable_mmr=True,
    mmr_lambda=0.7
)

print(f"\n✅ 检索完成，找到 {len(results)} 个结果:")
for i, result in enumerate(results):
    print(f"\n{i+1}. {result['label']}")
    print(f"   相似度: {result['similarity']}")
    print(f"   标签: {', '.join(result['tags'][:5])}")
    print(f"   描述: {result['description'][:50]}...")
    print(f"   路径: {result['filePath']}")

print("\n✅ 测试完成！")
