# -*- coding: utf-8 -*-
"""测试Qdrant标签过滤"""
import requests
import json

QDRANT_URL = "http://localhost:6333"
COLLECTION = "video_assets"


def test_tag_filter(tag: str, limit: int = 5):
    """测试标签过滤"""
    print(f"\n查找标签 '{tag}':")

    # 使用scroll API + filter
    resp = requests.post(
        f"{QDRANT_URL}/collections/{COLLECTION}/points/scroll",
        json={
            "filter": {
                "must": [
                    {"key": "tags", "match": {"value": tag}}
                ]
            },
            "limit": limit,
            "with_payload": True,
            "with_vector": False
        }
    )

    if not resp.ok:
        print(f"  错误: {resp.text[:100]}")
        return

    data = resp.json()
    points = data.get('result', {}).get('points', [])

    print(f"  找到 {len(points)} 条记录:")
    for p in points:
        payload = p.get('payload', {})
        label = payload.get('label', '')[:40]
        tags = payload.get('tags', [])
        print(f"    - {label}")
        print(f"      标签: {tags}")


if __name__ == '__main__':
    # 测试各种标签
    test_tag_filter("打斗场景")
    test_tag_filter("街道")
    test_tag_filter("夜晚")
    test_tag_filter("悲伤情绪")
    test_tag_filter("动漫场景")
