/**
 * \u7edf\u4e00\u6253\u6807\u670d\u52a1
 * \u540c\u65f6\u8c03\u7528CLIP\u548cVLM\u4e24\u4e2a\u670d\u52a1\uff0c\u751f\u6210\u53cc\u6807\u7b7e
 * 
 * CLIP\u6807\u7b7e: \u7ed3\u6784\u5316\u6807\u7b7e (\u666f\u522b\u3001\u573a\u666f\u3001\u60c5\u7eea\u7b49)
 * VLM\u63cf\u8ff0: \u81ea\u7136\u8bed\u8a00\u63cf\u8ff0 (\u8be6\u7ec6\u5185\u5bb9\u63cf\u8ff0)
 */

import type { CLIPMetadata, VLMMetadata, CLIPScanRequest, CLIPProcessResponse } from '../types/DataModel';

interface TaggingServiceConfig {
  clipEndpoint: string;
  vlmEndpoint: string;
  enableVLM: boolean; // \u662f\u5426\u542f\u7528VLM\u63cf\u8ff0
  timeout: number;
}

const DEFAULT_CONFIG: TaggingServiceConfig = {
  clipEndpoint: 'http://localhost:8000',
  vlmEndpoint: 'http://localhost:8001',
  enableVLM: true,
  timeout: 60000,
};

/**
 * \u7edf\u4e00\u6253\u6807\u7ed3\u679c
 */
export interface TaggingResult {
  filePath: string;
  clip_metadata?: CLIPMetadata;
  vlm_metadata?: VLMMetadata;
  status: 'success' | 'partial' | 'error';
  errors?: string[];
}

/**
 * \u7edf\u4e00\u6253\u6807\u670d\u52a1\u7c7b
 */
export class TaggingService {
  private config: TaggingServiceConfig;

  constructor(config?: Partial<TaggingServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * \u68c0\u67e5\u670d\u52a1\u72b6\u6001
   */
  async checkServices(): Promise<{ clip: boolean; vlm: boolean }> {
    const results = { clip: false, vlm: false };

    // \u68c0\u67e5CLIP\u670d\u52a1
    try {
      const response = await fetch(`${this.config.clipEndpoint}/clip`, {
        signal: AbortSignal.timeout(5000),
      });
      results.clip = response.ok;
    } catch (e) {
      console.warn('[TaggingService] CLIP\u670d\u52a1\u4e0d\u53ef\u7528');
    }

    // \u68c0\u67e5VLM\u670d\u52a1
    if (this.config.enableVLM) {
      try {
        const response = await fetch(`${this.config.vlmEndpoint}/vlm`, {
          signal: AbortSignal.timeout(5000),
        });
        results.vlm = response.ok;
      } catch (e) {
        console.warn('[TaggingService] VLM\u670d\u52a1\u4e0d\u53ef\u7528');
      }
    }

    return results;
  }

  /**
   * \u5904\u7406\u5355\u4e2a\u6587\u4ef6
   */
  async processFile(filePath: string): Promise<TaggingResult> {
    const result: TaggingResult = {
      filePath,
      status: 'success',
      errors: [],
    };

    // \u8c03\u7528CLIP\u670d\u52a1
    try {
      const clipResponse = await fetch(`${this.config.clipEndpoint}/clip/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: filePath,
          extract_keyframes: true,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (clipResponse.ok) {
        result.clip_metadata = await clipResponse.json();
      } else {
        const error = await clipResponse.text();
        result.errors?.push(`CLIP: ${error}`);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      result.errors?.push(`CLIP: ${error}`);
    }

    // \u8c03\u7528VLM\u670d\u52a1
    if (this.config.enableVLM) {
      try {
        const vlmResponse = await fetch(`${this.config.vlmEndpoint}/vlm/describe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_path: filePath,
            prompt: '\u8be6\u7ec6\u63cf\u8ff0\u8fd9\u4e2a\u89c6\u9891\u753b\u9762\u7684\u5185\u5bb9',
          }),
          signal: AbortSignal.timeout(this.config.timeout),
        });

