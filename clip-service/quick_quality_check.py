"""
快速质量检查脚本
检查Qdrant中素材数据的标签覆盖率和质量指标
"""
import requests
import json
from collections import Counter

QDRANT_SERVICE = "http://localhost:6333"

def check_qdrant_data_quality():
    """检查Qdrant中的数据质量"""
    print("="*70)
    print("Qdrant 素材数据质量检查")
    print("="*70)
    
    try:
        # 获取集合信息
        resp = requests.get(f"{QDRANT_SERVICE}/collections/video_assets", timeout=5)
        if resp.status_code != 200:
            print(f"❌ 无法访问Qdrant集合")
            return False
        
        collection_info = resp.json()
        total_points = collection_info.get("result", {}).get("points_count", 0)
        print(f"\n📊 集合统计:")
        print(f"  - 总素材数: {total_points}")
        
        if total_points == 0:
            print(f"❌ 集合中没有素材数据")
            return False
        
        # 获取样本数据（最多500条）
        sample_size = min(500, total_points)
        resp = requests.post(
            f"{QDRANT_SERVICE}/collections/video_assets/points/scroll",
            json={
                "limit": sample_size,
                "with_payload": ["tags", "emotions", "description"],
                "with_vector": False
            },
            timeout=30
        )
        
        if resp.status_code != 200:
            print(f"❌ 无法获取样本数据")
            return False
        
        result = resp.json()
        points = result.get("result", {}).get("points", [])
        
        print(f"  - 样本数: {len(points)}")
        
        # 分析标签覆盖率
        all_tags = []
        all_emotions = []
        tag_counts = []
        
        for point in points:
            payload = point.get("payload", {})
            tags = payload.get("tags", [])
            emotions = payload.get("emotions", [])
            
            all_tags.extend(tags)
            all_emotions.extend(emotions)
            tag_counts.append(len(tags))
        
        tag_counter = Counter(all_tags)
        emotion_counter = Counter(all_emotions)
        
        avg_tags = sum(tag_counts) / len(tag_counts) if tag_counts else 0
        
        print(f"\n📈 标签分析:")
        print(f"  - 不同标签数: {len(tag_counter)}")
        print(f"  - 平均每素材标签数: {avg_tags:.1f}")
        print(f"  - 不同情绪数: {len(emotion_counter)}")
        
        print(f"\n🏷️ 高频标签 (Top 15):")
        for tag, count in tag_counter.most_common(15):
            pct = count / len(points) * 100
            print(f"  {tag}: {count} ({pct:.1f}%)")
        
        print(f"\n😊 情绪分布:")
        for emotion, count in emotion_counter.most_common():
            pct = count / len(points) * 100
            print(f"  {emotion}: {count} ({pct:.1f}%)")
        
        # 质量评估
        print(f"\n✅ 质量评估:")
        
        issues = []
        if len(tag_counter) < 30:
            issues.append(f"⚠️ 标签种类较少 ({len(tag_counter)} < 30)")
        else:
            print(f"  ✓ 标签种类丰富 ({len(tag_counter)})")
        
        if avg_tags < 3:
            issues.append(f"⚠️ 平均标签数偏少 ({avg_tags:.1f} < 3)")
        else:
            print(f"  ✓ 标签密度良好 ({avg_tags:.1f} >= 3)")
        
        if len(emotion_counter) < 5:
            issues.append(f"⚠️ 情绪种类较少 ({len(emotion_counter)} < 5)")
        else:
            print(f"  ✓ 情绪覆盖充分 ({len(emotion_counter)})")
        
        if total_points < 100:
            issues.append(f"⚠️ 素材数量较少 ({total_points} < 100)")
        else:
            print(f"  ✓ 素材数量充足 ({total_points})")
        
        if issues:
            print(f"\n问题列表:")
            for issue in issues:
                print(f"  {issue}")
            return False
        else:
            print(f"\n🎉 数据质量良好，可以进行检索测试")
            return True
            
    except Exception as e:
        print(f"❌ 检查失败: {e}")
        return False

def test_simple_search():
    """测试简单的向量搜索（不依赖CLIP服务）"""
    print(f"\n{'='*70}")
    print("简单搜索测试（使用随机向量）")
    print("="*70)
    
    try:
        # 创建一个随机向量（512维）
        import random
        random_vector = [random.random() for _ in range(512)]
        
        resp = requests.post(
            f"{QDRANT_SERVICE}/collections/video_assets/points/search",
            json={
                "vector": random_vector,
                "limit": 5,
                "with_payload": True
            },
            timeout=10
        )
        
        if resp.status_code != 200:
            print(f"❌ 搜索失败")
            return False
        
        result = resp.json()
        matches = result.get("result", [])
        
        print(f"\n找到 {len(matches)} 个结果:")
        for i, match in enumerate(matches):
            payload = match.get("payload", {})
            print(f"\n[{i+1}] 相似度: {match.get('score', 0):.4f}")
            print(f"    文件: ...{payload.get('filePath', '')[-60:]}")
            print(f"    标签: {payload.get('tags', [])[:5]}")
        
        return True
        
    except Exception as e:
        print(f"❌ 搜索测试失败: {e}")
        return False

def main():
    """主函数"""
    print(f"\n{'#'*70}")
    print("# 素材召回质量 - 快速检查")
    print(f"{'#'*70}\n")
    
    # Step 1: 检查数据质量
    data_ok = check_qdrant_data_quality()
    
    if not data_ok:
        print(f"\n{'='*70}")
        print("⚠️ 数据质量检查未通过")
        print("建议:")
        print("  1. 检查素材是否已正确导入Qdrant")
        print("  2. 运行: python migrate_to_qdrant.py")
        print("  3. 或使用管理界面同步素材")
        print("="*70)
        return 1
    
    # Step 2: 测试搜索功能
    search_ok = test_simple_search()
    
    if not search_ok:
        print(f"\n⚠️ 搜索功能测试失败")
        return 1
    
    print(f"\n{'='*70}")
    print("✅ 基础检查通过")
    print("\n下一步:")
    print("  1. 启动CLIP服务（如未运行）")
    print("  2. 运行完整测试: python search_quality_improvement_spec.py")
    print("="*70)
    
    return 0

if __name__ == "__main__":
    exit(main())
