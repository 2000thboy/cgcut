#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
List subdirectories and batch-scan videos with Chinese-CLIP.
This script is ASCII-only to avoid console encoding issues.
"""

import json
import os
import time
import requests


BASE_DIR = r"U:\\PreVis_Assets\\originals\\02类型-三渲二 二次元类"
SCAN_TIMEOUT = 600
SAVE_TIMEOUT = 120
LIST_TIMEOUT = 60


def load_existing_paths():
    """Load existing file paths from clip_results.json if present."""
    try:
        with open("clip_results.json", "r", encoding="utf-8") as f:
            data = json.load(f)
        return {item.get("filePath") for item in data if "filePath" in item}
    except FileNotFoundError:
        return set()
    except Exception as exc:  # pragma: no cover
        print(f"Warning: could not read clip_results.json: {exc}")
        return set()


def list_dirs():
    """Call /clip/list to enumerate files and aggregate counts per subdir."""
    payload = {
        "directory": BASE_DIR,
        "file_patterns": ["*.mp4", "*.mov", "*.avi", "*.mkv"],
        "limit": 0,  # expect all
    }
    resp = requests.post("http://localhost:8000/clip/list", json=payload, timeout=LIST_TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    files = data.get("files", [])
    counts = {}
    for entry in files:
        path = entry.get("filePath", "")
        dir_name = os.path.basename(os.path.dirname(path))
        counts[dir_name] = counts.get(dir_name, 0) + 1
    return counts, files


def scan_dir(dir_name, existing):
    """Scan a single subdir, save new results, return processed count."""
    payload = {
        "directory": f"{BASE_DIR}\\{dir_name}",
        "file_patterns": ["*.mp4", "*.mov", "*.avi", "*.mkv"],
        "extract_keyframes": True,
        "model_version": "Chinese-CLIP ViT-B/16",
    }

    print(f"Scanning: {dir_name}")
    resp = requests.post("http://localhost:8000/clip/scan", json=payload, timeout=SCAN_TIMEOUT)
    if resp.status_code != 200:
        print(f"Scan failed ({resp.status_code}) {resp.text[:120]}")
        return 0

    data = resp.json()
    processed = data.get("processedFiles", [])
    new_items = [item for item in processed if item.get("filePath") not in existing]

    if not new_items:
        print("No new files to save.")
        return 0

    save_payload = {"results": new_items}
    save_resp = requests.post("http://localhost:8000/clip/save-results", json=save_payload, timeout=SAVE_TIMEOUT)
    if save_resp.status_code != 200:
        print(f"Save failed ({save_resp.status_code}) {save_resp.text[:120]}")
        return 0

    for item in new_items:
        existing.add(item.get("filePath"))
    print(f"Saved {len(new_items)} new files.")
    return len(new_items)


def main():
    print("=== Chinese-CLIP index rebuild ===")
    print(f"Base dir: {BASE_DIR}")

    existing = load_existing_paths()
    print(f"Existing entries: {len(existing)}")

    print("Listing directories...")
    counts, _ = list_dirs()
    sorted_dirs = sorted(counts.items(), key=lambda x: x[1], reverse=True)

    print("Top directories (by file count):")
    for dir_name, cnt in sorted_dirs[:15]:
        print(f"  {dir_name}: {cnt}")

    target_dirs = [name for name, cnt in sorted_dirs if cnt > 0]
    print(f"Total non-empty dirs: {len(target_dirs)}")

    total_new = 0
    for idx, dir_name in enumerate(target_dirs, 1):
        print(f"\n[{idx}/{len(target_dirs)}] {dir_name}")
        added = scan_dir(dir_name, existing)
        total_new += added
        print(f"Current total (including existing): {len(existing)}")
        time.sleep(2)

    print("\n=== Done ===")
    print(f"Newly added: {total_new}")
    print(f"Total indexed: {len(existing)}")


if __name__ == "__main__":
    main()
