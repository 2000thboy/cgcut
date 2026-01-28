/**
 * 视频导出服务
 * 调用后端合成最终视频
 */

const VIDEO_EXPORT_SERVICE_URL = "http://localhost:8002";

export interface ClipExportInfo {
  shot_id: string;
  file_path: string;
  duration: number;
  trim_in: number;
  trim_out: number;
}

export interface ExportOptions {
  clips: ClipExportInfo[];
  output_filename?: string;
  resolution?: [number, number];
  fps?: number;
}

export interface ExportResult {
  status: string;
  output_path: string;
  duration: number;
  file_size: number;
  export_time: number;
}

/**
 * 导出视频
 */
export async function exportVideo(
  options: ExportOptions
): Promise<ExportResult> {
  const response = await fetch(`${VIDEO_EXPORT_SERVICE_URL}/export`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clips: options.clips,
      output_filename: options.output_filename || `cgcut_${Date.now()}.mp4`,
      resolution: options.resolution || [1920, 1080],
      fps: options.fps || 30,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "视频导出失败");
  }

  return await response.json();
}

/**
 * 下载视频文件
 */
export function downloadVideo(filename: string) {
  const url = `${VIDEO_EXPORT_SERVICE_URL}/download/${filename}`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

/**
 * 获取导出列表
 */
export async function listExports(): Promise<{
  exports: any[];
  total: number;
}> {
  const response = await fetch(`${VIDEO_EXPORT_SERVICE_URL}/list`);
  if (!response.ok) {
    throw new Error("获取导出列表失败");
  }
  return await response.json();
}

/**
 * 检查服务状态
 */
export async function checkExportService(): Promise<boolean> {
  try {
    const response = await fetch(`${VIDEO_EXPORT_SERVICE_URL}/`);
    return response.ok;
  } catch {
    return false;
  }
}