        if (vlmResponse.ok) {
          result.vlm_metadata = await vlmResponse.json();
        } else {
          const error = await vlmResponse.text();
          result.errors?.push(`VLM: ${error}`);
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        result.errors?.push(`VLM: ${error}`);
      }
    }

    // \u786e\u5b9a\u6700\u7ec8\u72b6\u6001
    if (result.clip_metadata && result.vlm_metadata) {
      result.status = 'success';
    } else if (result.clip_metadata || result.vlm_metadata) {
      result.status = 'partial';
    } else {
      result.status = 'error';
    }

    return result;
  }

  /**
   * \u6279\u91cf\u5904\u7406\u76ee\u5f55
   */
  async processDirectory(request: CLIPScanRequest): Promise<{
    results: TaggingResult[];
    summary: {
      total: number;
      success: number;
      partial: number;
      failed: number;
    };
  }> {
    console.log('[TaggingService] \u5f00\u59cb\u6279\u91cf\u5904\u7406:', request.directoryPath);

    // \u5148\u8c03\u7528CLIP\u670d\u52a1\u83b7\u53d6\u6587\u4ef6\u5217\u8868\u548cCLIP\u6807\u7b7e
    const clipResponse = await fetch(`${this.config.clipEndpoint}/clip/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.config.timeout * 10), // \u6279\u91cf\u5904\u7406\u8d85\u65f6\u66f4\u957f
    });

    if (!clipResponse.ok) {
      throw new Error(`CLIP\u670d\u52a1\u9519\u8bef: ${clipResponse.statusText}`);
    }

    const clipData: CLIPProcessResponse = await clipResponse.json();
    const results: TaggingResult[] = [];

    // \u5bf9\u6bcf\u4e2a\u6587\u4ef6\u8865\u5145VLM\u63cf\u8ff0
    for (const file of clipData.processedFiles) {
      const result: TaggingResult = {
        filePath: file.filePath,
        clip_metadata: file.status === 'success' ? file.clipMetadata : undefined,
        status: file.status === 'success' ? 'success' : 'error',
        errors: file.error ? [file.error] : [],
      };

      // \u8c03\u7528VLM\u670d\u52a1
      if (this.config.enableVLM && file.status === 'success') {
        try {
          const vlmResponse = await fetch(`${this.config.vlmEndpoint}/vlm/describe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_path: file.filePath,
              prompt: '\u8be6\u7ec6\u63cf\u8ff0\u8fd9\u4e2a\u89c6\u9891\u753b\u9762\u7684\u5185\u5bb9',
            }),
            signal: AbortSignal.timeout(this.config.timeout),
          });

          if (vlmResponse.ok) {
            result.vlm_metadata = await vlmResponse.json();
          }
        } catch (e) {
          // VLM\u5931\u8d25\u4e0d\u5f71\u54cd\u6574\u4f53\u72b6\u6001\uff0c\u53ea\u8bb0\u5f55\u8b66\u544a
          console.warn(`[TaggingService] VLM\u5904\u7406\u5931\u8d25: ${file.filePath}`);
        }
      }

      results.push(result);
    }

    // \u7edf\u8ba1\u6c47\u603b
    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      partial: results.filter(r => r.status === 'partial').length,
      failed: results.filter(r => r.status === 'error').length,
    };

    console.log('[TaggingService] \u6279\u91cf\u5904\u7406\u5b8c\u6210:', summary);

    return { results, summary };
  }

  /**
   * \u66f4\u65b0\u914d\u7f6e
   */
  updateConfig(config: Partial<TaggingServiceConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * \u83b7\u53d6\u914d\u7f6e
   */
  getConfig(): TaggingServiceConfig {
    return { ...this.config };
  }

  /**
   * \u5207\u6362VLM\u542f\u7528\u72b6\u6001
   */
  setVLMEnabled(enabled: boolean) {
    this.config.enableVLM = enabled;
  }
}

/**
 * \u5355\u4f8b\u5b9e\u4f8b
 */
export const taggingService = new TaggingService();
