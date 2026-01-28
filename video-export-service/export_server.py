"""
视频导出服务
使用MoviePy合成最终视频
"""

import os
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from moviepy import VideoFileClip, concatenate_videoclips, CompositeVideoClip, TextClip

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="CGCUT 视频导出服务",
    description="将时间轴素材合成为最终视频",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 输出目录
OUTPUT_DIR = Path("f:/100qoder project/CGCUT/exports")
OUTPUT_DIR.mkdir(exist_ok=True)


class ClipInfo(BaseModel):
    shot_id: str
    file_path: str
    duration: float
    trim_in: float = 0
    trim_out: float = 0


class ExportRequest(BaseModel):
    clips: List[ClipInfo]
    output_filename: str = "cgcut_output.mp4"
    resolution: tuple = (1920, 1080)
    fps: int = 30


class ExportResponse(BaseModel):
    status: str
    output_path: str
    duration: float
    file_size: int
    export_time: float


@app.get("/")
async def root():
    return {
        "service": "CGCUT Video Export Service",
        "status": "running",
        "moviepy_version": "2.2.1"
    }


@app.post("/export", response_model=ExportResponse)
async def export_video(request: ExportRequest):
    """
    合成最终视频
    """
    start_time = datetime.now()
    logger.info(f"开始导出视频，共 {len(request.clips)} 个片段")

    try:
        video_clips = []
        total_duration = 0

        # 加载并裁剪每个片段
        for idx, clip_info in enumerate(request.clips):
            logger.info(
                f"处理片段 {idx+1}/{len(request.clips)}: {clip_info.file_path}")
            logger.info(f"文件路径bytes: {clip_info.file_path.encode('utf-8')}")

            # 检查文件是否存在
            file_path = clip_info.file_path.replace(
                '/', os.sep).replace('\\', os.sep)
            logger.info(f"规范化路径: {file_path}")
            if not os.path.exists(file_path):
                logger.warning(f"文件不存在: {file_path}，跳过")
                continue

            try:
                # 加载视频
                video = VideoFileClip(file_path)

                # 裁剪时间范围
                if clip_info.trim_out > 0:
                    video = video.subclipped(
                        clip_info.trim_in, clip_info.trim_out)
                elif clip_info.duration > 0:
                    # 使用指定时长
                    end_time = min(clip_info.trim_in +
                                   clip_info.duration, video.duration)
                    video = video.subclipped(clip_info.trim_in, end_time)

                # 调整分辨率
                if request.resolution:
                    video = video.resized(new_size=request.resolution)

                video_clips.append(video)
                total_duration += video.duration

            except Exception as e:
                logger.error(f"处理片段失败: {e}")
                continue

        if not video_clips:
            raise HTTPException(status_code=400, detail="没有有效的视频片段")

        logger.info(f"成功加载 {len(video_clips)} 个片段，总时长 {total_duration:.2f}秒")

        # 合并视频
        logger.info("正在合并视频...")
        final_video = concatenate_videoclips(video_clips, method="compose")

        # 设置帧率
        final_video = final_video.with_fps(request.fps)

        # 输出路径
        output_path = OUTPUT_DIR / request.output_filename
        logger.info(f"正在写入文件: {output_path}")

        # 导出视频
        final_video.write_videofile(
            str(output_path),
            codec='libx264',
            audio_codec='aac',
            temp_audiofile='temp-audio.m4a',
            remove_temp=True,
            fps=request.fps
        )

        # 清理内存
        final_video.close()
        for clip in video_clips:
            clip.close()

        # 获取文件信息
        file_size = os.path.getsize(output_path)
        export_duration = (datetime.now() - start_time).total_seconds()

        logger.info(
            f"视频导出完成: {output_path}, 大小: {file_size/1024/1024:.2f}MB, 耗时: {export_duration:.2f}秒")

        return ExportResponse(
            status="success",
            output_path=str(output_path),
            duration=total_duration,
            file_size=file_size,
            export_time=export_duration
        )

    except Exception as e:
        logger.error(f"视频导出失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/download/{filename}")
async def download_video(filename: str):
    """
    下载导出的视频
    """
    file_path = OUTPUT_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        path=str(file_path),
        media_type="video/mp4",
        filename=filename
    )


@app.get("/list")
async def list_exports():
    """
    列出所有导出的视频
    """
    files = []
    for file in OUTPUT_DIR.glob("*.mp4"):
        stat = file.stat()
        files.append({
            "filename": file.name,
            "size": stat.st_size,
            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "path": str(file)
        })

    return {"exports": files, "total": len(files)}


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "ok",
        "service": "export-service",
        "output_dir": str(OUTPUT_DIR)
    }

if __name__ == "__main__":
    import uvicorn

    print("=" * 50)
    print("CGCUT 视频导出服务")
    print("=" * 50)
    print("端口: 8002")
    print("输出目录:", OUTPUT_DIR)
    print("=" * 50)

    uvicorn.run(app, host="0.0.0.0", port=8002)
