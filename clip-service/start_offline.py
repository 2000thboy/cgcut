"""离线模式启动CLIP服务"""
import os

# 设置离线模式环境变量
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_DATASETS_OFFLINE'] = '1'

# 导入并运行主服务
import clip_server
import uvicorn

if __name__ == "__main__":
    print("=" * 50)
    print("CLIP视频打标服务 (离线模式)")
    print("=" * 50)
    
    # 预加载模型
    clip_server.clip_manager.load_model()
    
    # 启动服务
    uvicorn.run(clip_server.app, host="0.0.0.0", port=8000)
