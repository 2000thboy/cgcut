import { create } from 'zustand';
import { ScriptBlock, ScriptScene, Shot, Clip, PlaybackState, ProjectCheckStatus, MediaLibraryConfig, calculateScriptBlockDuration } from '../types/DataModel';

interface AppState {
  // 数据状态
  scriptBlocks: ScriptBlock[];
  scriptScenes: ScriptScene[];
  shots: Shot[];
  clips: Clip[];
  mediaLibrary: MediaLibraryConfig | null;
  originalScriptContent: string; // 原始剧本内容，用于对比显示
  
  // UI 状态
  selectedClipId: string | null;
  selectedScriptBlockId: string | null;
  highlightedScriptBlockId: string | null;
  activeTab: 'script' | 'timeline' | 'library';
  
  // 播放状态
  playbackState: PlaybackState;
  
  // Actions
  setScriptBlocks: (blocks: ScriptBlock[]) => void;
  setScriptScenes: (scenes: ScriptScene[]) => void;
  setShots: (shots: Shot[]) => void;
  setClips: (clips: Clip[]) => void;
  setMediaLibrary: (config: MediaLibraryConfig | null) => void;
  setOriginalScriptContent: (content: string) => void; // 设置原始剧本
  
  // Clip 操作
  addClip: (clip: Clip) => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  deleteClip: (clipId: string) => void;
  reorderClips: (newClips: Clip[]) => void;
  
  // 选择操作
  selectClip: (clipId: string | null) => void;
  selectScriptBlock: (blockId: string | null) => void;
  setHighlightedScriptBlock: (blockId: string | null) => void;
  setActiveTab: (tab: 'script' | 'timeline' | 'library') => void;
  
  // 播放操作
  setPlaybackState: (state: Partial<PlaybackState>) => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  
  // 计算函数
  getScriptBlockActualDuration: (blockId: string) => number;
  getShotById: (shotId: string) => Shot | undefined;
  getClipById: (clipId: string) => Clip | undefined;
  checkProjectStatus: () => ProjectCheckStatus;
  
  // 素材管理
  updateShotStatus: (shotId: string, status: Shot['status']) => void;
  addShot: (shot: Shot) => void;
  deleteShot: (shotId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // 初始状态
  scriptBlocks: [],
  scriptScenes: [],
  shots: [],
  clips: [],
  mediaLibrary: null,
  originalScriptContent: '', // 初始为空
  
  selectedClipId: null,
  selectedScriptBlockId: null,
  highlightedScriptBlockId: null,
  activeTab: 'script',
  
  playbackState: {
    current_time: 0,
    is_playing: false,
    current_clip_index: -1,
    current_clip_internal_time: 0,
    current_script_block_id: null,
  },
  
  // Setters
  setScriptBlocks: (blocks) => set({ scriptBlocks: blocks }),
  setScriptScenes: (scenes) => set({ scriptScenes: scenes }),
  setShots: (shots) => set({ shots }),
  setClips: (clips) => set({ clips }),
  setMediaLibrary: (config) => set({ mediaLibrary: config }),
  setOriginalScriptContent: (content) => set({ originalScriptContent: content }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  // Clip 操作
  addClip: (clip) => set((state) => ({
    clips: [...state.clips, clip]
  })),
  
  updateClip: (clipId, updates) => set((state) => ({
    clips: state.clips.map(clip =>
      clip.id === clipId ? { ...clip, ...updates } : clip
    )
  })),
  
  deleteClip: (clipId) => set((state) => ({
    clips: state.clips.filter(clip => clip.id !== clipId),
    selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId
  })),
  
  reorderClips: (newClips) => set({ clips: newClips }),
  
  // 选择操作
  selectClip: (clipId) => set({ selectedClipId: clipId }),
  selectScriptBlock: (blockId) => set({ selectedScriptBlockId: blockId }),
  setHighlightedScriptBlock: (blockId) => set({ highlightedScriptBlockId: blockId }),
  
  // 播放操作
  setPlaybackState: (state) => set((prevState) => ({
    playbackState: { ...prevState.playbackState, ...state }
  })),
  
  play: () => set((state) => ({
    playbackState: { ...state.playbackState, is_playing: true }
  })),
  
  pause: () => set((state) => ({
    playbackState: { ...state.playbackState, is_playing: false }
  })),
  
  seek: (time) => set((state) => ({
    playbackState: { ...state.playbackState, current_time: time }
  })),
  
  // 计算函数
  getScriptBlockActualDuration: (blockId) => {
    const state = get();
    return calculateScriptBlockDuration(blockId, state.clips);
  },
  
  getShotById: (shotId) => {
    const state = get();
    return state.shots.find(shot => shot.id === shotId);
  },
  
  getClipById: (clipId) => {
    const state = get();
    return state.clips.find(clip => clip.id === clipId);
  },
  
  // 项目状态检查
  checkProjectStatus: () => {
    const state = get();
    const hasScript = state.scriptBlocks.length > 0;
    const scriptSegmented = state.scriptScenes.length > 0 || state.scriptBlocks.length > 0;
    
    // 检查每个段落是否有clip
    const blocksWithClips = new Set(state.clips.map(c => c.script_block_id));
    const missingBlocks = state.scriptBlocks
      .filter(b => !blocksWithClips.has(b.id))
      .map(b => b.id);
    const allBlocksHaveClips = missingBlocks.length === 0;
    
    // 检查每个clip是否有对应素材
    const shotIds = new Set(state.shots.map(s => s.id));
    const missingShots = state.clips
      .filter(c => !shotIds.has(c.shot_id))
      .map(c => c.id);
    const allClipsHaveShots = missingShots.length === 0;
    
    const readyToPlay = hasScript && scriptSegmented && allBlocksHaveClips && allClipsHaveShots;
    
    return {
      hasScript,
      scriptSegmented,
      allBlocksHaveClips,
      allClipsHaveShots,
      missingBlocks,
      missingShots,
      readyToPlay,
    };
  },
  
  // 素材管理
  updateShotStatus: (shotId, status) => set((state) => ({
    shots: state.shots.map(shot =>
      shot.id === shotId ? { ...shot, status } : shot
    )
  })),
  
  addShot: (shot) => set((state) => ({
    shots: [...state.shots, shot]
  })),
  
  deleteShot: (shotId) => set((state) => ({
    shots: state.shots.filter(shot => shot.id !== shotId)
  })),
}));
