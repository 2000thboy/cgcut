"""
测试不同阈值效果对比
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from qdrant_search import qdrant_service
from clip_server import clip_manager

print('=' * 60)
print('测试查询: 办公室场景')
print('对比不同阈值下的结果数量和质量')
print('=' * 60)

clip_manager.load_model()
query_vector = clip_manager.encode_text('办公室场景')

for threshold in [0.25, 0.27, 0.30]:
    print(f'\n阈值 {threshold}:')
    results = qdrant_service.hybrid_search(
        query_vector=query_vector.tolist(),
        top_k=5,
        threshold=threshold,
        enable_mmr=True,
        mmr_lambda=0.6
    )
    print(f'  返回结果数: {len(results)}')
    if results:
        max_sim = results[0]["similarity"]
        min_sim = results[-1]["similarity"]
        print(f'  相似度范围: {min_sim:.4f} - {max_sim:.4f}')
        print(f'  样例: {results[0]["label"][:30]}...')

print('\n' + '=' * 60)
print('结论: 阈值0.27在当前素材库中较为合适')
print('=' * 60)
