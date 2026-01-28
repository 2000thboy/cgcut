"""检查Qdrant向量库状态"""
from qdrant_client import QdrantClient
import json

client = QdrantClient('localhost', port=6333)

# 检查collection是否存在
collections = client.get_collections()
print('=== 向量库状态 ===')
print(f'Collections: {[c.name for c in collections.collections]}')

# 获取video_assets的统计
try:
    info = client.get_collection('video_assets')
    print(f'\n总素材数: {info.points_count}')
    print(f'向量维度: {info.config.params.vectors.size}')
    
    # 随机抽样几条看看标签质量
    results = client.scroll(
        collection_name='video_assets',
        limit=20,
        with_payload=True,
        with_vectors=False
    )
    
    # 统计标签分布
    all_tags = []
    all_emotions = []
    
    print('\n=== 抽样素材标签 ===')
    for i, point in enumerate(results[0][:5]):
        payload = point.payload
        file_path = payload.get('file_path', 'N/A')
        print(f"\n[{i+1}] 文件: ...{file_path[-50:] if len(file_path) > 50 else file_path}")
        print(f"    标签: {payload.get('tags', [])[:8]}")
        print(f"    情绪: {payload.get('emotions', [])}")
        desc = payload.get('description', 'N/A')
        print(f"    描述: {desc[:60]}..." if len(desc) > 60 else f"    描述: {desc}")
    
    # 统计所有标签
    for point in results[0]:
        all_tags.extend(point.payload.get('tags', []))
        all_emotions.extend(point.payload.get('emotions', []))
    
    from collections import Counter
    tag_counter = Counter(all_tags)
    emotion_counter = Counter(all_emotions)
    
    print('\n=== 标签分布 (Top 15) ===')
    for tag, count in tag_counter.most_common(15):
        print(f"  {tag}: {count}")
    
    print('\n=== 情绪分布 ===')
    for emotion, count in emotion_counter.most_common():
        print(f"  {emotion}: {count}")
        
except Exception as e:
    print(f'获取collection失败: {e}')
    import traceback
    traceback.print_exc()
