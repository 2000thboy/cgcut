"""
测试Chinese-CLIP模型 - 调试返回值结构
"""
import torch

print("1. 加载模型...")
from transformers import ChineseCLIPModel, ChineseCLIPProcessor

MODEL_NAME = "OFA-Sys/chinese-clip-vit-base-patch16"
processor = ChineseCLIPProcessor.from_pretrained(MODEL_NAME)
model = ChineseCLIPModel.from_pretrained(MODEL_NAME)

device = "cpu"
model = model.to(device)
model.eval()

print(f"   模型: {MODEL_NAME}")
print(f"   设备: {device}")

print("\n2. 检查模型结构...")
print(f"   text_projection shape: {model.text_projection.weight.shape}")
print(f"   visual_projection shape: {model.visual_projection.weight.shape}")

print("\n3. 测试文本编码...")
test_text = "紧张的办公室场景"

with torch.no_grad():
    inputs = processor(text=[test_text], return_tensors="pt", padding=True)
    print(f"   inputs keys: {inputs.keys()}")
    
    input_ids = inputs["input_ids"].to(device)
    attention_mask = inputs["attention_mask"].to(device)
    
    # 检查text_model输出
    text_outputs = model.text_model(
        input_ids=input_ids,
        attention_mask=attention_mask,
        output_hidden_states=True,
        return_dict=True
    )
    print(f"   text_outputs type: {type(text_outputs)}")
    print(f"   text_outputs keys: {text_outputs.keys() if hasattr(text_outputs, 'keys') else 'N/A'}")
    
    # 获取last_hidden_state
    if hasattr(text_outputs, 'last_hidden_state'):
        last_hidden = text_outputs.last_hidden_state
        print(f"   last_hidden_state shape: {last_hidden.shape}")
        # 取[CLS]位置
        cls_output = last_hidden[:, 0, :]
        print(f"   cls_output shape: {cls_output.shape}")
        
        # 投影
        text_features = model.text_projection(cls_output)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)
        print(f"   text_features shape: {text_features.shape}")
    
    if hasattr(text_outputs, 'pooler_output') and text_outputs.pooler_output is not None:
        print(f"   pooler_output shape: {text_outputs.pooler_output.shape}")

print("\n4. 测试图像编码...")
from PIL import Image
import numpy as np

test_image = Image.fromarray(np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8))

with torch.no_grad():
    inputs = processor(images=test_image, return_tensors="pt")
    pixel_values = inputs["pixel_values"].to(device)
    
    vision_outputs = model.vision_model(
        pixel_values=pixel_values,
        output_hidden_states=True,
        return_dict=True
    )
    print(f"   vision_outputs keys: {vision_outputs.keys() if hasattr(vision_outputs, 'keys') else 'N/A'}")
    
    if hasattr(vision_outputs, 'last_hidden_state'):
        last_hidden = vision_outputs.last_hidden_state
        print(f"   last_hidden_state shape: {last_hidden.shape}")
        cls_output = last_hidden[:, 0, :]
        print(f"   cls_output shape: {cls_output.shape}")
        
        image_features = model.visual_projection(cls_output)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        print(f"   image_features shape: {image_features.shape}")
    
    if hasattr(vision_outputs, 'pooler_output') and vision_outputs.pooler_output is not None:
        print(f"   pooler_output shape: {vision_outputs.pooler_output.shape}")

print("\n5. 测试相似度计算...")
print(f"   text-image similarity: {(text_features @ image_features.T).item():.4f}")

print("\n=== 测试完成 ===")
