# -*- coding: utf-8 -*-
"""验证新标签效果"""
import requests
import json


def search(query: str, limit: int = 5):
    """搜索"""
    resp = requests.post(
        "http://localhost:8000/clip/search",
        json={
            "query": query,
            "top_k": limit,
            "threshold": 0.1,
            "use_qdrant": True,
            "enable_mmr": True
        }
    )
    return resp.json() if resp.ok else None


def main():
    tests = [
        "夜晚街道行走",
        "打斗战斗场景",
        "悲伤哭泣",
        "浪漫温馨氛围",
        "赛博朋克城市",
        "慢动作特写",
        "日出日落风景",
    ]

    with open('verify_results.txt', 'w', encoding='utf-8') as f:
        for query in tests:
            f.write(f"\n{'='*60}\n")
            f.write(f"查询: {query}\n")
            f.write(f"{'='*60}\n")

            result = search(query)
            if result and result.get('results'):
                for i, r in enumerate(result['results'][:3]):
                    f.write(f"\n{i+1}. {r['label'][:40]}\n")
                    f.write(f"   相似度: {r['similarity']:.3f}\n")
                    f.write(f"   标签: {r['tags'][:8]}\n")
            else:
                f.write("  无结果\n")

    print("结果已保存到 verify_results.txt")


if __name__ == '__main__':
    main()
