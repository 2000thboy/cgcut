# -*- coding: utf-8 -*-
"""测试带标签过滤的搜索"""
import requests
import json


def search_with_filter(query: str, filter_tags: list = None, limit: int = 5):
    """带标签过滤的搜索"""
    params = {
        "query": query,
        "top_k": limit,
        "threshold": 0.1,
        "use_qdrant": True,
        "enable_mmr": True
    }
    if filter_tags:
        params["filter_tags"] = filter_tags

    resp = requests.post(
        "http://localhost:8000/clip/search",
        json=params
    )

    if not resp.ok:
        print(f"搜索失败: {resp.status_code}")
        return

    data = resp.json()
    return data


def main():
    # 测试1: 不带过滤的搜索
    print("=" * 60)
    print("测试1: 打斗场景 (无过滤)")
    print("=" * 60)
    result = search_with_filter("打斗战斗", limit=5)
    if result:
        for i, r in enumerate(result.get('results', [])[:5]):
            has_fight = '打斗场景' in r.get('tags', [])
            print(f"{i+1}. {r['label'][:35]}...")
            print(f"   相似度: {r['similarity']:.3f}, 打斗标签: {has_fight}")
            print(f"   标签: {r['tags'][:5]}")

    # 测试2: 带过滤的搜索
    print("\n" + "=" * 60)
    print("测试2: 打斗场景 (带打斗标签过滤)")
    print("=" * 60)
    result = search_with_filter("打斗战斗", filter_tags=["打斗场景"], limit=5)
    if result:
        for i, r in enumerate(result.get('results', [])[:5]):
            has_fight = '打斗场景' in r.get('tags', [])
            print(f"{i+1}. {r['label'][:35]}...")
            print(f"   相似度: {r['similarity']:.3f}, 打斗标签: {has_fight}")
            print(f"   标签: {r['tags'][:5]}")

    # 测试3: 街道夜晚
    print("\n" + "=" * 60)
    print("测试3: 街道夜晚 (带街道+夜晚标签过滤)")
    print("=" * 60)
    result = search_with_filter("街道夜晚行走", filter_tags=["街道", "夜晚"], limit=5)
    if result:
        for i, r in enumerate(result.get('results', [])[:5]):
            tags = r.get('tags', [])
            has_street = '街道' in tags
            has_night = '夜晚' in tags
            print(f"{i+1}. {r['label'][:35]}...")
            print(
                f"   相似度: {r['similarity']:.3f}, 街道: {has_street}, 夜晚: {has_night}")
            print(f"   标签: {tags[:5]}")


if __name__ == '__main__':
    main()
