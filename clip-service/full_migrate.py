# -*- coding: utf-8 -*-
"""完整迁移到Qdrant"""
import json
import requests

QDRANT_URL = "http://localhost:6333"
COLLECTION_NAME = "video_assets"

print("加载 clip_results.json...")
with open('clip_results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
print(f"加载了 {len(data)} 条记录")

# 批量导入
batch_size = 100
points = []
imported = 0
skipped = 0

for idx, item in enumerate(data):
    if 'clipMetadata' not in item or 'embeddings' not in item['clipMetadata']:
        skipped += 1
        continue

    points.append({
        "id": idx,
        "vector": item['clipMetadata']['embeddings'],
        "payload": {
            "filePath": item.get('filePath', ''),
            "shotId": item.get('shotId', ''),
            "label": item.get('label', ''),
            "duration": item.get('duration', 0),
            "tags": item['clipMetadata'].get('tags', []),
            "description": item['clipMetadata'].get('description', ''),
            "emotions": item['clipMetadata'].get('emotions', []),
        }
    })

    if len(points) >= batch_size:
        resp = requests.put(
            f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points",
            json={"points": points}
        )
        imported += len(points)
        if (imported % 500) == 0:
            print(f"  已导入 {imported} 条...")
        points = []

# 上传剩余
if points:
    resp = requests.put(
        f"{QDRANT_URL}/collections/{COLLECTION_NAME}/points",
        json={"points": points}
    )
    imported += len(points)

print(f"\n完成! 导入: {imported}, 跳过: {skipped}")
