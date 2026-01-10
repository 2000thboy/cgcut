import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { Shot } from '../types/DataModel';
import { clipService } from '../services/clipService';

interface AssetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 素材库管理弹窗
 * 集成快速加载和CLIP扫描功能
 */
export const AssetManagerModal: React.FC<AssetManagerModalProps> = ({ isOpen, onClose }) => {
  const shots = useAppStore(state => state.shots);
  const setShots = useAppStore(state => state.setShots);
  const deleteShot = useAppStore(state => state.deleteShot);
  const mediaLibrary = useAppStore(state => state.mediaLibrary);
  const setMediaLibrary = useAppStore(state => state.setMediaLibrary);
  
  const [selectedTab, setSelectedTab] = useState<'all' | 'ready' | 'pending' | 'processing' | 'error'>('all');
  const [selectedShots, setSelectedShots] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'duration' | 'status' | 'date'>('date');
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // 路径配置
  const [showPathConfig, setShowPathConfig] = useState(false);
  const [libraryPath, setLibraryPath] = useState(mediaLibrary?.base_path || 'U:\\PreVis_Assets');
  
  // 统计数据
  const stats = useMemo(() => {
    const total = shots.length;
    const processed = shots.filter(s => s.status === 'ready').length;
    const pending = shots.filter(s => s.status === 'pending').length;
    const processing = shots.filter(s => s.status === 'processing').length;
    const error = shots.filter(s => s.status === 'error').length;
    return { total, processed, pending, processing, error };
  }, [shots]);
  
  // 过滤和排序素材
  const filteredShots = useMemo(() => {
    let filtered = [...shots];
    
    // 按状态过滤
    if (selectedTab !== 'all') {
      filtered = filtered.filter(s => s.status === selectedTab);
    }
    
    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.label.toLowerCase().includes(query) ||
        s.emotion.toLowerCase().includes(query) ||
        s.file_path?.toLowerCase().includes(query) ||
        s.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // 排序
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.label.localeCompare(b.label);
        case 'duration': return b.duration - a.duration;
        case 'status': return a.status.localeCompare(b.status);
        default: return 0;
      }
    });
    
    return filtered;
  }, [shots, selectedTab, searchQuery, sortBy]);

  // ============================================
  // 加载已处理的结果（从CLIP后台）
  // ============================================
  const handleLoadProcessed = async () => {
    setIsLoading(true);
    setLoadingMessage('正在加载已处理的素材...');
    setLoadingProgress(20);
    
    try {
      const response = await clipService.getProcessedResults();
      
      setLoadingProgress(60);
      
      if (response.total === 0) {
        setIsLoading(false);
        setLoadingMessage('');
        alert('没有找到已处理的素材。\n\n请先访问 http://localhost:8000 进行CLIP批量处理。');
        return;
      }
      
      // 转换为 shots 数据
      const newShots: Shot[] = response.results
        .filter((r: any) => r.status === 'success' && r.clipMetadata)
        .map((r: any) => ({
          id: r.shotId || `shot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          label: r.clipMetadata?.description || r.label || '未知',
          emotion: r.clipMetadata?.emotions?.[0]?.replace('氛围', '') || '平静',
          duration: r.duration || 5,
          file_path: r.filePath,
          status: 'ready' as const,
          tags: r.clipMetadata?.tags || [],
          clip_metadata: r.clipMetadata,
        }));
      
      setLoadingProgress(90);
      setShots(newShots);
      
      setMediaLibrary({
        base_path: libraryPath || 'U:\\PreVis_Assets',
        total_files: response.total,
        processed_files: newShots.length,
        pending_files: 0,
        last_scan_time: new Date().toISOString(),
      });
      
      setLoadingProgress(100);
      setIsLoading(false);
      setLoadingMessage('');
      
      alert(`✅ 加载完成！\n\n已加载 ${newShots.length} 个已处理素材`);
      
    } catch (error) {
      console.error('加载已处理结果失败:', error);
      setIsLoading(false);
      setLoadingMessage('');
      alert('❌ 加载失败: ' + (error as Error).message + '\n\n请确保CLIP服务已启动 (http://localhost:8000)');
    }
  };

  // ============================================
  // 快速加载素材库（不做CLIP处理）
  // ============================================
  const handleQuickLoad = async () => {
    const path = libraryPath || mediaLibrary?.base_path;
    if (!path) {
      alert('请先设置素材库路径');
      setShowPathConfig(true);
      return;
    }
    
    setIsLoading(true);
    setLoadingMessage('正在快速扫描素材库...');
    setLoadingProgress(10);
    
    try {
      // 不限制数量，加载所有文件
      const response = await clipService.quickList(path, 0);
      
      setLoadingProgress(50);
      setLoadingMessage(`发现 ${response.summary.totalFiles} 个文件，正在加载...`);
      
      // 转换为 shots 数据
      const newShots: Shot[] = response.files.map(f => ({
        id: f.shotId,
        label: f.label,
        emotion: '平静',
        duration: f.duration,
        file_path: f.filePath,
        status: 'pending' as const,
        tags: [],
      }));
      
      setLoadingProgress(80);
      setShots(newShots);
      
      // 更新素材库配置
      setMediaLibrary({
        base_path: path,
        total_files: response.summary.totalFiles,
        processed_files: 0,
        pending_files: response.summary.totalFiles,
        last_scan_time: new Date().toISOString(),
      });
      
      setLoadingProgress(100);
      setLoadingMessage('');
      setIsLoading(false);
      
      alert(`✅ 快速加载完成！\n\n已加载 ${newShots.length} 个素材文件`);
      
    } catch (error) {
      console.error('快速加载失败:', error);
      setIsLoading(false);
      setLoadingMessage('');
      alert('❌ 快速加载失败: ' + (error as Error).message);
    }
  };
  
  // ============================================
  // 保存路径配置
  // ============================================
  const handleSavePath = () => {
    if (!libraryPath.trim()) return;
    
    setMediaLibrary({
      base_path: libraryPath.trim(),
      total_files: 0,
      processed_files: 0,
      pending_files: 0,
      last_scan_time: new Date().toISOString(),
    });
    setShowPathConfig(false);
  };
  
  // 批量删除
  const handleBatchDelete = () => {
    if (selectedShots.size === 0) {
      alert('请先选择要删除的素材');
      return;
    }
    if (!confirm(`确定要删除 ${selectedShots.size} 个素材吗？`)) return;
    
    selectedShots.forEach(id => deleteShot(id));
    setSelectedShots(new Set());
  };
  
  // 清空素材库
  const handleClearAll = () => {
    if (!confirm('确定要清空所有素材吗？此操作不可恢复！')) return;
    setShots([]);
    setSelectedShots(new Set());
  };
  
  // 全选/取消全选
  const handleToggleSelectAll = () => {
    if (selectedShots.size === filteredShots.length) {
      setSelectedShots(new Set());
    } else {
      setSelectedShots(new Set(filteredShots.map(s => s.id)));
    }
  };
  
  const getStatusDisplay = (status: Shot['status']) => {
    switch (status) {
      case 'ready': return { text: '已处理', color: 'bg-green-600', icon: '✓' };
      case 'pending': return { text: '待处理', color: 'bg-yellow-600', icon: '○' };
      case 'processing': return { text: '处理中', color: 'bg-blue-600', icon: '↻' };
      case 'error': return { text: '错误', color: 'bg-red-600', icon: '✗' };
      default: return { text: '未知', color: 'bg-gray-600', icon: '?' };
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg w-full max-w-6xl h-5/6 flex flex-col border border-gray-700">
        {/* 顶部标题栏 */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">素材库管理</h2>
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
              <span>{mediaLibrary?.base_path || '未设置路径'}</span>
              <button
                onClick={() => setShowPathConfig(true)}
                className="text-blue-400 hover:text-blue-300 text-xs"
              >
                [修改]
              </button>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 text-3xl px-2">×</button>
        </div>
        
        {/* 统计卡片 + 操作按钮 */}
        <div className="p-4 border-b border-gray-700 bg-gray-850">
          <div className="flex gap-4 items-start">
            {/* 统计卡片 */}
            <div className="flex gap-3 flex-1">
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 min-w-[100px]">
                <div className="text-gray-400 text-xs mb-1">总素材</div>
                <div className="text-2xl font-bold text-gray-100">{stats.total}</div>
              </div>
              <div className="bg-green-900/30 rounded-lg p-3 border border-green-800 min-w-[100px]">
                <div className="text-green-400 text-xs mb-1">✓ 已处理</div>
                <div className="text-2xl font-bold text-green-300">{stats.processed}</div>
              </div>
              <div className="bg-yellow-900/30 rounded-lg p-3 border border-yellow-800 min-w-[100px]">
                <div className="text-yellow-400 text-xs mb-1">○ 待处理</div>
                <div className="text-2xl font-bold text-yellow-300">{stats.pending}</div>
              </div>
              <div className="bg-red-900/30 rounded-lg p-3 border border-red-800 min-w-[100px]">
                <div className="text-red-400 text-xs mb-1">✗ 错误</div>
                <div className="text-2xl font-bold text-red-300">{stats.error}</div>
              </div>
            </div>
            
            {/* 核心操作按钮 */}
            <div className="flex gap-2">
              <button
                onClick={handleLoadProcessed}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-600 flex items-center gap-2"
                title="加载CLIP后台已处理的素材"
              >
                <span>📥</span>
                <span>加载已处理</span>
              </button>
              <button
                onClick={handleQuickLoad}
                disabled={isLoading}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:bg-gray-600 flex items-center gap-2"
              >
                <span>⚡</span>
                <span>快速加载</span>
              </button>
              <a
                href="http://localhost:8000"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2"
              >
                <span>🔧</span>
                <span>CLIP后台</span>
              </a>
              <button
                onClick={handleClearAll}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-600"
              >
                清空
              </button>
            </div>
          </div>
        </div>
        
        {/* 工具栏 */}
        <div className="p-4 border-b border-gray-700 flex gap-3 items-center">
          <input
            type="text"
            placeholder="搜索素材名称、情绪、标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 text-sm"
          >
            <option value="date">按日期</option>
            <option value="name">按名称</option>
            <option value="duration">按时长</option>
            <option value="status">按状态</option>
          </select>
          <button
            onClick={handleToggleSelectAll}
            className="px-3 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
          >
            {selectedShots.size === filteredShots.length && filteredShots.length > 0 ? '取消全选' : '全选'}
          </button>
          {selectedShots.size > 0 && (
            <button
              onClick={handleBatchDelete}
              className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              删除选中 ({selectedShots.size})
            </button>
          )}
        </div>
        
        {/* 状态标签页 */}
        <div className="px-4 pt-3 border-b border-gray-700 flex gap-2">
          {[
            { key: 'all', label: '全部', count: stats.total },
            { key: 'ready', label: '已处理', count: stats.processed },
            { key: 'pending', label: '待处理', count: stats.pending },
            { key: 'error', label: '错误', count: stats.error },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as any)}
              className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
                selectedTab === tab.key
                  ? 'bg-gray-800 text-gray-100 border-t border-x border-gray-700'
                  : 'bg-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* 素材列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mx-auto mb-4"></div>
                <div className="text-xl text-gray-200 mb-2">{loadingMessage || '加载中...'}</div>
                <div className="w-64 bg-gray-700 rounded-full h-2 mx-auto">
                  <div
                    className="bg-teal-500 h-2 rounded-full transition-all"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <div className="text-sm text-gray-400 mt-2">{loadingProgress}%</div>
              </div>
            </div>
          ) : filteredShots.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-6xl mb-4">🎬</div>
                <div className="text-lg">没有找到素材</div>
                <div className="text-sm mt-2">点击"快速加载"导入素材库</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {filteredShots.map(shot => {
                const statusInfo = getStatusDisplay(shot.status);
                const isSelected = selectedShots.has(shot.id);
                
                return (
                  <div
                    key={shot.id}
                    onClick={() => {
                      const updated = new Set(selectedShots);
                      if (isSelected) updated.delete(shot.id);
                      else updated.add(shot.id);
                      setSelectedShots(updated);
                    }}
                    className={`relative border rounded-lg p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-900/20'
                        : 'border-gray-700 bg-gray-800 hover:bg-gray-750'
                    }`}
                  >
                    {/* 选中标记 */}
                    <div className={`absolute top-2 right-2 w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected ? 'bg-blue-500 border-blue-500' : 'bg-transparent border-gray-600'
                    }`}>
                      {isSelected && <span className="text-white text-xs">✓</span>}
                    </div>
                    
                    {/* 预览区域 */}
                    <div className="aspect-video bg-gray-900 rounded mb-2 flex items-center justify-center relative">
                      <div className="text-3xl">📹</div>
                      <div className={`absolute top-1 left-1 ${statusInfo.color} text-white text-xs px-2 py-0.5 rounded`}>
                        {statusInfo.icon} {statusInfo.text}
                      </div>
                    </div>
                    
                    {/* 素材信息 */}
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-200 truncate" title={shot.label}>{shot.label}</div>
                      <div className="flex items-center justify-between text-xs">
                        <span className={`px-1.5 py-0.5 rounded ${
                          shot.emotion === '紧张' ? 'bg-red-900 text-red-200' :
                          shot.emotion === '焦虑' ? 'bg-orange-900 text-orange-200' :
                          shot.emotion === '恐惧' ? 'bg-purple-900 text-purple-200' :
                          shot.emotion === '释然' ? 'bg-green-900 text-green-200' :
                          'bg-gray-700 text-gray-300'
                        }`}>
                          {shot.emotion}
                        </span>
                        <span className="text-gray-400">{shot.duration.toFixed(1)}s</span>
                      </div>
                      {shot.clip_metadata?.tags && shot.clip_metadata.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1">
                          {shot.clip_metadata.tags.slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="text-xs px-1.5 py-0.5 bg-indigo-900 text-indigo-200 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 truncate" title={shot.file_path}>
                        {shot.file_path || '无文件路径'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* 底部状态栏 */}
        <div className="p-4 border-t border-gray-700 bg-gray-850 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            显示 {filteredShots.length} / {stats.total} 个素材
            {selectedShots.size > 0 && ` | 已选择 ${selectedShots.size} 个`}
          </div>
          <button onClick={onClose} className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">
            关闭
          </button>
        </div>
        
        {/* 路径配置弹窗 */}
        {showPathConfig && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-gray-800 rounded-lg p-6 w-96 border border-gray-700">
              <h3 className="text-lg font-bold text-gray-100 mb-4">设置素材库路径</h3>
              <input
                type="text"
                value={libraryPath}
                onChange={(e) => setLibraryPath(e.target.value)}
                placeholder="例如: U:\PreVis_Assets"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-100 mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPathConfig(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
                >
                  取消
                </button>
                <button
                  onClick={handleSavePath}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
