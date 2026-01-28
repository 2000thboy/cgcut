# -*- coding: utf-8 -*-
"""
批量扫描新素材文件夹
直接使用CLIP模型处理，不依赖HTTP接口
"""
from clip_server import CLIPModelManager, PREDEFINED_TAGS, extract_keyframes_from_video
import json
import os
import sys
from pathlib import Path
from datetime import datetime

# 添加当前目录到路径
sys.path.insert(0, '.')

# 配置
NEW_FOLDER = r"U:\PreVis_Assets\originals\02类型-三渲二 二次元类"
RESULTS_FILE = "clip_results.json"
BATCH_SIZE = 50  # 每处理50个保存一次


def find_video_files(directory: str) -> list:
    """查找所有视频文件"""
    extensions = {'.mp4', '.mov', '.avi', '.mkv', '.webm'}
    files = []
    for root, dirs, filenames in os.walk(directory):
        for f in filenames:
            if Path(f).suffix.lower() in extensions:
                files.append(os.path.join(root, f))
    return files


def safe_text(text: str) -> str:
    try:
        return text.encode("gbk", "replace").decode("gbk")
    except Exception:
        return text.encode("utf-8", "replace").decode("utf-8")


def main():
    print("=" * 60)
    print("批量扫描新素材文件夹")
    print("=" * 60)

    # 加载现有数据
    print("\n1. 加载现有素材数据...")
    if os.path.exists(RESULTS_FILE):
        with open(RESULTS_FILE, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
    else:
        existing_data = []

    # 获取已处理的文件路径
    processed_paths = {item.get('filePath', '') for item in existing_data}
    print(f"   已有素材: {len(existing_data)}")

    # 查找新文件
    print(f"\n2. 扫描目录: {NEW_FOLDER}")
    all_files = find_video_files(NEW_FOLDER)
    print(f"   发现视频文件: {len(all_files)}")

    # 过滤已处理的
    new_files = [f for f in all_files if f not in processed_paths]
    print(f"   待处理文件: {len(new_files)}")

    if not new_files:
        print("\n没有新文件需要处理!")
        return

    # 初始化CLIP模型
    print("\n3. 加载CLIP模型...")
    clip_manager = CLIPModelManager()
    clip_manager.load_model()
    print("   模型加载完成")

    # 处理文件
    print(f"\n4. 开始处理 {len(new_files)} 个文件...")
    processed = 0
    errors = 0

    for i, filepath in enumerate(new_files):
        try:
            # 提取关键帧
            keyframes = extract_keyframes_from_video(filepath, num_frames=1)
            if not keyframes:
                print(
                    f"   [{i+1}/{len(new_files)}] 跳过(无法提取帧): {safe_text(Path(filepath).name)[:30]}")
                errors += 1
                continue
            keyframe = keyframes[0]

            # 计算向量
            embeddings = clip_manager._get_image_features(keyframe).detach()
            embeddings_list = embeddings.cpu().numpy().tolist()[0]

            # 计算标签
            all_tags = []
            for category, tags in PREDEFINED_TAGS.items():
                all_tags.extend(tags)

            tag_embeddings = clip_manager._get_text_features(all_tags).detach()
            similarities = (embeddings @ tag_embeddings.T).cpu().numpy()[0]

            # 选择标签
            selected_tags = []
            idx = 0
            core_categories = ['shot_type', 'subject', 'emotion']

            for category, tags in PREDEFINED_TAGS.items():
                cat_sims = similarities[idx:idx+len(tags)]
                best_idx = cat_sims.argmax()
                best_sim = cat_sims[best_idx]

                if category in core_categories or best_sim > 0.15:
                    selected_tags.append(tags[best_idx])

                idx += len(tags)

            # 从文件名添加标签
            filename_lower = filepath.lower()
            if '三渲二' in filename_lower or '二次元' in filename_lower:
                selected_tags.append('三渲二')
            if '游戏' in filename_lower or 'game' in filename_lower:
                selected_tags.append('游戏CG')

            # 创建记录
            shot_id = f"shot_{len(existing_data) + processed + 1}"
            label = Path(filepath).stem

            record = {
                "shotId": shot_id,
                "filePath": filepath,
                "label": label,
                "duration": 5.0,  # 默认时长
                "clipMetadata": {
                    "embeddings": embeddings_list,
                    "tags": list(set(selected_tags)),
                    "description": f"三渲二素材: {label}",
                    "emotions": [],
                    "processed_at": datetime.now().isoformat()
                }
            }

            existing_data.append(record)
            processed += 1

            if (i + 1) % 10 == 0:
                print(
                    f"   [{i+1}/{len(new_files)}] 已处理: {processed}, 错误: {errors}")

            # 定期保存
            if processed % BATCH_SIZE == 0:
                with open(RESULTS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(existing_data, f, ensure_ascii=False, indent=2)
                print(f"   >> 已保存 {len(existing_data)} 条记录")

        except Exception as e:
                print(
                    f"   [{i+1}/{len(new_files)}] 错误: {safe_text(Path(filepath).name)[:30]} - {safe_text(str(e))[:50]}")
                errors += 1

    # 最终保存
    print("\n5. 保存结果...")
    with open(RESULTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, ensure_ascii=False, indent=2)

    print(f"\n" + "=" * 60)
    print(f"处理完成!")
    print(f"  新增: {processed}")
    print(f"  错误: {errors}")
    print(f"  总计: {len(existing_data)}")
    print("=" * 60)


if __name__ == '__main__':
    main()
