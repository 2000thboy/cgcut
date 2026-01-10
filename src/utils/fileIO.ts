import { ScriptBlock, Shot, Clip, Config } from '../types/DataModel';

/**
 * 加载 JSON 文件
 * MVP 阶段：直接从 public/data 目录加载
 */
export async function loadJSON<T>(filename: string): Promise<T> {
  try {
    const response = await fetch(`/data/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    throw error;
  }
}

/**
 * 保存 JSON 文件
 * MVP 阶段：使用 localStorage 模拟文件保存
 * 后续可通过 Electron API 实现真实文件写入
 */
export async function saveJSON<T>(filename: string, data: T): Promise<void> {
  try {
    const json = JSON.stringify(data, null, 2);
    localStorage.setItem(`cgcut_${filename}`, json);
    console.log(`Saved ${filename} to localStorage`);
  } catch (error) {
    console.error(`Error saving ${filename}:`, error);
    throw error;
  }
}

/**
 * 从 localStorage 加载（如果存在）
 */
export async function loadFromLocalStorage<T>(filename: string, fallback: () => Promise<T>): Promise<T> {
  const stored = localStorage.getItem(`cgcut_${filename}`);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.warn(`Failed to parse stored ${filename}, using fallback`);
    }
  }
  return fallback();
}

/**
 * 加载所有项目数据
 */
export async function loadProjectData(): Promise<{
  scriptBlocks: ScriptBlock[];
  shots: Shot[];
  clips: Clip[];
  config: Config;
}> {
  const [scriptBlocks, shots, clips, config] = await Promise.all([
    loadJSON<ScriptBlock[]>('script_blocks.json'),
    loadJSON<Shot[]>('shots.json'),
    loadFromLocalStorage('timeline.json', () => loadJSON<Clip[]>('timeline.json')),
    loadJSON<Config>('config.json'),
  ]);

  return {
    scriptBlocks: scriptBlocks,
    shots: shots,
    clips: clips || [],
    config: config,
  };
}

/**
 * 保存项目数据
 */
export async function saveProjectData(clips: Clip[]): Promise<void> {
  await saveJSON('timeline.json', clips);
}

/**
 * 导出项目数据为 JSON 文件下载
 */
export function exportProjectData(clips: Clip[], filename: string = 'timeline.json'): void {
  const json = JSON.stringify(clips, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
