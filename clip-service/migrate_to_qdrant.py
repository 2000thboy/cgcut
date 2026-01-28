"""
数据迁移脚本：将 clip_results.json 的向量数据导入 Qdrant
"""
import json
import os
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct


def load_clip_results(json_path: str) -> List[Dict[str, Any]]:
    """加载 clip_results.json 文件"""
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"文件不存在: {json_path}")

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"✅ 成功加载 {len(data)} 条素材记录")
    return data


def create_collection(client: QdrantClient, collection_name: str, vector_size: int = 512):
    """创建 Qdrant collection"""
    # 检查是否已存在
    collections = client.get_collections().collections
    if any(col.name == collection_name for col in collections):
        print(f"⚠️ Collection '{collection_name}' 已存在，删除并重新创建...")
        client.delete_collection(collection_name)

    # 创建新的 collection
    client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE)
    )
    print(f"✅ 成功创建 Collection '{collection_name}' (向量维度: {vector_size})")


def migrate_data(client: QdrantClient, collection_name: str, data: List[Dict[str, Any]]):
    """迁移数据到 Qdrant"""
    points = []
    skipped = 0

    for idx, item in enumerate(data):
        # 验证必要字段
        if "clipMetadata" not in item or "embeddings" not in item["clipMetadata"]:
            print(f"⚠️ 跳过无向量数据的记录: {item.get('shotId', 'unknown')}")
            skipped += 1
            continue

        embeddings = item["clipMetadata"]["embeddings"]

        # 构造 payload（除了向量外的所有元数据）
        payload = {
            "filePath": item.get("filePath", ""),
            "shotId": item.get("shotId", ""),
            "label": item.get("label", ""),
            "duration": item.get("duration", 0),
            "status": item.get("status", ""),
            "tags": item["clipMetadata"].get("tags", []),
            "description": item["clipMetadata"].get("description", ""),
            "emotions": item["clipMetadata"].get("emotions", []),
            "processedAt": item["clipMetadata"].get("processedAt", "")
        }
        
        # 添加分片信息（如果存在）
        if "segment" in item:
            payload["segment"] = item["segment"]

        # 构造 PointStruct
        point = PointStruct(
            id=idx,  # 使用索引作为 ID
            vector=embeddings,
            payload=payload
        )
        points.append(point)

    # 批量上传
    if points:
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            client.upsert(
                collection_name=collection_name,
                points=batch
            )
            print(f"📤 已上传 {i + len(batch)}/{len(points)} 条记录...")

    print(f"✅ 数据迁移完成！成功: {len(points)}, 跳过: {skipped}")
    return len(points), skipped


def verify_migration(client: QdrantClient, collection_name: str):
    """验证迁移结果"""
    collection_info = client.get_collection(collection_name)
    print(f"\n📊 Collection 统计信息:")
    print(f"  - 名称: {collection_info.config.params.vectors}")
    print(f"  - 向量数量: {collection_info.points_count}")
    print(f"  - 向量维度: {collection_info.config.params.vectors.size}")
    print(f"  - 距离度量: {collection_info.config.params.vectors.distance}")


def main():
    # 配置
    QDRANT_HOST = "localhost"
    QDRANT_PORT = 6333
    COLLECTION_NAME = "video_assets"
    JSON_PATH = "clip_results.json"

    import sys
    import io
    # Windows 控制台编码修复
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("🚀 开始数据迁移...")

    # 1. 连接 Qdrant
    print(f"\n📡 连接到 Qdrant ({QDRANT_HOST}:{QDRANT_PORT})...")
    import os
    # 禁用代理以避免连接问题
    os.environ.pop('HTTP_PROXY', None)
    os.environ.pop('HTTPS_PROXY', None)
    os.environ.pop('http_proxy', None)
    os.environ.pop('https_proxy', None)

    client = QdrantClient(
        url=f"http://{QDRANT_HOST}:{QDRANT_PORT}",
        timeout=60,
        prefer_grpc=False
    )

    # 2. 加载数据
    print(f"\n📂 加载 {JSON_PATH}...")
    data = load_clip_results(JSON_PATH)

    # 3. 创建 Collection
    print(f"\n🏗️ 创建 Collection '{COLLECTION_NAME}'...")
    create_collection(client, COLLECTION_NAME, vector_size=512)

    # 4. 迁移数据
    print(f"\n📦 开始迁移数据...")
    success_count, skip_count = migrate_data(client, COLLECTION_NAME, data)

    # 5. 验证
    print(f"\n🔍 验证迁移结果...")
    verify_migration(client, COLLECTION_NAME)

    print("\n✨ 迁移完成！")


if __name__ == "__main__":
    main()
