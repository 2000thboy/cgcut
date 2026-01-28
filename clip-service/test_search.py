# -*- coding: utf-8 -*-
"""测试搜索效果"""
import requests
import json


def test_search(query: str, limit: int = 5):
    """测试搜索"""
    resp = requests.get(
        f"http://localhost:8000/clip/search",
        params={"query": query, "limit": limit}
    )

    if not resp.ok:
        print(f"搜索失败: {resp.status_code}")
        return

    data = resp.json()
    print(f"查询: {data.get('query')}")
    print(f"模式: {data.get('mode')}")
    print(f"结果数: {data.get('total')}")
    print()

    for i, r in enumerate(data.get('results', [])[:5]):
        label = r.get('label', '')[:50]
        print(f"{i+1}. {label}")
        print(f"   相似度: {r.get('similarity', 0):.3f}")
        print(f"   标签: {r.get('tags', [])}")
        print()


if __name__ == '__main__':
    import sys
    # 输出到文件
    with open('search_results.txt', 'w', encoding='utf-8') as f:
        old_stdout = sys.stdout
        sys.stdout = f

        print("=" * 60)
        print("测试1: 街道夜晚行走")
        print("=" * 60)
        test_search("街道夜晚行走")

        print("\n" + "=" * 60)
        print("测试2: 打斗战斗")
        print("=" * 60)
        test_search("打斗战斗场景")

        print("\n" + "=" * 60)
        print("测试3: 悲伤流泪")
        print("=" * 60)
        test_search("悲伤流泪哭泣")

        sys.stdout = old_stdout

    print("结果已保存到 search_results.txt")
