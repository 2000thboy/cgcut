# -*- coding: utf-8 -*-
"""验证新素材入库"""
import requests

# 从Qdrant获取后面的记录（新素材应该在后面）
resp = requests.post(
    "http://localhost:6333/collections/video_assets/points/scroll",
    json={
        "offset": 3000,  # 跳过前3000条
        "limit": 20,
        "with_payload": True,
        "with_vector": False
    }
)

if resp.ok:
    data = resp.json()
    points = data.get("result", {}).get("points", [])

    with open("verify_new.txt", "w", encoding="utf-8") as f:
        f.write(f"从ID 3000开始的素材 ({len(points)}条):\n\n")

        new_count = 0
        for p in points:
            path = p.get("payload", {}).get("filePath", "")
            label = p.get("payload", {}).get("label", "")[:50]
            tags = p.get("payload", {}).get("tags", [])[:5]
            is_new = "02类型-三渲二" in path

            if is_new:
                new_count += 1

            f.write(f"ID: {p.get('id')}\n")
            f.write(f"  标签: {label}\n")
            f.write(f"  新素材: {is_new}\n")
            f.write(f"  Tags: {tags}\n\n")

        f.write(f"\n统计: 新素材 {new_count}/{len(points)}\n")

    print("结果保存到 verify_new.txt")
else:
    print(f"Error: {resp.status_code}")
