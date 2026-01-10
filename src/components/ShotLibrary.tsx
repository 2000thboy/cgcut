import React, { useState, useRef } from 'react';
import { Shot, ShotStatus } from '../types/DataModel';
import { useAppStore } from '../store/appStore';
import { replaceClipShot } from '../types/DataModel';
import { AssetManagerModal } from './AssetManagerModal';

interface ShotLibraryProps {
  className?: string;
}

export const ShotLibrary: React.FC<ShotLibraryProps> = ({ className }) => {
  const shots = useAppStore(state => state.shots);
  const setShots = useAppStore(state => state.setShots);
  const deleteShot = useAppStore(state => state.deleteShot);
  const updateShotStatus = useAppStore(state => state.updateShotStatus);
  const mediaLibrary = useAppStore(state => state.mediaLibrary);
  const setMediaLibrary = useAppStore(state => state.setMediaLibrary);
  const selectedClipId = useAppStore(state => state.selectedClipId);
  const getClipById = useAppStore(state => state.getClipById);
  const updateClip = useAppStore(state => state.updateClip);
  
  const [emotionFilter, setEmotionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showPathConfig, setShowPathConfig] = useState(false);
  const [libraryPath, setLibraryPath] = useState(mediaLibrary?.base_path || '');
  const [showAssetManager, setShowAssetManager] = useState(false);
  const pathInputRef = useRef<HTMLInputElement>(null);
  
  const emotions = ['all', ...Array.from(new Set(shots.map(s => s.emotion)))];
  
  // 统计数据
  const readyCount = shots.filter(s => s.status === 'ready').length;
  const pendingCount = shots.filter(s => s.status === 'pending').length;
  const processingCount = shots.filter(s => s.status === 'processing').length;
  
  const filteredShots = shots.filter(s => {
    if (emotionFilter !== 'all' && s.emotion !== emotionFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });
  
  const handleReplaceShot = (shot: Shot) => {
    if (!selectedClipId) {
      alert('请先选择时间轴中的一个 Clip');
      return;
    }
    
    const clip = getClipById(selectedClipId);
    if (!clip) return;
    
    const newClip = replaceClipShot(clip, shot);
    updateClip(clip.id, newClip);
  };
  
  // 设置素材库路径
  const handleSetLibraryPath = () => {
    if (!libraryPath) return;
    
    setMediaLibrary({
      base_path: libraryPath,
      total_files: 0,
      processed_files: readyCount,
      pending_files: pendingCount,
      last_scan_time: new Date().toISOString(),
    });
    setShowPathConfig(false);
    alert('素材库路径已设置');
  };
  
  // 标记素材为已处理
  const handleMarkAsReady = (shotId: string) => {
    updateShotStatus(shotId, 'ready');
  };
  
  // 编辑镜头信息
  const handleEditShot = (shot: Shot) => {
    const newLabel = prompt('请输入镜头标签:', shot.label);
    if (newLabel && newLabel !== shot.label) {
      const updatedShots = shots.map(s => 
        s.id === shot.id ? { ...s, label: newLabel } : s
      );
      setShots(updatedShots);
    }
  };
  
  // 修改情绪
  const handleChangeEmotion = (shot: Shot) => {
    const emotionList = ['焦虑', '紧张', '平静', '恐惧', '释然'];
    const newEmotion = prompt('请选择情绪\n' + emotionList.join(', '), shot.emotion);
    if (newEmotion && emotionList.includes(newEmotion)) {
      const updatedShots = shots.map(s => 
        s.id === shot.id ? { ...s, emotion: newEmotion } : s
      );
      setShots(updatedShots);
    }
  };
  
  // 删除镜头
  const handleDeleteShot = (shotId: string) => {
    if (confirm('确定要删除这个素材吗？')) {
      deleteShot(shotId);
    }
  };
  
  // 获取状态显示
  const getStatusDisplay = (status: ShotStatus) => {
    switch (status) {
      case 'ready': return { text: '已处理', color: 'bg-green-600', icon: '✓' };
      case 'pending': return { text: '待处理', color: 'bg-yellow-600', icon: '○' };
      case 'processing': return { text: '处理中', color: 'bg-blue-600', icon: '↻' };
      case 'error': return { text: '错误', color: 'bg-red-600', icon: '✗' };
      default: return { text: '未知', color: 'bg-gray-600', icon: '?' };
    }
  };
  
  return (
    <div className={`flex flex-col bg-gray-800 border border-gray-700 rounded-lg ${className || ''}`}>
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-100">素材库</h2>
          <button
            onClick={() => setShowAssetManager(true)}
            className="px-4 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            📂 素材管理
          </button>
        </div>
        
        {/* 素材库状态 */}
        <div className="mb-3 p-2 bg-gray-750 rounded text-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">素材库路径:</span>
            <button
              onClick={() => setShowPathConfig(true)}
              className="text-blue-400 hover:text-blue-300"
            >
              {mediaLibrary?.base_path || '未设置 - 点击配置'}
            </button>
          </div>
          <div className="flex gap-4 text-gray-300">
            <span className="text-green-400">✓ {readyCount} 已处理</span>
            <span className="text-yellow-400">○ {pendingCount} 待处理</span>
            <span className="text-blue-400">↻ {processingCount} 处理中</span>
          </div>
        </div>

        
        {/* 筛选器 */}
        <div className="space-y-2">
          {/* 情绪筛选 */}
          <div className="flex gap-1 flex-wrap">
            {emotions.map(emotion => (
              <button
                key={emotion}
                onClick={() => setEmotionFilter(emotion)}
                className={`
                  px-2 py-0.5 rounded text-xs transition-colors
                  ${emotionFilter === emotion 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }
                `}
              >
                {emotion === 'all' ? '全部' : emotion}
              </button>
            ))}
          </div>
          
          {/* 状态筛选 */}
          <div className="flex gap-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-0.5 rounded text-xs ${statusFilter === 'all' ? 'bg-gray-600' : 'bg-gray-700'} text-gray-300`}
            >
              全部
            </button>
            <button
              onClick={() => setStatusFilter('ready')}
              className={`px-2 py-0.5 rounded text-xs ${statusFilter === 'ready' ? 'bg-green-600' : 'bg-gray-700'} text-gray-300`}
            >
              已处理
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-2 py-0.5 rounded text-xs ${statusFilter === 'pending' ? 'bg-yellow-600' : 'bg-gray-700'} text-gray-300`}
            >
              待处理
            </button>
          </div>
        </div>
      </div>
      
      {/* 素材列表 */}
      <div className="flex-1 p-3 overflow-y-auto">
        {shots.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-4">🎬</div>
            <div>暂无素材</div>
            <div className="text-xs mt-2">点击"添加路径"引用视频文件</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {filteredShots.map(shot => {
              const statusInfo = getStatusDisplay(shot.status);
              return (
                <div
                  key={shot.id}
                  className="border border-gray-600 rounded-lg p-2 hover:bg-gray-700 transition-colors cursor-pointer group"
                  onClick={() => handleReplaceShot(shot)}
                >
                  <div className="flex items-center gap-2">
                    {/* 状态指示器 */}
                    <div className={`w-6 h-6 ${statusInfo.color} rounded flex items-center justify-center text-white text-xs`}>
                      {statusInfo.icon}
                    </div>
                    
                    {/* 素材信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-200 truncate">{shot.label}</div>
                      <div className="text-xs text-gray-500 truncate">{shot.file_path}</div>
                      
                      {/* CLIP 标签 */}
                      {shot.clip_metadata && shot.clip_metadata.tags && shot.clip_metadata.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {shot.clip_metadata.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-xs px-1 py-0.5 bg-indigo-900 text-indigo-200 rounded"
                              title={shot.clip_metadata?.description || ''}
                            >
                              {tag}
                            </span>
                          ))}
                          {shot.clip_metadata.tags.length > 3 && (
                            <span className="text-xs text-gray-500">+{shot.clip_metadata.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* 情绪和时长 */}
                    <div className="text-right">
                      <div className={`text-xs px-1 rounded ${
                        shot.emotion === '紧张' ? 'bg-red-900 text-red-200' :
                        shot.emotion === '焦虑' ? 'bg-orange-900 text-orange-200' :
                        shot.emotion === '恐惧' ? 'bg-purple-900 text-purple-200' :
                        shot.emotion === '释然' ? 'bg-green-900 text-green-200' :
                        'bg-gray-700 text-gray-300'
                      }`}>
                        {shot.emotion}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{shot.duration.toFixed(1)}s</div>
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {shot.status === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsReady(shot.id);
                          }}
                          className="px-1 py-0.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          title="标记为已处理"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditShot(shot);
                        }}
                        className="px-1 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChangeEmotion(shot);
                        }}
                        className="px-1 py-0.5 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                        title="情绪"
                      >
                        🎭
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteShot(shot.id);
                        }}
                        className="px-1 py-0.5 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                        title="删除"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {selectedClipId && (
        <div className="p-2 bg-blue-900 border-t border-gray-700 text-sm text-center text-gray-200">
          已选中 Clip，点击素材即可替换
        </div>
      )}
      
      {/* 素材管理弹窗 */}
      <AssetManagerModal
        isOpen={showAssetManager}
        onClose={() => setShowAssetManager(false)}
      />
      
      {/* 路径配置模态框 */}
      {showPathConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-lg font-bold text-gray-100 mb-4">配置素材库路径</h3>
            
            <input
              ref={pathInputRef}
              type="text"
              value={libraryPath}
              onChange={(e) => setLibraryPath(e.target.value)}
              placeholder="输入素材库根路径..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 mb-4"
            />
            
            <p className="text-xs text-gray-500 mb-4">
              示例: /mnt/media/video_library 或 D:\Videos\Project
            </p>
            
            <div className="flex gap-2">
              <button
                onClick={() => setShowPathConfig(false)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
              >
                取消
              </button>
              <button
                onClick={handleSetLibraryPath}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
