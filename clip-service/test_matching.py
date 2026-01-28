# -*- coding: utf-8 -*-
"""
模拟前端匹配逻辑，验证优化效果
"""
import requests
import json

# 模拟 SCENE_TYPE_TAGS 映射（与新标签系统一致）
SCENE_TYPE_TAGS = {
    # 场景类型
    "办公室": ["室内场景", "办公室", "工作"],
    "街道": ["街道", "室外场景", "城市场景", "行走"],
    "房间": ["室内场景", "卧室"],
    "自然": ["自然风景", "森林"],
    "战场": ["战场", "战斗"],
    # 时间
    "深夜": ["夜晚", "昏暗"],
    "夜晚": ["夜晚", "昏暗"],
    "白天": ["白天", "明亮"],
    "黄昏": ["黄昏"],
    # 动作
    "打斗": ["战斗", "热血"],
    "战斗": ["战斗", "热血"],
    "追逐": ["奔跑", "热血"],
    "奔跑": ["奔跑"],
    # 情绪（与知识库一致）
    "悲伤": ["悲伤"],
    "流泪": ["悲伤", "哭泣"],
    "哭泣": ["悲伤", "哭泣"],
    "喜悦": ["喜悦"],
    "恐惧": ["恐惧"],
    "紧张": ["紧张"],
    "平静": ["平静"],
    "愤怒": ["愤怒"],
}


def extract_scene_filter(scene: str, text: str, emotion: str = "") -> list:
    """提取场景过滤标签"""
    tags = set()

    for key, tag_list in SCENE_TYPE_TAGS.items():
        if key in scene or key in text or key in emotion:
            tags.update(tag_list)

    return list(tags)


def search_with_filter(query: str, filter_tags: list = None, limit: int = 5):
    """带标签过滤的搜索"""
    params = {
        "query": query,
        "top_k": limit,
        "threshold": 0.1,
        "use_qdrant": True,
        "enable_mmr": True,
        "mmr_lambda": 0.6
    }
    if filter_tags:
        params["filter_tags"] = filter_tags

    resp = requests.post(
        "http://localhost:8000/clip/search",
        json=params
    )

    if not resp.ok:
        return None

    return resp.json()


def test_block(scene: str, text: str, emotion: str = ""):
    """测试单个分镜块"""
    print(f"\n{'='*60}")
    print(f"场景: {scene}")
    print(f"文本: {text}")
    print(f"情绪: {emotion}")

    # 提取过滤标签
    filter_tags = extract_scene_filter(scene, text, emotion)
    print(f"过滤标签: {filter_tags}")

    # 构建查询
    query = text
    if emotion and emotion not in ["平静", "中性"]:
        query = f"{text} {emotion}氛围"

    print(f"查询: {query}")

    # 搜索
    result = search_with_filter(query, filter_tags, limit=3)

    if result and result.get('results'):
        print(f"\n匹配结果:")
        for i, r in enumerate(result['results'][:3]):
            label = r.get('label', '')[:40]
            sim = r.get('similarity', 0)
            tags = r.get('tags', [])[:5]
            print(f"  {i+1}. {label}")
            print(f"     相似度: {sim:.3f}, 标签: {tags}")
    else:
        print("  无匹配结果")


def main():
    # 输出到文件避免编码问题
    import sys
    with open('matching_final.txt', 'w', encoding='utf-8') as f:
        old_stdout = sys.stdout
        sys.stdout = f

        # 测试典型分镜场景
        test_cases = [
            ("办公室", "李明坐在电脑前焦虑地敲打键盘", "紧张"),
            ("街道", "深夜空无一人的街道，路灯昏暗", "恐惧"),
            ("室内", "两人激烈打斗，拳拳到肉", "紧张"),
            ("自然", "阳光穿过树林，鸟儿歌唱", "平静"),
            ("房间", "女孩坐在窗边流泪", "悲伤"),
        ]

        for scene, text, emotion in test_cases:
            test_block(scene, text, emotion)

        sys.stdout = old_stdout

    print("结果已保存到 matching_final.txt")


if __name__ == '__main__':
    main()
