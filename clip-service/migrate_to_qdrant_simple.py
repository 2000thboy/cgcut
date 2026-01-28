"""
使用requests库直接调用Qdrant REST API进行数据迁移
"""
import json
import os
import requests
from typing import List, Dict, Any


def load_clip_results(json_path: str) -> List[Dict[str, Any]]:
    """加载 clip_results.json 文件"""
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"文件不存在: {json_path}")

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"成功加载 {len(data)} 条素材记录")
    return data


def create_collection(base_url: str, collection_name: str, vector_size: int = 512):
    """创建 Qdrant collection"""
    # 检查是否已存在
    resp = requests.get(f"{base_url}/collections/{collection_name}")
    if resp.status_code == 200:
        print(f"Collection '{collection_name}' 已存在，删除并重新创建...")
        requests.delete(f"{base_url}/collections/{collection_name}")

    # 创建新的 collection
    payload = {
        "vectors": {
            "size": vector_size,
            "distance": "Cosine"
        }
    }
    resp = requests.put(
        f"{base_url}/collections/{collection_name}", json=payload)
    resp.raise_for_status()
    print(f"成功创建 Collection '{collection_name}' (向量维度: {vector_size})")


def migrate_data(base_url: str, collection_name: str, data: List[Dict[str, Any]]):
    """迁移数据到 Qdrant"""
    points = []
    skipped = 0

    for idx, item in enumerate(data):
        # 验证必要字段
        if "clipMetadata" not in item or "embeddings" not in item["clipMetadata"]:
            print(f"跳过无向量数据的记录: {item.get('shotId', 'unknown')}")
            skipped += 1
            continue

        embeddings = item["clipMetadata"]["embeddings"]

        # 构造 payload
        payload = {
            "filePath": item.get("filePath", ""),
            "shotId": item.get("shotId", ""),
            "label": item.get("label", ""),
            "duration": item.get("duration", 0),
            "status": item.get("status", ""),
            "tags": item["clipMetadata"].get("tags", []),
            "description": item["clipMetadata"].get("description", ""),
            "processedAt": item["clipMetadata"].get("processedAt", "")
        }

        # 构造 point
        point = {
            "id": idx,
            "vector": embeddings,
            "payload": payload
        }
        points.append(point)

        # 每100条批量上传一次
        if len(points) >= 100:
            batch_payload = {"points": points}
            resp = requests.put(
                f"{base_url}/collections/{collection_name}/points",
                json=batch_payload
            )
            resp.raise_for_status()
            print(f"已上传 {idx + 1}/{len(data)} 条记录...")
            points = []

    # 上传剩余的数据
    if points:
        batch_payload = {"points": points}
        resp = requests.put(
            f"{base_url}/collections/{collection_name}/points",
            json=batch_payload
        )
        resp.raise_for_status()
        print(f"已上传 {len(data) - skipped}/{len(data)} 条记录...")

    print(f"数据迁移完成！成功: {len(data) - skipped}, 跳过: {skipped}")
    return len(data) - skipped, skipped


def verify_migration(base_url: str, collection_name: str):
    """验证迁移结果"""
    resp = requests.get(f"{base_url}/collections/{collection_name}")
    resp.raise_for_status()
    collection_info = resp.json()["result"]

    print(f"\nCollection 统计信息:")
    print(f"  - 名称: {collection_name}")
    print(f"  - 向量数量: {collection_info['points_count']}")
    print(
        f"  - 向量维度: {collection_info['config']['params']['vectors']['size']}")
    print(
        f"  - 距离度量: {collection_info['config']['params']['vectors']['distance']}")


def main():
    import sys
    import io
    # Windows 控制台编码修复
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    # 配置
    BASE_URL = "http://127.0.0.1:6333"
    COLLECTION_NAME = "video_assets"
    JSON_PATH = "clip_results.json"

    print("开始数据迁移...")

    # 1. 加载数据
    print(f"\n加载 {JSON_PATH}...")
    data = load_clip_results(JSON_PATH)

    # 2. 创建 Collection
    print(f"\n创建 Collection '{COLLECTION_NAME}'...")
    create_collection(BASE_URL, COLLECTION_NAME, vector_size=512)

    # 3. 迁移数据
    print(f"\n开始迁移数据...")
    success_count, skip_count = migrate_data(BASE_URL, COLLECTION_NAME, data)

    # 4. 验证
    print(f"\n验证迁移结果...")
    verify_migration(BASE_URL, COLLECTION_NAME)

    print("\n迁移完成！")


if __name__ == "__main__":
    main()
