import React, { useEffect, useRef, useState } from 'react';
import { ScriptBlockPanel } from './components/ScriptBlockPanel';
import { SimpleTimeline } from './components/SimpleTimeline';
import { ShotLibrary } from './components/ShotLibrary';
import { useAppStore } from './store/appStore';
import { loadProjectData, saveProjectData } from './utils/fileIO';
import { ProjectCheckStatus, LLMProcessStatus } from './types/DataModel';
import { llmService } from './services/llmService';
import { clipService } from './services/clipService';
import type { CLIPProcessStatus } from './types/DataModel';

function App() {
  const setScriptBlocks = useAppStore(state => state.setScriptBlocks);
  const setScriptScenes = useAppStore(state => state.setScriptScenes);
  const setShots = useAppStore(state => state.setShots);
  const setClips = useAppStore(state => state.setClips);
  const addClip = useAppStore(state => state.addClip); // 新增：添加Clip的方法
  const clips = useAppStore(state => state.clips);
  const scriptBlocks = useAppStore(state => state.scriptBlocks);
  const shots = useAppStore(state => state.shots);
  const checkProjectStatus = useAppStore(state => state.checkProjectStatus);
  const mediaLibrary = useAppStore(state => state.mediaLibrary);
  const setMediaLibrary = useAppStore(state => state.setMediaLibrary);
  const setOriginalScriptContent = useAppStore(state => state.setOriginalScriptContent);
  
  const scriptFileInputRef = useRef<HTMLInputElement>(null);
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [projectStatus, setProjectStatus] = useState<ProjectCheckStatus | null>(null);
  
  // LLM 处理状态
  const [llmStatus, setLlmStatus] = useState<LLMProcessStatus>('idle');
  const [llmProgress, setLlmProgress] = useState<string>('');
  
  // CLIP 处理状态
  const [clipStatus, setClipStatus] = useState<CLIPProcessStatus>('idle');
  const [clipProgress, setClipProgress] = useState<string>('');
  const [clipProcessedCount, setClipProcessedCount] = useState<number>(0);
  const [clipTotalCount, setClipTotalCount] = useState<number>(0);

  useEffect(() => {
    // 加载项目数据
    loadProjectData().then(data => {
      setScriptBlocks(data.scriptBlocks);
      setShots(data.shots);
      setClips(data.clips);
      
      // 设置默认素材库路径
      if (!mediaLibrary) {
        setMediaLibrary({
          base_path: 'U:\\PreVis_Assets',
          total_files: 0,
          processed_files: 0,
          pending_files: 0,
          last_scan_time: new Date().toISOString(),
        });
      }
    }).catch(err => {
      console.error('Failed to load project data:', err);
    });
  }, [setScriptBlocks, setShots, setClips, setMediaLibrary, mediaLibrary]);

  const handleSave = () => {
    saveProjectData(clips).then(() => {
      alert('项目已保存到 localStorage');
    }).catch(err => {
      console.error('Failed to save project:', err);
      alert('保存失败');
    });
  };
  
  // 导入剧本文件 - 使用 LLM 拆解
  const handleImportScript = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleImportScript called');
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    console.log('Selected file:', file.name);
    
    const fileName = file.name.toLowerCase();
    
    // 检查文件格式
    if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
      alert('DOC格式需要后端服务支持，请先将文档转换为TXT或JSON格式');
      return;
    }
    
    if (!fileName.endsWith('.txt') && !fileName.endsWith('.json')) {
      alert('仅支持 .txt 和 .json 格式的剧本文件');
      return;
    }
    
    setLlmStatus('analyzing');
    setLlmProgress('正在读取文件...');
    
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      console.log('File loaded successfully');
      const content = event.target?.result as string;
      
      try {
        setLlmProgress('正在调用 LLM 分析剧本...');
        
        // 调用 LLM 服务分析剧本
        const response = await llmService.analyzeScript({
          scriptContent: content,
          fileName: file.name,
          options: {
            language: 'zh',
            includeEmotions: true,
            estimateDuration: true,
          },
        });
        
        if (response.status === 'error') {
          throw new Error(response.error || 'LLM 分析失败');
        }
        
        console.log('LLM Analysis Response:', response);
        console.log(`Parsed ${response.blocks.length} blocks in ${response.scenes.length} scenes`);
        
        setLlmProgress('正在更新界面...');
        
        // 保存原始剧本内容
        setOriginalScriptContent(content);
        
        // 更新状态
        setScriptBlocks(response.blocks);
        setScriptScenes(response.scenes);
        
        // ✨ MVP修复：自动为每个block创建占位Clip
        console.log('🔧 正在自动生成时间轴占位条...');
        response.blocks.forEach((block, index) => {
          addClip({
            id: `clip_${Date.now()}_${index}`,
            script_block_id: block.id,
            shot_id: 'placeholder', // 特殊标记：占位符
            duration: block.expected_duration,
            trim_in: 0,
            trim_out: block.expected_duration,
          });
        });
        console.log(`✅ 已生成 ${response.blocks.length} 个占位Clip`);
        
        setLlmStatus('success');
        setLlmProgress('');
        
        // 显示结果
        const scriptLength = content.length;
        
        alert(
          `🎉 剧本分析完成\n\n` +
          `字数: ${scriptLength} 字\n` +
          `场景数: ${response.metadata?.totalScenes || 0}\n` +
          `镜头数: ${response.metadata?.totalBlocks || 0}\n` +
          `预估时长: ${response.metadata?.estimatedDuration?.toFixed(1) || 0}s\n` +
          `分析耗时: ${response.metadata?.analysisTime || 0}ms\n\n` +
          `剧本包含 ${response.scenes.length} 个场景，${response.blocks.length} 个镜头，预估总时长 ${response.metadata?.estimatedDuration?.toFixed(1) || 0} 秒`
        );
        
      } catch (error) {
        console.error('Parse error:', error);
        setLlmStatus('error');
        setLlmProgress('');
        alert('😞 剧本分析失败: ' + (error as Error).message);
      }
    };
    
    reader.onerror = () => {
      console.error('File read error');
      setLlmStatus('error');
      setLlmProgress('');
      alert('读取文件失败');
    };
    
    reader.readAsText(file);
    
    // 清除输入值，允许重复导入同一文件
    if (scriptFileInputRef.current) {
      scriptFileInputRef.current.value = '';
    }
  };
  
  // 快速加载素材库（只列出文件，不做CLIP处理）
  const handleQuickLoadLibrary = async () => {
    if (!mediaLibrary || !mediaLibrary.base_path) {
      alert('⚠️ 请先设置素材库路径');
      return;
    }
    
    console.log('[App] 快速加载素材库:', mediaLibrary.base_path);
    
    setClipStatus('scanning');
    setClipProgress('正在快速扫描素材库...');
    
    try {
      const response = await clipService.quickList(mediaLibrary.base_path, 1000);
      
      console.log('[App] 快速扫描完成:', response.summary);
      
      // 转换为 shots 数据
      const newShots = response.files.map(f => ({
        id: f.shotId,
        label: f.label,
        emotion: '平静', // 默认情绪
        duration: f.duration,
        file_path: f.filePath,
        status: 'pending' as const,
        tags: [],
      }));
      
      setShots(newShots);
      
      // 更新素材库配置
      setMediaLibrary({
        ...mediaLibrary,
        total_files: response.summary.totalFiles,
        processed_files: 0,
        pending_files: response.summary.totalFiles,
        last_scan_time: new Date().toISOString(),
      });
      
      setClipStatus('success');
      setClipProgress('');
      
      alert(
        `🎉 素材库快速加载完成\n\n` +
        `总文件数: ${response.summary.totalFiles}\n` +
        `已加载: ${newShots.length} 个素材\n\n` +
        `素材已添加到素材库，可以开始匹配。\n` +
        `如需CLIP智能标签，请点击"扫描素材库"。`
      );
      
    } catch (error) {
      console.error('[App] 快速加载失败:', error);
      setClipStatus('error');
      setClipProgress('');
      alert('😞 快速加载失败: ' + (error as Error).message);
    }
  };

  // 扫描并处理素材库（完整CLIP处理）
  const handleScanMediaLibrary = async () => {
    if (!mediaLibrary || !mediaLibrary.base_path) {
      alert('⚠️ 请先设置素材库路径');
      return;
    }
    
    console.log('[App] 开始扫描素材库:', mediaLibrary.base_path);
    
    setClipStatus('scanning');
    setClipProgress('正在扫描素材库目录...');
    setClipProcessedCount(0);
    setClipTotalCount(0);
    
    try {
      const response = await clipService.scanAndProcess({
        directoryPath: mediaLibrary.base_path,
        filePatterns: ['*.mp4', '*.mov', '*.avi'],
        skipProcessed: true,
        extractKeyframes: true,
      });
      
      if (response.status === 'error') {
        throw new Error(response.error || 'CLIP 处理失败');
      }
      
      console.log('[App] CLIP 扫描完成:', response.summary);
      
      setClipStatus('processing');
      setClipProgress('正在更新素材库...');
      setClipTotalCount(response.summary.totalFiles);
      
      // 更新 shots 数据
      const newShots = response.processedFiles
        .filter(f => f.status === 'success')
        .map(f => ({
          id: f.shotId,
          label: f.clipMetadata.description,
          emotion: f.clipMetadata.emotions[0] || '中性',
          duration: 5, // 默认时长，后续可从视频元数据提取
          file_path: f.filePath,
          status: 'ready' as const,
          tags: f.clipMetadata.tags,
          clip_metadata: f.clipMetadata,
        }));
      
      setShots([...shots, ...newShots]);
      setClipProcessedCount(response.summary.processed);
      
      // 更新素材库配置
      setMediaLibrary({
        ...mediaLibrary,
        total_files: response.summary.totalFiles,
        processed_files: mediaLibrary.processed_files + response.summary.processed,
        pending_files: response.summary.skipped,
        last_scan_time: new Date().toISOString(),
      });
      
      setClipStatus('success');
      
      alert(
        `🎉 素材库扫描完成\n\n` +
        `总文件数: ${response.summary.totalFiles}\n` +
        `已处理: ${response.summary.processed}\n` +
        `跳过: ${response.summary.skipped}\n` +
        `失败: ${response.summary.failed}\n` +
        `耗时: ${(response.summary.processingTime / 1000).toFixed(1)} 秒`
      );
      
      // 3秒后关闭进度
      setTimeout(() => {
        setClipStatus('idle');
        setClipProgress('');
      }, 3000);
      
    } catch (error) {
      console.error('[App] CLIP 扫描失败:', error);
      setClipStatus('error');
      setClipProgress('');
      alert('😞 CLIP 处理失败: ' + (error as Error).message);
    }
  };
  
  // 导出项目
  const handleExport = () => {
    const projectData = {
      scriptBlocks,
      clips,
      shots: shots.map(s => ({
        ...s,
        file_path: s.file_path
      }))
    };
    
    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cgcut_project_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // 一键启动检查
  const handleProjectCheck = () => {
    const status = checkProjectStatus();
    setProjectStatus(status);
    setShowCheckModal(true);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* 顶部工具栏 */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center justify-between shadow-lg">
        <h1 className="text-xl font-bold text-gray-100">cgcut - 导演分镜验证 MVP</h1>
        <div className="flex gap-2">
          <input
            ref={scriptFileInputRef}
            type="file"
            accept=".json,.txt,.doc,.docx"
            onChange={handleImportScript}
            className="hidden"
          />
          <button
            onClick={() => scriptFileInputRef.current?.click()}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors shadow-md"
          >
            导入剧本
          </button>
          <button
            onClick={handleProjectCheck}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors shadow-md"
          >
            一键检查
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors shadow-md"
          >
            导出项目
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-md"
          >
            保存项目
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：剧本段落面板 */}
        <div className="w-80 border-r border-gray-700 bg-gray-800 overflow-hidden">
          <ScriptBlockPanel className="h-full" />
        </div>

        {/* 中间：时间轴 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden p-4">
            <SimpleTimeline className="h-full" />
          </div>
        </div>

        {/* 右侧：素材库 */}
        <div className="w-80 border-l border-gray-700 bg-gray-800 overflow-hidden">
          <ShotLibrary className="h-full" />
        </div>
      </div>
      
      {/* LLM 处理进度模态框 */}
      {llmStatus === 'analyzing' && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 border border-blue-500 shadow-2xl">
            <div className="flex flex-col items-center">
              {/* 动画图标 */}
              <div className="w-16 h-16 mb-4">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
              </div>
                            
              {/* 标题 */}
              <h2 className="text-2xl font-bold text-gray-100 mb-2">🤖 AI 分析中...</h2>
                            
              {/* API信息 */}
              <div className="bg-gray-700 rounded-lg p-3 mb-4 border border-gray-600">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-blue-400 font-semibold">🎯 当前使用:</span>
                  <span className="text-green-400 font-bold">智谱 GLM-4-Plus</span>
                </div>
                <div className="text-xs text-gray-400 text-center">
                  API端点: open.bigmodel.cn
                </div>
              </div>
                            
              {/* 进度文本 */}
              <p className="text-gray-300 text-center mb-4 font-medium">{llmProgress}</p>
                            
              {/* 进度条 */}
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full animate-pulse" style={{ width: '70%' }}></div>
              </div>
                            
              <p className="text-xs text-gray-500 mt-2">请稍候，正在使用 LLM 晾能拆解剧本...</p>
            </div>
          </div>
        </div>
      )}
      
      {/* 项目检查模态框 */}
      {showCheckModal && projectStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <h2 className="text-xl font-bold text-gray-100 mb-4">项目状态检查</h2>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">剧本导入</span>
                <span className={projectStatus.hasScript ? 'text-green-400' : 'text-red-400'}>
                  {projectStatus.hasScript ? '✓ 已导入' : '✗ 未导入'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-300">剧本分段</span>
                <span className={projectStatus.scriptSegmented ? 'text-green-400' : 'text-red-400'}>
                  {projectStatus.scriptSegmented ? `✓ ${scriptBlocks.length} 个段落` : '✗ 未分段'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-300">时间轴占位</span>
                <span className={projectStatus.allBlocksHaveClips ? 'text-green-400' : 'text-yellow-400'}>
                  {projectStatus.allBlocksHaveClips 
                    ? '✓ 全部完成' 
                    : `⚠ 缺少 ${projectStatus.missingBlocks.length} 个`}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-300">素材匹配</span>
                <span className={projectStatus.allClipsHaveShots ? 'text-green-400' : 'text-yellow-400'}>
                  {projectStatus.allClipsHaveShots 
                    ? '✓ 全部完成' 
                    : `⚠ 缺少 ${projectStatus.missingShots.length} 个`}
                </span>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-700">
              {projectStatus.readyToPlay ? (
                <div className="text-center">
                  <div className="text-green-400 text-lg mb-2">✓ 项目已就绪，可以播放</div>
                  <button
                    onClick={() => setShowCheckModal(false)}
                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    开始播放
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-yellow-400 text-lg mb-2">⚠ 项目未完成</div>
                  <p className="text-gray-400 text-sm mb-4">
                    {!projectStatus.hasScript && '请先导入剧本文件'}
                    {!projectStatus.allBlocksHaveClips && '请为所有段落添加时间轴占位'}
                    {!projectStatus.allClipsHaveShots && '请为所有占位匹配素材'}
                  </p>
                  <button
                    onClick={() => setShowCheckModal(false)}
                    className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    继续编辑
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CLIP 处理进度模态框 */}
      {(clipStatus === 'scanning' || clipStatus === 'processing') && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 border border-indigo-500 shadow-2xl">
            <div className="flex flex-col items-center">
              {/* 旋转加载图标 */}
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-500 border-t-transparent mb-6"></div>
              
              {/* 标题 */}
              <h2 className="text-2xl font-bold text-gray-100 mb-2">
                🔍 CLIP 分析中...
              </h2>
              
              {/* 进度文本 */}
              <p className="text-gray-300 text-center mb-4">{clipProgress}</p>
              
              {/* 进度条 */}
              {clipTotalCount > 0 && (
                <div className="w-full mb-4">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>已处理: {clipProcessedCount}/{clipTotalCount}</span>
                    <span>{clipTotalCount > 0 ? Math.round((clipProcessedCount / clipTotalCount) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div
                      className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${clipTotalCount > 0 ? (clipProcessedCount / clipTotalCount) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              )}
              
              {/* 提示信息 */}
              <div className="text-sm text-gray-400 text-center">
                <p>正在使用 CLIP 模型分析视频内容...</p>
                <p className="mt-1">请耐心等待，这可能需要几分钟</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
