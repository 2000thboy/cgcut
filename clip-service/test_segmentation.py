"""
测试视频分片功能
"""
import sys
sys.path.insert(0, '.')

from clip_server import calculate_segments, SEGMENT_CONFIG

def test_segmentation():
    print("=== 视频分片功能测试 ===\n")
    
    # 测试用例
    test_cases = [
        (5.0, "5秒短视频（不分片）"),
        (10.0, "10秒视频（不分片）"),
        (15.0, "15秒视频（边界，不分片）"),
        (20.0, "20秒视频（分片）"),
        (60.0, "60秒视频（1分钟）"),
        (120.0, "120秒视频（2分钟）"),
    ]
    
    print(f"分片配置:")
    print(f"  - 最小片段时长: {SEGMENT_CONFIG['min_segment_duration']}s")
    print(f"  - 最大片段时长: {SEGMENT_CONFIG['max_segment_duration']}s")
    print(f"  - 默认片段时长: {SEGMENT_CONFIG['default_segment_duration']}s")
    print(f"  - 自动分片阈值: {SEGMENT_CONFIG['auto_segment_threshold']}s")
    print()
    
    for duration, desc in test_cases:
        segments = calculate_segments(duration)
        print(f"【{desc}】")
        print(f"  原始时长: {duration}s")
        print(f"  分片数量: {len(segments)}")
        for seg in segments:
            print(f"    片段{seg['index']}: {seg['start']:.1f}s - {seg['end']:.1f}s (时长: {seg['end']-seg['start']:.1f}s)")
        print()

if __name__ == "__main__":
    test_segmentation()
