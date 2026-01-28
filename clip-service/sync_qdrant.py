"""
Qdrant 同步脚本（针对 video_assets_v2）

特性：
- 读取 clip_results.json
- point_id = sha1(canonical_path#segment_index)
- payload 含 canonicalPath、mtime、segment、duration、tags/description/emotions、shotId/label、filePath、hashId
- 支持 --dry-run 仅统计/预览
- 默认 upsert 到 collection（可选 --recreate 重建）
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Dict, List, Any, Tuple

import requests


DEFAULT_QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
DEFAULT_COLLECTION = os.getenv("QDRANT_COLLECTION", "video_assets_v2")
RESULTS_FILE = Path(__file__).parent / "clip_results.json"


def sha1_hex(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def load_results(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def ensure_collection(qdrant_url: str, collection: str, recreate: bool = False):
    if recreate:
        requests.delete(f"{qdrant_url}/collections/{collection}")

    # create if not exists
    resp = requests.get(f"{qdrant_url}/collections/{collection}")
    if resp.ok and not recreate:
        return

    payload = {
        "vectors": {
            "size": 512,
            "distance": "Cosine",
        },
        "hnsw_config": {
            "m": 64,
            "ef_construct": 256,
        },
    }
    create_resp = requests.put(
        f"{qdrant_url}/collections/{collection}", json=payload
    )
    create_resp.raise_for_status()


def build_point(item: Dict[str, Any]) -> Tuple[str, Dict[str, Any], List[float]]:
    file_path = item.get("filePath") or ""
    canonical_path = item.get("canonicalPath") or str(Path(file_path).resolve())
    segment = item.get("segment") or {}
    seg_index = segment.get("index", 0)
    hash_id = item.get("hashId") or sha1_hex(f"{canonical_path}#{seg_index}")

    mtime = item.get("mtime")
    if mtime is None and file_path:
        try:
            mtime = Path(file_path).stat().st_mtime
        except OSError:
            mtime = None

    payload = {
        "filePath": file_path,
        "canonicalPath": canonical_path,
        "hashId": hash_id,
        "mtime": mtime,
        "segment": {
            "start": segment.get("start", 0.0),
            "end": segment.get("end", item.get("duration", 0.0)),
            "index": seg_index,
        },
        "duration": item.get("duration", 0.0),
        "tags": item.get("clipMetadata", {}).get("tags", []),
        "description": item.get("clipMetadata", {}).get("description", ""),
        "emotions": item.get("clipMetadata", {}).get("emotions", []),
        "shotId": item.get("shotId"),
        "label": item.get("label"),
    }

    vector = item.get("clipMetadata", {}).get("embeddings")
    return hash_id, payload, vector


def upsert_points(qdrant_url: str, collection: str, points: List[Dict[str, Any]]):
    if not points:
        return
    resp = requests.put(
        f"{qdrant_url}/collections/{collection}/points",
        json={"points": points},
    )
    resp.raise_for_status()


def sync(
    qdrant_url: str,
    collection: str,
    input_file: Path,
    batch_size: int = 64,
    dry_run: bool = False,
    recreate: bool = False,
):
    if not input_file.exists():
        raise FileNotFoundError(f"结果文件不存在: {input_file}")

    data = load_results(input_file)
    ensure_collection(qdrant_url, collection, recreate=recreate)

    total = 0
    skipped = 0
    batch: List[Dict[str, Any]] = []

    for item in data:
        point_id, payload, vector = build_point(item)
        if not vector:
            skipped += 1
            continue
        batch.append({"id": point_id, "vector": vector, "payload": payload})
        total += 1

        if len(batch) >= batch_size and not dry_run:
            upsert_points(qdrant_url, collection, batch)
            batch.clear()

    if batch and not dry_run:
        upsert_points(qdrant_url, collection, batch)

    print(
        f"同步完成 -> collection={collection}, 写入: {total}, 跳过(无向量): {skipped}, dry_run={dry_run}"
    )


def main():
    parser = argparse.ArgumentParser(description="Sync clip_results.json to Qdrant")
    parser.add_argument("--qdrant-url", default=DEFAULT_QDRANT_URL)
    parser.add_argument("--collection", default=DEFAULT_COLLECTION)
    parser.add_argument("--input", default=str(RESULTS_FILE))
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--recreate", action="store_true")
    args = parser.parse_args()

    sync(
        qdrant_url=args.qdrant_url,
        collection=args.collection,
        input_file=Path(args.input),
        batch_size=args.batch_size,
        dry_run=args.dry_run,
        recreate=args.recreate,
    )


if __name__ == "__main__":
    main()
