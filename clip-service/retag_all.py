# -*- coding: utf-8 -*-
"""
重新打标脚本 - 基于分镜知识库
结合 CLIP 向量匹配 + 文件名关键词提取
"""
from clip_server import PREDEFINED_TAGS, CLIPModelManager
import json
import re
import torch
import numpy as np
from pathlib import Path
from collections import Counter

# 导入clip_server的配置
import sys
sys.path.insert(0, '.')

# 文件名关键词 -> 标签映射 (基于素材库目录结构)
FILENAME_TAG_RULES = [
    # 动作类型
    (r'打斗|战斗|格斗|肉搏|枪战|斗殴', ['战斗']),
    (r'奔跑|跑步|冲刺|追逐', ['奔跑']),
    (r'行走|走路|漫步', ['行走']),
    (r'对话|交谈|说话', ['对话交流']),
    (r'哭泣|流泪|哭', ['哭泣', '悲伤']),
    (r'大笑|笑|开心', ['大笑', '喜悦']),
    (r'拥抱|抱', ['拥抱']),
    (r'尖叫|叫', ['尖叫']),
    (r'跳跃|跳', ['跳跃']),

    # 场景类型
    (r'街道|街头|马路|公路', ['街道', '室外场景']),
    (r'办公|工作', ['办公室', '室内场景']),
    (r'学校|教室|校园', ['教室', '室内场景']),
    (r'战场|战争', ['战场']),
    (r'森林|树林', ['森林', '自然风景']),
    (r'海边|海滩|大海', ['海滩', '自然风景']),
    (r'城市|都市|高楼', ['城市场景']),
    (r'太空|宇宙|星空', ['太空']),

    # 时间
    (r'夜晚|夜间|深夜|黑夜', ['夜晚', '昏暗']),
    (r'白天|日间|阳光', ['白天', '明亮']),
    (r'黄昏|夕阳|傍晚', ['黄昏']),
    (r'清晨|早晨|日出', ['清晨']),

    # 情绪
    (r'紧张|惊险|刺激', ['紧张']),
    (r'恐惧|恐怖|害怕|惊恐', ['恐惧']),
    (r'悲伤|伤心|难过', ['悲伤']),
    (r'愤怒|生气|怒', ['愤怒']),
    (r'喜悦|开心|快乐|高兴', ['喜悦']),
    (r'平静|安静|宁静', ['平静']),

    # 动漫风格
    (r'热血|燃|mad', ['热血']),
    (r'日常|生活', ['日常']),
    (r'治愈|温馨', ['治愈']),
    (r'悬疑|神秘', ['悬疑']),
    (r'科幻|未来', ['科幻']),

    # 镜头类型
    (r'特写|面部|眼睛|表情', ['特写镜头', '面部特写']),
    (r'全景|大景|远景', ['全景镜头']),

    # 素材库目录结构
    (r'动漫素材', ['热血']),  # 默认动漫素材是热血类型
    (r'打斗[/\\\\]', ['战斗', '热血']),
    (r'日常[/\\\\]', ['日常', '平静']),
    (r'风景[/\\\\]', ['自然风景', '无人场景']),
    (r'情感[/\\\\]', ['面部特写']),
]


def extract_tags_from_filename(filepath: str) -> list:
    """从文件路径提取标签"""
    tags = set()
    path_lower = filepath.lower()

    for pattern, tag_list in FILENAME_TAG_RULES:
        if re.search(pattern, path_lower, re.IGNORECASE):
            tags.update(tag_list)

    return list(tags)


def main():
    print("=" * 60)
    print("重新打标 - 基于分镜知识库")
    print("=" * 60)

    # 加载现有数据
    print("\n1. 加载现有素材数据...")
    with open('clip_results.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"   素材总数: {len(data)}")

    # 统计有向量的素材
    with_embeddings = [d for d in data if d.get(
        'clipMetadata', {}).get('embeddings')]
    print(f"   有向量的素材: {len(with_embeddings)}")

    # 初始化CLIP模型
    print("\n2. 加载CLIP模型...")
    clip_manager = CLIPModelManager()
    clip_manager.load_model()
    print("   模型加载完成")

    # 获取所有标签
    all_tags = []
    for category, tags in PREDEFINED_TAGS.items():
        all_tags.extend(tags)
    print(f"   标签总数: {len(all_tags)}")

    # 预计算所有标签的向量
    print("\n3. 计算标签向量...")
    tag_embeddings = clip_manager._get_text_features(all_tags)
    print(f"   标签向量形状: {tag_embeddings.shape}")

    # 重新打标
    print("\n4. 重新打标...")
    updated = 0
    for i, item in enumerate(data):
        if not item.get('clipMetadata', {}).get('embeddings'):
            continue

        # 获取素材向量
        embeddings = torch.tensor(
            item['clipMetadata']['embeddings']).to(clip_manager.device)
        embeddings = embeddings / embeddings.norm()

        # 计算与所有标签的相似度
        similarities = (embeddings @ tag_embeddings.T).cpu().numpy()

        # 选择标签（每个核心类别选1个最佳）
        new_tags = []
        idx = 0

        # 核心类别：景别、主体、情绪 - 必须选
        core_categories = ['shot_type', 'subject', 'emotion']

        for category, tags in PREDEFINED_TAGS.items():
            cat_sims = similarities[idx:idx+len(tags)]
            sorted_indices = np.argsort(cat_sims)[::-1]

            # 选择最佳标签
            best_idx = sorted_indices[0]
            best_tag = tags[best_idx]
            best_sim = cat_sims[best_idx]

            # 核心类别必须选，其他类别需要相似度够高
            if category in core_categories or best_sim > 0.15:
                new_tags.append(best_tag)

            idx += len(tags)

        # 从文件名提取额外标签
        filepath = item.get('filePath', '')
        filename_tags = extract_tags_from_filename(filepath)
        new_tags.extend(filename_tags)

        # 去重
        new_tags = list(dict.fromkeys(new_tags))

        # 更新
        item['clipMetadata']['tags'] = new_tags
        updated += 1

        if (i + 1) % 500 == 0:
            print(f"   进度: {i + 1}/{len(data)}")

    print(f"   更新完成: {updated} 条")

    # 统计新标签分布
    print("\n5. 新标签统计...")
    tag_counter = Counter()
    for item in data:
        if item.get('clipMetadata') and 'tags' in item['clipMetadata']:
            for tag in item['clipMetadata']['tags']:
                tag_counter[tag] += 1

    print(f"   新标签种类: {len(tag_counter)}")
    print("\n   Top 30 标签:")
    for tag, count in tag_counter.most_common(30):
        pct = count / len(data) * 100
        print(f"     {tag}: {count} ({pct:.1f}%)")

    # 保存
    print("\n6. 保存结果...")
    with open('clip_results.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("   保存完成!")

    print("\n" + "=" * 60)
    print("重新打标完成!")
    print("=" * 60)


if __name__ == '__main__':
    main()
