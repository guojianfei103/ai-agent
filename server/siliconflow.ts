/**
 * 硅基流动 (SiliconFlow) API 服务模块
 * 基于 OpenAI 兼容接口实现流式对话
 */

// 硅基流动 API 基础配置
const SILICONFLOW_DEFAULT_BASE_URL = 'https://api.siliconflow.cn/v1';

// 硅基流动热门模型列表（持续更新）
export const SILICONFLOW_MODELS = [
  // === DeepSeek 系列（推荐） ===
  { modelId: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3', description: 'DeepSeek 最新旗舰模型，通用能力强', category: 'DeepSeek' },
  { modelId: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek-R1', description: '推理增强模型，擅长复杂逻辑和数学', category: 'DeepSeek' },
  { modelId: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', name: 'R1-Distill-Qwen-32B', description: '轻量版 R1，性价比高', category: 'DeepSeek' },
  { modelId: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B', name: 'R1-Distill-Qwen-14B', description: '更轻量版 R1', category: 'DeepSeek' },
  
  // === Qwen 通义千问系列 ===
  { modelId: 'Qwen/Qwen3-235B-A22B', name: 'Qwen3-235B-A22B', description: '阿里通义千问最新 MoE 大模型', category: 'Qwen' },
  { modelId: 'Qwen/Qwen3-32B', name: 'Qwen3-32B', description: 'Qwen3 中等规模版本', category: 'Qwen' },
  { modelId: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B-Instruct', description: '通义千问 72B 指令微调版', category: 'Qwen' },
  { modelId: 'Qwen/Qwen2.5-Coder-32B-Instruct', name: 'Qwen2.5-Coder-32B', description: '代码专用模型', category: 'Qwen' },

  // === GLM 智谱系列 ===
  { modelId: 'THUDM/glm-4-9b-chat', name: 'GLM-4-9B-Chat', description: '智谱 GLM4 轻量版', category: 'GLM' },
  { modelId: 'THUDM/GLM-4-9B-Chat-0414', name: 'GLM-4-9B-Chat-0414', description: 'GLM4 最新版', category: 'GLM' },

  // === 其他热门模型 ===
  { modelId: 'Pro/deepseek-ai/DeepSeek-R1', name: 'Pro DeepSeek-R1', description: 'R1 专业版，更长上下文', category: 'Pro' },
  { modelId: 'Pro/Qwen/Qwen3-235B-A22B', name: 'Pro Qwen3-235B', description: 'Qwen3 专业版', category: 'Pro' },
];

export interface SiliconFlowConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface SiliconFlowMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SiliconStreamChunk {
  type: 'text' | 'done' | 'error';
  content?: string;
  error?: string;
  duration?: number;
  cost?: number;
}

/**
 * 调用硅基流动 API 进行流式对话
 * @param message 用户消息
 * @param history 对话历史（不包含当前消息）
 * @param config 配置
 * @param options 额外选项
 */
export async function* streamChat(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  config: SiliconFlowConfig,
  options: {
    model?: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): AsyncGenerator<SiliconStreamChunk, void, unknown> {
  const baseUrl = (config.baseUrl || SILICONFLOW_DEFAULT_BASE_URL).replace(/\/$/, '');
  const apiKey = config.apiKey;

  if (!apiKey) {
    yield { type: 'error', error: '未配置硅基流动 API Key，请在设置中填写' };
    return;
  }

  const model = options.model || 'deepseek-ai/DeepSeek-V3';
  
  // 构建消息数组（不包含当前用户消息，由调用方控制）
  const messages: SiliconFlowMessage[] = [];

  // 添加系统提示词
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }

  // 添加历史消息
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // 添加当前用户消息
  messages.push({ role: 'user', content: message });

  console.log(`[SiliconFlow] 发送请求...`);
  console.log(`[SiliconFlow] - Model: ${model}`);
  console.log(`[SiliconFlow] - Messages count: ${messages.length}`);
  console.log(`[SiliconFlow] - Base URL: ${baseUrl}`);
  console.log(`[SiliconFlow] - History: ${history.length} 条, 当前消息长度: ${message.length}`);

  try {
    const startTime = Date.now();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: true,
      }),
      // Node.js fetch 需要手动设置以避免压缩问题
      // @ts-ignore Node.js specific option
      compress: false,
    });

    // 处理 HTTP 错误响应
    if (!response.ok) {
      let errorMsg = `API 请求失败 (${response.status} ${response.statusText})`;
      
      try {
        const errorText = await response.text();
        console.error(`[SiliconFlow] HTTP Error Response (${response.status}):`, errorText.slice(0, 500));
        
        // 尝试解析 JSON 错误
        try {
          const errorJson = JSON.parse(errorText);
          // 硅基流动错误格式：{ error: { message: "...", code: "..." } } 或 { message: "..." }
          errorMsg = errorJson?.error?.message 
            || errorJson?.message 
            || errorJson?.error?.code 
            || `${errorMsg}: ${errorText.slice(0, 200)}`;
        } catch {
          // 非 JSON 响应，使用原始文本
          if (errorText.trim()) {
            errorMsg = `${errorMsg}\n\n${errorText.slice(0, 300)}`;
          }
        }
      } catch (readErr: any) {
        console.error(`[SiliconFlow] 无法读取错误响应体:`, readErr.message);
        errorMsg = `${errorMsg}（无法读取详细错误信息）`;
      }
      
      yield { type: 'error', error: errorMsg };
      return;
    }

    // 检查响应体是否存在
    if (!response.body) {
      yield { type: 'error', error: 'API 返回了空响应体，可能是网络问题或服务端异常' };
      return;
    }

    // 处理 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let buffer = '';
    let hasReceivedData = false;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // 按 SSE 协议分割事件
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留可能不完整的最后一行
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // 跳过 SSE 注释行和空行
        if (!trimmedLine || trimmedLine.startsWith(':')) continue;
        
        // 只处理 data: 行
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6); // 移除 'data: ' 前缀
          
          // 流结束标记
          if (data === '[DONE]') {
            hasReceivedData = true;
            const duration = Date.now() - startTime;
            console.log(`[SiliconFlow] 收到 [DONE]，流式响应完成，耗时: ${duration}ms`);
            yield { type: 'done', content: '', duration, cost: 0 };
            return; // 正常结束
          }
          
          // 解析 JSON 数据块
          try {
            const parsed = JSON.parse(data);
            
            // 检查是否为错误类型（某些提供商在流中返回错误）
            if (parsed.error) {
              const errMessage = parsed.error.message || parsed.error || JSON.stringify(parsed.error);
              console.error(`[SiliconFlow] 流内错误:`, errMessage);
              yield { type: 'error', error: `[硅基流动] ${errMessage}` };
              return;
            }

            const delta = parsed.choices?.[0]?.delta;
            const finishReason = parsed.choices?.[0]?.finish_reason;
            
            // 文本内容增量
            if (delta?.content && typeof delta.content === 'string') {
              hasReceivedData = true;
              yield { type: 'text', content: delta.content };
            } else if (delta?.reasoning_content && typeof delta.reasoning_content === 'string') {
              // DeepSeek-R1 的推理内容，可以选择忽略或展示
              // 目前忽略 reasoning_content，只输出最终回答
              hasReceivedData = true;
            }
            
            // 完成标记
            if (finishReason === 'stop' || finishReason === 'length') {
              const duration = Date.now() - startTime;
              const usage = parsed.usage;
              console.log(`[SiliconFlow] 收到 finish_reason=${finishReason}, 耗时: ${duration}ms`);
              if (usage) {
                console.log(`[SiliconFlow] Token 使用: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`);
              }
              yield { type: 'done', content: '', duration, cost: usage ? (usage.total_tokens / 1000000) : 0 };
            }
          } catch (parseError) {
            // JSON 解析失败 — 记录但不要中断流
            console.warn(`[SiliconFlow] SSE 数据解析跳过（非标准格式）:`, data.slice(0, 120));
          }
        }
      }
    }
    
    // 流自然结束时没有收到 [DONE]
    if (!hasReceivedData) {
      console.warn(`[SiliconFlow] 流结束但未收到任何有效数据，buffer 剩余: "${buffer.slice(0, 100)}"`);
      yield { type: 'error', error: '未收到模型响应数据。可能的原因：1）模型名称不存在；2）账户余额不足；3）API Key 权限不足' };
    } else {
      // 有数据但没正常结束，补发 done
      const duration = Date.now() - startTime;
      yield { type: 'done', content: '', duration, cost: 0 };
    }
    
  } catch (error: any) {
    // 区分网络错误和其他异常
    const errMsg = error?.message || String(error);
    console.error(`[SiliconFlow] 异常:`, error);
    
    // 友好的错误提示
    let userFriendlyError = errMsg;
    if (errMsg.includes('ECONNREFUSED') || errMsg.includes('ENOTFOUND')) {
      userFriendlyError = `无法连接到硅基流动服务器 (${baseUrl})。请检查网络或 Base URL 设置是否正确。`;
    } else if (errMsg.includes('ETIMEDOUT') || errMsg.includes('socket hang up')) {
      userFriendlyError = '连接超时。硅基流动服务器响应过慢或不可用，请稍后重试。';
    } else if (errMsg.includes('abort') || errMsg.includes('cancel')) {
      userFriendlyError = '请求被取消';
    }
    
    yield { type: 'error', error: userFriendlyError };
  }
}

/**
 * 测试硅基流动连接是否正常
 */
export async function testConnection(config: SiliconFlowConfig): Promise<{
  success: boolean;
  error?: string;
  models?: string[];
}> {
  try {
    const baseUrl = (config.baseUrl || SILICONFLOW_DEFAULT_BASE_URL).replace(/\/$/, '');
    
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `连接测试失败 (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.error?.message || errorMsg;
      } catch {}
      return { success: false, error: errorMsg };
    }

    const data = await response.json();
    const modelIds = (data.data || []).map((m: any) => m.id);

    console.log(`[SiliconFlow] 连接成功，可用模型数: ${modelIds.length}`);
    return { success: true, models: modelIds };
  } catch (error: any) {
    return { success: false, error: error.message || '网络连接失败' };
  }
}
