"""
LLM标签生成测试脚本 - 方案A小规模验证
使用GLM-4-Plus为视频生成多层次标签
"""
import sys
import json
import os
from pathlib import Path

# 设置控制台编码
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# 检查API Key
if not os.getenv("ZHIPU_API_KEY"):
    print("❌ 错误：未设置ZHIPU_API_KEY环境变量")
    print("请在环境变量中设置API Key")
    sys.exit(1)

from zhipuai import ZhipuAI

# 初始化客户端
client = ZhipuAI(api_key=os.getenv("ZHIPU_API_KEY"))

# 标签体系定义（参考淘宝8类原子标签）
TAG_SCHEMA = {
    "场景类型": ["室内场景", "室外场景", "自然风景", "城市街道", "办公室", "房间", "停车场"],
    "镜头类型": ["特写镜头", "近景镜头", "中景镜头", "全景镜头", "远景镜头"],
    "主体对象": ["人物", "面部特写", "手部特写", "群体场景", "无人场景"],
    "动作行为": ["行走", "奔跑", "静坐", "对话交流", "工作", "休息"],
    "情绪氛围": ["紧张氛围", "平静氛围", "激动氛围", "悲伤氛围", "快乐氛围", "恐惧氛围", "中性氛围"],
    "光线环境": ["明亮光线", "昏暗光线", "自然光", "人工光"],
    "时间段": ["白天", "夜晚", "黄昏", "清晨"]
}

def generate_tags_for_video(video_label: str, old_tags: list, old_description: str) -> dict:
    """
    使用GLM-4-Plus生成新标签
    
    Args:
        video_label: 视频文件名
        old_tags: 现有标签列表
        old_description: 现有描述
    
    Returns:
        新标签数据字典
    """
    prompt = f"""你是一个视频内容分析专家。请基于以下信息，为视频生成结构化的多层次标签。

视频文件名: {video_label}
现有标签: {', '.join(old_tags)}
现有描述: {old_description}

请根据标签体系生成新标签：
{json.dumps(TAG_SCHEMA, ensure_ascii=False, indent=2)}

要求：
1. 从每个类别中选择1-3个最相关的标签
2. 标签必须从上述标签体系中选择（不要自己创造新标签）
3. 返回JSON格式，包含以下字段：
   - tags: 所有标签的扁平列表（用于检索）
   - categorized_tags: 按类别组织的标签字典
   - description: 简洁的场景描述（50字以内）
   - confidence: 置信度（0-1之间）

示例输出：
{{
  "tags": ["室内场景", "办公室", "中景镜头", "人物", "工作", "紧张氛围", "明亮光线", "白天"],
  "categorized_tags": {{
    "场景类型": ["室内场景", "办公室"],
    "镜头类型": ["中景镜头"],
    "主体对象": ["人物"],
    "动作行为": ["工作"],
    "情绪氛围": ["紧张氛围"],
    "光线环境": ["明亮光线"],
    "时间段": ["白天"]
  }},
  "description": "室内办公室，人物在明亮光线下工作，呈现紧张氛围",
  "confidence": 0.85
}}

只返回JSON，不要其他文字。"""

    try:
        response = client.chat.completions.create(
            model="glm-4-plus",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # 解析JSON响应
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        result_text = result_text.strip()
        
        result = json.loads(result_text)
        return result
        
    except Exception as e:
        print(f"  ⚠️ LLM调用失败: {e}")
        return None


def main():
    print("=" * 60)
    print("方案A: LLM标签生成小规模验证（50个样本）")
    print("=" * 60)
    
    # 加载测试样本
    sample_file = "test_sample_50.json"
    if not Path(sample_file).exists():
        print(f"❌ 错误：找不到样本文件 {sample_file}")
        print("请先运行选取样本的命令")
        sys.exit(1)
    
    with open(sample_file, 'r', encoding='utf-8') as f:
        samples = json.load(f)
    
    print(f"\n✅ 加载了 {len(samples)} 个测试样本")
    print(f"预计API调用次数: {len(samples)}")
    print(f"预计耗时: {len(samples) * 3} 秒（每次约3秒）\n")
    
    # 询问用户确认
    confirm = input("是否继续？输入 'yes' 确认: ")
    if confirm.lower() != 'yes':
        print("已取消")
        return
    
    # 逐个处理
    results = []
    success_count = 0
    fail_count = 0
    
    for idx, sample in enumerate(samples):
        print(f"\n[{idx+1}/{len(samples)}] 处理: {sample.get('label', 'unknown')}")
        
        old_tags = sample.get('clipMetadata', {}).get('tags', [])
        old_desc = sample.get('clipMetadata', {}).get('description', '')
        
        print(f"  旧标签: {', '.join(old_tags[:5])}...")
        
        new_tags = generate_tags_for_video(
            sample.get('label', ''),
            old_tags,
            old_desc
        )
        
        if new_tags:
            print(f"  ✅ 新标签: {', '.join(new_tags['tags'][:5])}...")
            print(f"  置信度: {new_tags.get('confidence', 0):.2f}")
            
            results.append({
                "shotId": sample.get('shotId'),
                "label": sample.get('label'),
                "old_tags": old_tags,
                "old_description": old_desc,
                "new_tags": new_tags['tags'],
                "categorized_tags": new_tags['categorized_tags'],
                "new_description": new_tags['description'],
                "confidence": new_tags.get('confidence', 0)
            })
            success_count += 1
        else:
            fail_count += 1
    
    # 保存结果
    output_file = "llm_tags_test_results.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'=' * 60}")
    print(f"处理完成！")
    print(f"  成功: {success_count}")
    print(f"  失败: {fail_count}")
    print(f"  结果保存到: {output_file}")
    print(f"{'=' * 60}")
    
    # 简单分析
    if results:
        avg_confidence = sum(r['confidence'] for r in results) / len(results)
        print(f"\n平均置信度: {avg_confidence:.2f}")
        
        # 对比标签数量
        avg_old = sum(len(r['old_tags']) for r in results) / len(results)
        avg_new = sum(len(r['new_tags']) for r in results) / len(results)
        print(f"平均标签数: 旧={avg_old:.1f}, 新={avg_new:.1f}")


if __name__ == "__main__":
    main()
