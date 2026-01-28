import { LLMScriptAnalysisRequest, LLMScriptAnalysisResponse, ScriptBlock, ScriptScene } from '../types/DataModel';

/**
 * 影视分镜知识库（精简版）
 * 根据 knowledge/cinematography-basics.md 编写
 */
const CINEMATOGRAPHY_KNOWLEDGE = `
# 影视分镜专业标准知识库

## 镜头景别分类
1. **特写 (ECU)**: 眼睛、手指等极小细节 | 时长: 1-4秒 | 情绪: 极度紧张/恐惧
2. **近景 (CU)**: 人物肩部以上 | 时长: 2-6秒 | 情绪: 亲密/紧张/情感爆发
3. **中景 (MS)**: 人物腰部以上 | 时长: 3-8秒 | 情绪: 自然交流/日常
4. **全景 (WS)**: 人物全身+环境 | 时长: 4-10秒 | 情绪: 空间关系/动态
5. **远景 (LS)**: 大范围场景 | 时长: 5-12秒 | 情绪: 开阔/孤独/宏大

## 情绪与镜头关系
- 紧张: 快速切换、特写、近景
- 焦虑: 手持摇晃、近景、中景
- 恐惧: 阴影、仰拍/俑拍、特写
- 释然: 稳定、缓慢移动、全景
- 平静: 静止、自然光、远景
- 愤怒: 强烈对比、快速推进、近景

## 场景拆解标准
- 对话场景: 3-6个镜头 (建立镜头 + 正反打 + 反应镜头)
- 动作场景: 5-10个镜头 (全景 + 细节 + 结果)
- 情感场景: 4-8个镜头 (环境 + 情绪递进 + 高潮)

## 镜头编写格式
[镜头类型] 视觉主体 + 动作/状态 + 情感表现

### 示例：
[特写] 人物眼睛，瞳孔急剧收缩，倒映出门外的黑影 | 恐惧 | 2.5秒
[中景] 主角警惕地环顾四周，手握车钥匙，呼吸急促 | 紧张 | 4.0秒
[全景] 办公室内，三人围坐会议桌，主角站起身指着白板 | 平静 | 6.5秒
`;

/**
 * LLM 服务配置
 */
interface LLMServiceConfig {
  provider: 'nvidia' | 'zhipu'; // API提供商
  apiEndpoint: string; // API 端点
  apiKey?: string; // API 密钥
  model?: string; // 模型名称
  timeout?: number; // 超时时间(毫秒)
}

// 从环境变量获取API Key，如果没有则使用硬编码的备用值
const getZhipuApiKey = () => {
  const envKey = import.meta.env.VITE_ZHIPU_API_KEY;
  if (envKey && envKey.length > 10) return envKey;
  // 备用 API Key（开发环境）
  return 'cc84c8dd0e05410f913d74821176c6c4.fsD5kFrKy4GJFvY1';
};

const getNvidiaApiKey = () => {
  const envKey = import.meta.env.VITE_NVIDIA_API_KEY;
  if (envKey && envKey.length > 10) return envKey;
  // 备用 API Key（开发环境）
  return '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';
};

/**
 * NVIDIA API 配置
 */
const NVIDIA_CONFIG: LLMServiceConfig = {
  provider: 'nvidia',
  apiEndpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
  apiKey: getNvidiaApiKey(),
  model: import.meta.env.VITE_NVIDIA_MODEL || 'meta/llama-3.1-405b-instruct',
  timeout: 120000,
};

/**
 * 智谱API 配置
 */
const ZHIPU_CONFIG: LLMServiceConfig = {
  provider: 'zhipu',
  apiEndpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  apiKey: getZhipuApiKey(),
  model: import.meta.env.VITE_ZHIPU_MODEL || 'glm-4-plus',
  timeout: 180000, // 增加到180秒
};

/**
 * 默认配置（自动检测可用的API）
 * 优先使用环境变量中配置的API，否则尝试NVIDIA
 */
const getDefaultConfig = (): LLMServiceConfig => {
  // 检查是否有有效的智谱API Key
  const zhipuKey = import.meta.env.VITE_ZHIPU_API_KEY;
  if (zhipuKey && zhipuKey.length > 10 && !zhipuKey.includes('your_')) {
    console.log('✅ 使用环境变量中的智谱AI API');
    return ZHIPU_CONFIG;
  }

  // 检查是否有有效的NVIDIA API Key
  const nvidiaKey = import.meta.env.VITE_NVIDIA_API_KEY;
  if (nvidiaKey && nvidiaKey.length > 10 && !nvidiaKey.includes('your_')) {
    console.log('✅ 使用环境变量中的NVIDIA API');
    return NVIDIA_CONFIG;
  }

  // 如果都没有配置，尝试NVIDIA（备用Key更可能有效）
  console.log('⚠️ 未检测到有效的API Key配置，尝试使用NVIDIA备用API');
  return NVIDIA_CONFIG;
};

