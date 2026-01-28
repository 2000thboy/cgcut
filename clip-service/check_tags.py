# -*- coding: utf-8 -*-
"""检查标签分布"""
from qdrant_client import QdrantClient
from collections import Counter

client = QdrantClient('localhost', port=6333)

# 获取所有点的标签
points = client.scroll(
    collection_name='video_assets',
    limit=3000,
    with_payload=True,
    with_vectors=False
)[0]

# 统计标签
tag_counter = Counter()
for p in points:
    if p.payload and 'tags' in p.payload:
        for tag in p.payload['tags']:
            tag_counter[tag] += 1

print('标签分布 (Top 25):')
for tag, count in tag_counter.most_common(25):
    pct = count / len(points) * 100
    print(f'  {tag}: {count} ({pct:.1f}%)')

print(f'\n总素材数: {len(points)}')
print(f'总标签种类: {len(tag_counter)}')

# 检查关键标签
key_tags = ['街道', '夜晚', '动漫场景', '办公室', '室外场景', '行走', '人物']
print('\n关键标签统计:')
for tag in key_tags:
    count = tag_counter.get(tag, 0)
    pct = count / len(points) * 100 if len(points) > 0 else 0
    print(f'  {tag}: {count} ({pct:.1f}%)')
