import React, { useState, useRef, useEffect } from 'react';
import { useSortable, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Clip } from '../types/DataModel';
import { useAppStore } from '../store/appStore';

const PIXELS_PER_SECOND = 60; // 时间轴缩放比例

interface TimelineProps {
  className?: string;
}

// 时间格式化辅助函数
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
}

// 播放指示器组件
const PlayheadIndicator: React.FC<{ currentTime: number }> = ({ currentTime }) => {
  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
      style={{ left: `${currentTime * PIXELS_PER_SECOND}px` }}
    >
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full" />
    </div>
  );
};

// 视频预览组件
const VideoPreview: React.FC = () => {
  const clips = useAppStore(state => state.clips);
  const playbackState = useAppStore(state => state.playbackState);
  const getShotById = useAppStore(state => state.getShotById);
  const play = useAppStore(state => state.play);
  const pause = useAppStore(state => state.pause);
  const seek = useAppStore(state => state.seek);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameRef = useRef<number>();
  
  // 查找当前时间对应的clip
  const findCurrentClip = () => {
    let accumulatedTime = 0;
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const startTime = accumulatedTime;
      const endTime = accumulatedTime + clip.duration;
      
      if (playbackState.current_time >= startTime && playbackState.current_time < endTime) {
        const internalTime = (playbackState.current_time - startTime) + clip.trim_in;
        return { clip, index: i, internalTime, startTime };
      }
      
      accumulatedTime += clip.duration;
    }
    return null;
  };
  
  const currentClipInfo = findCurrentClip();
  const currentShot = currentClipInfo ? getShotById(currentClipInfo.clip.shot_id) : null;
  
  // 播放循环
  useEffect(() => {
    if (playbackState.is_playing) {
      const updatePlayback = () => {
        const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
        const newTime = playbackState.current_time + 0.016;
        
        if (newTime >= totalDuration) {
          pause();
          seek(0);
        } else {
          seek(newTime);
        }
        
        animationFrameRef.current = requestAnimationFrame(updatePlayback);
      };
      
      animationFrameRef.current = requestAnimationFrame(updatePlayback);
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [playbackState.is_playing, playbackState.current_time, clips, pause, seek]);
  
  // 同步视频时间
  useEffect(() => {
    if (videoRef.current && currentClipInfo && currentShot && currentShot.file_path) {
      const targetTime = currentClipInfo.internalTime;
      
      if (Math.abs(videoRef.current.currentTime - targetTime) > 0.1) {
        videoRef.current.currentTime = targetTime;
      }
      
      if (playbackState.is_playing) {
        videoRef.current.play().catch(err => console.error('Video play error:', err));
      } else {
        videoRef.current.pause();
      }
    }
  }, [currentClipInfo, currentShot, playbackState.is_playing]);
  
  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
  
  const hasValidVideo = currentShot?.file_path && currentShot.file_path.length > 0;
  
  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* 视频播放区域 */}
      <div className="flex-1 flex items-center justify-center relative">
        {currentShot ? (
          hasValidVideo ? (
            <video
              ref={videoRef}
              className="max-w-full max-h-full"
              src={currentShot.file_path}
              muted
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800">
              {/* 无视频时显示镜头信息 */}
              <div className="text-gray-300 text-center">
                <div className="text-5xl mb-4">📹</div>
                <div className="text-xl font-bold mb-2">{currentShot.label}</div>
                <div className="text-sm text-gray-400 mb-2">情绪: {currentShot.emotion}</div>
                <div className="text-xs text-gray-500 mt-4">
                  {currentClipInfo && `${formatTime(currentClipInfo.internalTime)} / ${formatTime(currentShot.duration)}`}
                </div>
                <div className="text-xs text-yellow-500 mt-3">
                  ⚠ 素材未就绪，请在素材库添加视频路径
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="text-gray-400 text-center">
            <div className="text-4xl mb-2">▶</div>
            <div>将镜头添加到时间轴开始预览</div>
          </div>
        )}
        
        {/* 当前镜头信息叠加层 */}
        {currentShot && (
          <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm">
            Clip {(currentClipInfo?.index ?? 0) + 1} / {clips.length}
          </div>
        )}
      </div>
      
      {/* 播放控制栏 */}
      <div className="bg-gray-800 p-3 border-t border-gray-700">
        <div className="flex items-center gap-3">
          {/* 播放/暂停按钮 */}
          <button
            onClick={() => playbackState.is_playing ? pause() : play()}
            disabled={clips.length === 0}
            className="w-10 h-10 flex items-center justify-center bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {playbackState.is_playing ? '⏸' : '▶'}
          </button>
          
          {/* 停止按钮 */}
          <button
            onClick={() => {
              pause();
              seek(0);
            }}
            disabled={clips.length === 0}
            className="w-10 h-10 flex items-center justify-center bg-gray-700 text-white rounded hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            ⏹
          </button>
          
          {/* 时间显示 */}
          <div className="text-white text-sm font-mono">
            {formatTime(playbackState.current_time)} / {formatTime(totalDuration)}
          </div>
          
          {/* 进度条 */}
          <div className="flex-1 relative h-2 bg-gray-700 rounded cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = x / rect.width;
              seek(percentage * totalDuration);
            }}
          >
            <div
              className="absolute top-0 left-0 h-full bg-blue-500 rounded transition-all"
              style={{ width: `${totalDuration > 0 ? (playbackState.current_time / totalDuration) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// 时间刻度标尺组件
const TimeRuler: React.FC<{ totalDuration: number }> = ({ totalDuration }) => {
  const markers = [];
  for (let time = 0; time <= Math.ceil(totalDuration); time++) {
    markers.push(
      <div
        key={time}
        className="absolute flex flex-col items-center"
        style={{ left: `${time * PIXELS_PER_SECOND}px` }}
      >
        <div className="w-px h-4 bg-gray-500" />
        {time % 5 === 0 && (
          <span className="text-xs text-gray-400 mt-1">
            {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}
          </span>
        )}
      </div>
    );
    
    // 添加0.5秒次刻度
    if (time < Math.ceil(totalDuration)) {
      markers.push(
        <div
          key={`${time}.5`}
          className="absolute"
          style={{ left: `${(time + 0.5) * PIXELS_PER_SECOND}px` }}
        >
          <div className="w-px h-2 bg-gray-600" />
        </div>
      );
    }
  }
  
  return <div className="relative w-full h-8 border-b border-gray-600">{markers}</div>;
};

// Clip 组件
const TimelineClip: React.FC<{ clip: Clip; isSelected: boolean; onSelect: () => void; onDelete: () => void }> = ({
  clip,
  isSelected,
  onSelect,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: clip.id });
  const getShotById = useAppStore(state => state.getShotById);
  const shot = getShotById(clip.shot_id);
  const scriptBlocks = useAppStore(state => state.scriptBlocks);
  
  // 查找对应的剧本段落
  const scriptBlock = scriptBlocks.find(b => b.id === clip.script_block_id);
  
  // ✨ MVP修复：识别占位符Clip
  const isPlaceholder = clip.shot_id === 'placeholder' || (!shot || !shot.file_path);
  
  const [_isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);
  
  const handleTrimStart = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.stopPropagation();
    setIsResizing(side);
    // TODO: 实现裁剪拖拽逻辑
  };
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: `${clip.duration * PIXELS_PER_SECOND}px`,
    opacity: isDragging ? 0.5 : 1,
  };
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`
        relative h-16 border rounded flex flex-col justify-center px-2 cursor-move
        ${isSelected ? 'border-blue-500 bg-blue-900' : 'border-gray-600 bg-gray-700'}
        ${isPlaceholder ? 'border-dashed border-yellow-500 bg-yellow-900 bg-opacity-20' : ''}
        hover:shadow-md transition-shadow
      `}
    >
      {/* 占位符标记 */}
      {isPlaceholder && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full whitespace-nowrap z-10">
          📌 占位符
        </div>
      )}
      
      {/* 裁剪手柄 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-blue-500 opacity-0 hover:opacity-100"
        onMouseDown={(e) => handleTrimStart(e, 'left')}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-blue-500 opacity-0 hover:opacity-100"
        onMouseDown={(e) => handleTrimStart(e, 'right')}
      />
      
      <div className="text-xs font-semibold truncate text-gray-200">
        {isPlaceholder ? (
          <span>
            {scriptBlock ? `[占位] ${scriptBlock.scene}` : '占位符'}
          </span>
        ) : (
          <span>{shot?.label || clip.shot_id}</span>
        )}
      </div>
      <div className="text-xs text-gray-400">
        {clip.duration.toFixed(1)}s
        {scriptBlock && (
          <span className="ml-1 text-indigo-400" title={scriptBlock.text}>
            • {scriptBlock.emotion}
          </span>
        )}
      </div>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-1 right-1 text-red-500 hover:text-red-700 text-xs"
      >
        ×
      </button>
    </div>
  );
};

export const SimpleTimeline: React.FC<TimelineProps> = ({ className }) => {
  const clips = useAppStore(state => state.clips);
  const selectedClipId = useAppStore(state => state.selectedClipId);
  const playbackState = useAppStore(state => state.playbackState);
  const reorderClips = useAppStore(state => state.reorderClips);
  const selectClip = useAppStore(state => state.selectClip);
  const deleteClip = useAppStore(state => state.deleteClip);
  const seek = useAppStore(state => state.seek);
  
  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = clips.findIndex(c => c.id === active.id);
      const newIndex = clips.findIndex(c => c.id === over.id);
      
      const newClips = [...clips];
      const [removed] = newClips.splice(oldIndex, 1);
      newClips.splice(newIndex, 0, removed);
      
      reorderClips(newClips);
    }
  };
  
  // 点击时间轴跳转
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (timelineRef.current && !target.closest('[data-clip]')) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + timelineRef.current.scrollLeft;
      const clickedTime = x / PIXELS_PER_SECOND;
      seek(Math.max(0, Math.min(clickedTime, totalDuration)));
    }
  };
  
  return (
    <div className={`flex flex-col bg-gray-800 border border-gray-700 rounded-lg overflow-hidden ${className || ''}`}>
      {/* 视频预览区域 */}
      <div className="h-80 border-b border-gray-700">
        <VideoPreview />
      </div>
      
      {/* 时间轴编辑区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-2 border-b border-gray-700 bg-gray-750">
          <h2 className="text-lg font-bold text-gray-100">时间轴</h2>
          <div className="text-sm text-gray-400">总时长: {totalDuration.toFixed(1)}s</div>
        </div>
        
        {/* 时间刻度和clips */}
        <div className="flex-1 p-4 overflow-x-auto bg-gray-800" ref={timelineRef} onClick={handleTimelineClick}>
          <div className="relative">
            <TimeRuler totalDuration={Math.max(totalDuration, 10)} />
            
            {/* Clip 容器 */}
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={clips.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                <div className="flex gap-2 mt-4 relative min-h-[80px]">
                  {clips.map(clip => (
                    <div key={clip.id} data-clip>
                      <TimelineClip
                        clip={clip}
                        isSelected={selectedClipId === clip.id}
                        onSelect={() => selectClip(clip.id)}
                        onDelete={() => deleteClip(clip.id)}
                      />
                    </div>
                  ))}
                  
                  {/* 播放指示器 */}
                  {clips.length > 0 && <PlayheadIndicator currentTime={playbackState.current_time} />}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
};