const DEFAULT_CONFIG: LLMServiceConfig = getDefaultConfig();

/**
 * LLM 剧本分析服务
 */
export class LLMService {
  private config: LLMServiceConfig;

  constructor(config?: Partial<LLMServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 超级健壮的JSON修复引擎
   * 处理LLM返回的各种格式问题
   */
  private robustJSONParse(rawContent: string): any {
    console.log('🔧 启动超级健壮JSON解析引擎...');

    // Step 1: 提取JSON部分
    let jsonStr = rawContent;

    // 移除markdown代码块
    jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');

    // 找到JSON对象的边界
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('未找到JSON对象边界');
    }

    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    console.log('📏 提取的JSON长度:', jsonStr.length);

    // Step 2: 尝试直接解析
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.log('⚠️ 直接解析失败，启动修复流程...');
    }

    // Step 3: 逐字符处理，修复字符串内的问题
    let result = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];
      const charCode = char.charCodeAt(0);

      // 处理转义状态
      if (escaped) {
        // 检查是否是有效的转义序列
        if ('"\\/bfnrtu'.includes(char)) {
          result += char;
        } else {
          // 无效转义，保留原字符但移除反斜杠
          result = result.slice(0, -1) + char;
        }
        escaped = false;
        continue;
      }

      // 检测转义符
      if (char === '\\') {
        escaped = true;
        result += char;
        continue;
      }

      // 检测字符串边界
      if (char === '"') {
        inString = !inString;
        result += char;
        continue;
      }

      // 在字符串内部的特殊处理
      if (inString) {
        // 处理换行符
        if (char === '\n') {
          result += '\\n';
          continue;
        }
        if (char === '\r') {
          // 跳过\r，如果后面是\n会被处理
          continue;
        }
        if (char === '\t') {
          result += '\\t';
          continue;
        }
        // 处理其他控制字符
        if (charCode < 32) {
          result += ' '; // 替换为空格
          continue;
        }
      }

      result += char;
    }

    // Step 4: 修复常见的结构问题
    // 修复对象/数组之间缺少逗号
    result = result
      .replace(/\}(\s*)\{/g, '},$1{')
      .replace(/\](\s*)\[/g, '],$1[')
      .replace(/\}(\s*)\[/g, '},$1[')
      .replace(/\](\s*)\{/g, '],$1{');

    // 修复值之间缺少逗号 (数字/布尔/null 后面直接跟 ")
    result = result.replace(/([0-9]|true|false|null)(\s+)"/g, '$1,$2"');

    // 修复字符串之间缺少逗号
    result = result.replace(/"(\s+)"/g, '",$1"');

    // 移除尾随逗号
    result = result.replace(/,(\s*[}\]])/g, '$1');

    // Step 5: 平衡括号
    const openBraces = (result.match(/\{/g) || []).length;
    const closeBraces = (result.match(/\}/g) || []).length;
    const openBrackets = (result.match(/\[/g) || []).length;
    const closeBrackets = (result.match(/\]/g) || []).length;

    if (openBraces > closeBraces) {
      console.log(`⚠️ 补齐 ${openBraces - closeBraces} 个 }`);
      result += '}'.repeat(openBraces - closeBraces);
    }
    if (openBrackets > closeBrackets) {
      console.log(`⚠️ 补齐 ${openBrackets - closeBrackets} 个 ]`);
      // 需要在最后一个}之前插入]
      const lastBracePos = result.lastIndexOf('}');
      if (lastBracePos > 0) {
        result = result.substring(0, lastBracePos) +
          ']'.repeat(openBrackets - closeBrackets) +
          result.substring(lastBracePos);
      } else {
        result += ']'.repeat(openBrackets - closeBrackets);
      }
    }

    // Step 6: 最终解析
    try {
      console.log('🔍 修复后JSON预览:', result.substring(0, 300));
      const parsed = JSON.parse(result);
      console.log('✅ JSON修复并解析成功！');
      return parsed;
    } catch (finalError) {
      // 最后尝试：使用正则提取关键数据
      console.log('⚠️ 标准解析失败，尝试正则提取...');
      return this.extractDataByRegex(rawContent);
    }
  }

  /**
   * 使用正则表达式提取数据（最后的备用方案）
   */
  private extractDataByRegex(content: string): any {
    console.log('🔧 使用正则提取模式...');

    // 提取所有镜头文本
    const blocks: any[] = [];
    let blockIndex = 0;

    // 从原始内容中提取镜头描述
    const textMatches = content.match(/\[([特近中全远]景?|特写)\][^\[]+/g) || [];

    for (const text of textMatches) {
      // 解析格式: [景别] 内容 | 情绪 | 时长
      const parts = text.split('|').map(s => s.trim());
      if (parts.length >= 1) {
        blocks.push({
          id: `block_extracted_${blockIndex++}`,
          scene_id: 'scene_1',
          scene: 'extracted_scene',
          text: parts[0] || text,
          emotion: parts[1] || '平静',
          expected_duration: parseFloat(parts[2]) || 3.0
        });
      }
    }

    if (blocks.length > 0) {
      console.log(`✅ 正则提取成功: ${blocks.length} 个镜头`);
      return {
        scenes: [{
          id: 'scene_1',
          name: '提取的场景',
          blocks: blocks
        }]
      };
    }

    throw new Error('无法从LLM响应中提取有效数据');
  }

  /**
   * 分析剧本内容，拆解成场景和段落
   */
  async analyzeScript(request: LLMScriptAnalysisRequest): Promise<LLMScriptAnalysisResponse> {
    const startTime = Date.now();

    const providerName = this.config.provider === 'zhipu' ? '智谱AI' : 'NVIDIA';

    try {
      console.log('\n========================================');
      console.log('🤖 LLM Service: Starting script analysis...');
      console.log('📄 Script length:', request.scriptContent.length, '字');
      console.log(`🚀 API Provider: ${providerName} (${this.config.model})`);
      console.log('========================================\n');

      // 调用LLM API进行分析
      const response = await this.callLLMAPI(request);

      const analysisTime = Date.now() - startTime;
      console.log(`\n✅ LLM Service: ${providerName} API 分析完成！`);
      console.log(`   耗时: ${analysisTime}ms`);
      console.log(`   场景数: ${response.scenes?.length || 0}`);
      console.log(`   镜头数: ${response.blocks?.length || 0}`);

      return {
        ...response,
        metadata: {
          totalScenes: response.metadata?.totalScenes || 0,
          totalBlocks: response.metadata?.totalBlocks || 0,
          estimatedDuration: response.metadata?.estimatedDuration || 0,
          analysisTime,
        },
      };
    } catch (error) {
      console.error('❌ LLM Service: Analysis failed', error);

      // ⚠️ MVP阶段：不要静默回退，而是明确报错
      // 这样用户知道是API问题而不是解析问题
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 检查是否是网络错误或API错误
      if (errorMessage.includes('API') || errorMessage.includes('network') || errorMessage.includes('fetch')) {
        throw new Error(
          `⚠️ ${providerName} API 调用失败\n\n` +
          `错误信息: ${errorMessage}\n\n` +
          `可能的原因:\n` +
          `1. 网络连接问题\n` +
          `2. API Key 无效或过期\n` +
          `3. API 请求超时\n\n` +
          `请检查网络连接或稍后重试。`
        );
      }

      // 其他错误直接抛出
      throw error;
    }
  }

  /**
   * 调用 LLM API 进行剧本分析
   */
  private async callLLMAPI(request: LLMScriptAnalysisRequest): Promise<LLMScriptAnalysisResponse> {
    const providerName = this.config.provider === 'zhipu' ? '智谱AI' : 'NVIDIA';
    const modelName = this.config.model || 'unknown';
    const apiEndpoint = this.config.apiEndpoint;

    console.log(`🚀 准备调用 ${providerName} API...`);
    console.log(`🎯 模型: ${modelName}`);
    console.log(`🌐 API端点: ${apiEndpoint}`);
    console.log(`📝 剧本长度: ${request.scriptContent.length} 字符`);

    // 专业分镜拆解 Prompt (MCP - Master Camera Plan)
    // 引用项目知识库
    const prompt = `你是一位资深影视导演和分镜师，拥有15年以上的专业经验。

⚠️ **核心要求：必须将每个场景拆解为至少3-10个独立镜头，禁止整个场景作为一个镜头！** ⚠️

## 拆解示例（必须按此格式）：

如果剧本是：
"王晓坐在办公桌前，眼神紧张地看着电脑屏幕。她的手指在键盘上快速敲打着，额头上渗出细密的汗珠。突然，电脑屏幕闪了一下。"

你应该拆解为：
1. [全景] 办公室内，王晓坐在桌前，周围人来人往 | 平静 | 3.0s
2. [中景] 王晓的上半身，眼神紧张地盯着屏幕 | 焦虑 | 3.5s
3. [特写] 王晓的手指在键盘上快速敲打 | 紧张 | 2.0s
4. [近景] 王晓的脸，额头渗出汗珠 | 焦虑 | 2.5s
5. [特写] 电脑屏幕突然闪烁，反射在王晓的眼睛里 | 恐惧 | 2.0s

---

## 知识库参考：

${CINEMATOGRAPHY_KNOWLEDGE}

---

现在处理以下剧本：

${request.scriptContent}

---

## ❗ 拆解规则：

1. **镜头数量**：每个场景至少 3 个镜头
2. **镜头格式**：[景别] 内容 | 情绪 | 时长
3. **情绪选项**：紧张、焦虑、恐惧、释然、平静、愤怒、悲伤、喜悦
4. **返回JSON示例**：

\{"scenes\": [\{"id\": \"scene_1\", \"name\": \"INT. 地点 - 时间\", \"blocks\": [\{\"id\": \"block_1_1\", \"scene\": \"...\", \"text\": \"[镜头] ...\", \"emotion\": \"...\", \"expected_duration\": 3.0\}, \{\"id\": \"block_1_2\", \"scene\": \"...\", \"text\": \"[镜头] ...\", \"emotion\": \"...\", \"expected_duration\": 2.5\}, \{\"id\": \"block_1_3\", \"scene\": \"...\", \"text\": \"[镜头] ...\", \"emotion\": \"...\", \"expected_duration\": 3.5\}]\}]\}

⚠️ **最后检查**：
- 每个 scenes 的 blocks 数组长度 >= 3
- 每个 blocks 的 text 以 [ 开头

**现在开始拆解，直接返回JSON，每个场景至少3个镜头！**`;

    try {
      console.log(`⏳ 开始发送 API 请求...`);
      const startTime = Date.now();

      // 增加超时时间到180秒，避免长剧本分析超时
      const timeoutMs = this.config.timeout || 180000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⚠️ 请求超时 (${timeoutMs / 1000}秒)，正在中断...`);
        controller.abort();
      }, timeoutMs);

      console.log(`📡 正在调用 ${this.config.apiEndpoint}...`);
      console.log(`⏱️ 超时设置: ${timeoutMs / 1000}秒`);

      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: '你是一位资深的影视分镜师，擅长将剧本拆解为专业的分镜镜头序列。\n\n⚠️ 核心规则：\n1. 每个场景必须拆解为至少3-10个独立镜头\n2. 禁止将整个段落作为1个镜头\n3. 禁止一句话作为1个镜头\n4. 必须为每个视觉瞬间设计独立镜头\n\n你必须严格遵守这些规则，否则结果不可用。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3, // 降低温度，使LLM更严格遵守指令
          top_p: 0.8,
          max_tokens: 12000, // 增加token限制，支持更多镜头
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ${providerName} API Error:`, response.status, errorText);
        throw new Error(`${providerName} API 错误: ${response.status} ${response.statusText}`);
      }

      const responseTime = Date.now() - startTime;
      console.log(`✅ ${providerName} API 请求成功！耗时: ${responseTime}ms`);

      const data = await response.json();
      console.log(`📦 解析 API 响应...`);

      // 解析 LLM 返回的 JSON
      const content = data.choices[0]?.message?.content || '';
      console.log('📝 LLM 返回内容长度:', content.length, '字符');
      console.log('🔍 内容预览:', content.substring(0, 300) + '...');

      // 使用超级健壮的JSON解析引擎
      let parsed: any;
      try {
        parsed = this.robustJSONParse(content);
      } catch (parseError) {
        console.error('❌ JSON解析完全失败:', parseError);
        console.log('📄 完整响应内容:\n', content);
        throw new Error(`无法解析 LLM 返回的 JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      // 转换为我们的数据结构
      const scenes: ScriptScene[] = [];
      const blocks: ScriptBlock[] = [];

      if (parsed.scenes && Array.isArray(parsed.scenes)) {
        console.log(`🎬 Found ${parsed.scenes.length} scenes`);

        parsed.scenes.forEach((scene: any, sceneIndex: number) => {
          const sceneId = scene.id || `scene_${Date.now()}_${sceneIndex}`;
          const sceneBlocks: ScriptBlock[] = [];

          console.log(`🎬 Scene ${sceneIndex + 1}: ${scene.name}, blocks: ${scene.blocks?.length || 0}`);

          if (scene.blocks && Array.isArray(scene.blocks)) {
            scene.blocks.forEach((block: any, blockIndex: number) => {
              const scriptBlock: ScriptBlock = {
                id: block.id || `block_${sceneId}_${blockIndex}`,
                scene_id: sceneId,
                scene: block.scene || scene.name,
                text: block.text || '',
                emotion: block.emotion || '平静',
                expected_duration: block.expected_duration || 5.0,
              };
              console.log(`  🎬 Block ${blockIndex + 1}: ${scriptBlock.text.substring(0, 30)}... [${scriptBlock.emotion}] ${scriptBlock.expected_duration}s`);
              sceneBlocks.push(scriptBlock);
              blocks.push(scriptBlock);
            });
          }

          scenes.push({
            id: sceneId,
            name: scene.name || '未命名场景',
            blocks: sceneBlocks,
            collapsed: false,
          });
        });
      }

      console.log(`\n✅ 分镜拆解完成：`);
      console.log(`   场景数：${scenes.length}`);
      console.log(`   镜头数：${blocks.length}`);
      console.log(`   总时长：${blocks.reduce((sum, b) => sum + b.expected_duration, 0).toFixed(1)}秒`);

      // ⚠️ MVP检查：验证拆解质量
      if (scenes.length === 0) {
        throw new Error('⚠️ LLM未返回任何场景，拆解失败');
      }

      if (blocks.length === 0) {
        throw new Error('⚠️ LLM未返回任何镜头，拆解失败');
      }

      // 检查每个场景是否至少有3个镜头
      const invalidScenes = scenes.filter(s => s.blocks.length < 3);
      if (invalidScenes.length > 0) {
        console.warn(`⚠️ 警告：以下场景镜头数不足(<3)：`);
        invalidScenes.forEach(s => {
          console.warn(`   - ${s.name}: ${s.blocks.length}个镜头`);
        });
        throw new Error(
          `⚠️ LLM拆解不符合MVP标准：\n` +
          `${invalidScenes.length}个场景的镜头数少于3个。\n` +
          `请检查LLM是否正确理解了分镜拆解要求。\n\n` +
          `问题场景：${invalidScenes.map(s => `${s.name}(${s.blocks.length}个镜头)`).join(', ')}`
        );
      }

      return {
        status: 'success',
        scenes,
        blocks,
        summary: `解析完成：${scenes.length} 个场景，${blocks.length} 个镜头`,
        metadata: {
          totalScenes: scenes.length,
          totalBlocks: blocks.length,
          estimatedDuration: blocks.reduce((sum, b) => sum + b.expected_duration, 0),
          analysisTime: 0,
        },
      };
    } catch (error) {
      console.error(`❌ ${providerName} API call failed:`, error);

      // 处理 AbortError（超时）
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('aborted')) {
          throw new Error(
            `⏱️ 请求超时\n\n` +
            `LLM API 响应时间过长，请求已被中断。\n\n` +
            `可能的原因：\n` +
            `1. 剧本内容过长，分析需要更多时间\n` +
            `2. 网络连接不稳定\n` +
            `3. API 服务器繁忙\n\n` +
            `建议：请稍后重试，或尝试缩短剧本内容。`
          );
        }
      }

      throw error;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<LLMServiceConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 切换到智谱API
   */
  useZhipu() {
    this.config = { ...ZHIPU_CONFIG };
    console.log('✅ 已切换到智谱AI (GLM-4-Plus)');
  }

  /**
   * 切换到NVIDIA API
   */
  useNvidia() {
    this.config = { ...NVIDIA_CONFIG };
    console.log('✅ 已切换到NVIDIA (Llama 3.1 405B)');
  }

  /**
   * 获取当前提供商信息
   */
  getCurrentProvider(): { provider: string; model: string } {
    return {
      provider: this.config.provider === 'zhipu' ? '智谱AI' : 'NVIDIA',
      model: this.config.model || 'unknown',
    };
  }
}

/**
 * 单例实例
 */
export const llmService = new LLMService();

/**
 * 导出配置常量供外部使用
 */
export { NVIDIA_CONFIG, ZHIPU_CONFIG };
