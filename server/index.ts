/**
 * DocQA 智能问答助手 - 后端服务器
 * 
 * 基于硅基流动 (SiliconFlow) 的文档问答系统
 * 使用 Express + SQLite + SSE 流式响应
 */

import express from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import * as db from "./db.js";
import { streamChat as siliconFlowStreamChat, testConnection as sfTestConnection, SILICONFLOW_MODELS, type SiliconFlowConfig } from "./siliconflow.js";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3";

// Middleware
app.use(express.json());

// ========== 硅基流动配置（内存存储） ==========
let siliconFlowConfig: SiliconFlowConfig | null = null;

// ========== 自定义模型（文件持久化） ==========
const CUSTOM_MODELS_FILE = path.join(__dirname, 'custom-models.json');

interface CustomModel {
  modelId: string;
  name: string;
  description: string;
  category: string;
}

function loadCustomModels(): CustomModel[] {
  try {
    if (fs.existsSync(CUSTOM_MODELS_FILE)) {
      return JSON.parse(fs.readFileSync(CUSTOM_MODELS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[CustomModels] 加载失败:', e);
  }
  return [];
}

function saveCustomModels(models: CustomModel[]) {
  try {
    fs.writeFileSync(CUSTOM_MODELS_FILE, JSON.stringify(models, null, 2));
  } catch (e) {
    console.error('[CustomModels] 保存失败:', e);
  }
}

// ============= API 端点 =============

// 健康检查
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 获取硅基流动是否已配置（用于前端判断）
app.get("/api/config/status", (_req, res) => {
  res.json({ configured: !!(siliconFlowConfig && siliconFlowConfig.apiKey) });
});

// 快速保存 API Key（聊天页内联调用）
app.post("/api/config/save", (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: '请提供有效的 API Key' });
  }

  siliconFlowConfig = { apiKey };
  console.log(`[Config] API Key 已保存: ${apiKey.slice(0, 8)}****${apiKey.slice(-4)}`);

  res.json({ success: true, message: 'API Key 已保存' });
});

// 获取当前配置（脱敏）
app.get("/api/config", (_req, res) => {
  if (!siliconFlowConfig || !siliconFlowConfig.apiKey) {
    return res.json({ configured: false, config: null });
  }

  res.json({
    configured: true,
    config: {
      apiKey: `${siliconFlowConfig.apiKey.slice(0, 8)}****${siliconFlowConfig.apiKey.slice(-4)}`,
      baseUrl: siliconFlowConfig.baseUrl || undefined,
    },
  });
});

// 更新配置
app.put("/api/config", (req, res) => {
  const { apiKey, baseUrl } = req.body;

  if (apiKey && typeof apiKey === 'string') {
    siliconFlowConfig = { ...siliconFlowConfig, apiKey, baseUrl: baseUrl || undefined };
    return res.json({
      success: true,
      message: '配置已更新',
      apiKeyMasked: `${apiKey.slice(0, 8)}****${apiKey.slice(-4)}`,
    });
  }

  if (baseUrl) {
    if (siliconFlowConfig) {
      siliconFlowConfig.baseUrl = baseUrl;
    }
    return res.json({ success: true, message: 'Base URL 已更新' });
  }

  return res.status(400).json({ error: '无有效参数' });
});

// 测试连接
app.post("/api/config/test", async (req, res) => {
  const { apiKey, baseUrl } = req.body;
  const config: SiliconFlowConfig = {
    apiKey: apiKey || siliconFlowConfig?.apiKey || '',
    baseUrl: baseUrl || siliconFlowConfig?.baseUrl,
  };

  if (!config.apiKey) {
    return res.json({ success: false, error: '请提供 API Key' });
  }

  const result = await sfTestConnection(config);
  // 测试成功后自动保存
  if (result.success && !siliconFlowConfig?.apiKey) {
    siliconFlowConfig = { apiKey, baseUrl: baseUrl || undefined };
    console.log(`[Config] 通过测试自动保存 API Key`);
  }
  res.json(result);
});

// 获取可用模型列表
app.get("/api/models", (_req, res) => {
  const customModels = loadCustomModels();
  res.json({
    provider: 'siliconflow',
    models: [...SILICONFLOW_MODELS, ...customModels],
    defaultModel: DEFAULT_MODEL,
  });
});

// 获取/保存自定义模型
app.get("/api/custom-models", (_req, res) => {
  res.json({ models: loadCustomModels() });
});

app.post("/api/custom-models", (req, res) => {
  try {
    const models = req.body.models || [];
    // 简单校验
    if (!Array.isArray(models)) return res.status(400).json({ error: 'models 必须是数组' });
    for (const m of models) {
      if (!m.modelId || !m.name) return res.status(400).json({ error: '每条模型必须有 modelId 和 name' });
    }
    saveCustomModels(models);
    res.json({ ok: true, models });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || '保存失败' });
  }
});

// ============= 会话 API =============

// 获取所有会话
app.get("/api/sessions", (_req, res) => {
  try {
    const sessions = db.getAllSessions().map(session => ({
      ...session,
      messageCount: db.getMessagesBySession(session.id).length,
    }));
    res.json({ sessions });
  } catch (error: any) {
    console.error("[Sessions] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 获取单个会话及其消息
app.get("/api/sessions/:sessionId", (req, res) => {
  try {
    const session = db.getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "会话不存在" });

    const messages = db.getMessagesBySession(req.params.sessionId).map(msg => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null,
    }));

    res.json({ session, messages });
  } catch (error: any) {
    console.error("[Session] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 创建新会话
app.post("/api/sessions", (req, res) => {
  try {
    const { model = DEFAULT_MODEL, title = "新对话" } = req.body;
    const now = new Date().toISOString();

    const session = db.createSession({
      id: uuidv4(),
      title,
      model,
      provider: 'siliconflow',
      created_at: now,
      updated_at: now,
    });

    res.json({ session });
  } catch (error: any) {
    console.error("[Create Session] Error:", error);
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

// 更新会话
app.patch("/api/sessions/:sessionId", (req, res) => {
  try {
    const { title, model } = req.body;
    const success = db.updateSession(req.params.sessionId, { title, model });
    if (!success) return res.status(404).json({ error: "会话不存在" });
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Update Session] Error:", error);
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

// 删除会话
app.delete("/api/sessions/:sessionId", (req, res) => {
  try {
    const success = db.deleteSession(req.params.sessionId);
    if (!success) return res.status(404).json({ error: "会话不存在" });
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Session] Error:", error);
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ============= 聊天 API（SSE 流式） =============

const SYSTEM_PROMPT = `你是一个专业的文档问答助手（DocQA），擅长基于知识库和文档内容回答用户的问题。

## 核心能力
1. **精准检索** - 从文档中快速定位相关信息
2. **清晰解答** - 用简洁易懂的语言解释复杂概念
3. **引用溯源** - 回答时注明信息来源，确保可追溯性
4. **多格式支持** - 支持处理各种文档格式（PDF、Markdown、TXT、Word等）

## 工作方式
- 基于用户提供的文档/知识库内容进行回答
- 当信息不足时，主动告知用户需要补充哪些资料
- 对模糊问题先澄清再作答，避免臆测
- 使用结构化的方式组织答案（分点、表格、步骤等）
- 保持专业但友好的语调

## 输出规范
- 直接给出答案，不废话
- 关键术语加粗标注
- 复杂答案使用分层结构
- 如有多个可能答案，列出并说明适用场景`;

app.post("/api/chat", async (req, res) => {
  const { sessionId, message, model } = req.body;

  console.log(`\n[Chat] ========== 新请求 ==========`);
  console.log(`[Chat] SessionId: ${sessionId}`);
  console.log(`[Chat] Model: ${model || DEFAULT_MODEL}`);
  console.log(`[Chat] Message: ${message?.slice(0, 100)}${message?.length > 100 ? '...' : ''}`);

  // 验证消息
  if (!message) {
    return res.status(400).json({ error: "消息不能为空" });
  }

  // 验证 API Key 配置
  if (!siliconFlowConfig || !siliconFlowConfig.apiKey) {
    return res.status(401).json({ error: "NOT_CONFIGURED", message: "未配置硅基流动 API Key" });
  }

  // 获取或创建会话
  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();

  if (!session) {
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
      model: model || DEFAULT_MODEL,
      provider: 'siliconflow',
      created_at: now,
      updated_at: now,
    });
  }

  const selectedModel = model || session.model || DEFAULT_MODEL;
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  // 保存用户消息
  try {
    db.createMessage({
      id: userMessageId,
      session_id: session.id,
      role: 'user',
      content: message,
      model: null,
      created_at: now,
      tool_calls: null,
    });
  } catch (dbError: any) {
    console.error(`[Chat] 保存用户消息失败:`, dbError);
    return res.status(500).json({ error: "保存消息失败" });
  }

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 发送初始化信息
  res.write(
    `data: ${JSON.stringify({
      type: "init",
      sessionId: session.id,
      userMessageId,
      assistantMessageId,
      model: selectedModel,
      provider: 'siliconflow',
    })}\n\n`
  );

  try {
    // 构建历史消息（排除刚保存的当前用户消息）
    const allMessages = db.getMessagesBySession(session.id);
    const chatHistory = allMessages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .slice(0, -1)
      .map((msg) => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));

    console.log(`[Chat] 历史消息: ${chatHistory.length} 条`);

    let fullResponse = '';

    for await (const chunk of siliconFlowStreamChat(message, chatHistory, siliconFlowConfig!, {
      model: selectedModel,
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 4096,
    })) {
      if (chunk.type === 'text' && chunk.content) {
        fullResponse += chunk.content;
        res.write(`data: ${JSON.stringify({ type: "text", content: chunk.content })}\n\n`);
      } else if (chunk.type === 'error') {
        console.error(`[Chat] 错误:`, chunk.error);
        res.write(`data: ${JSON.stringify({ type: "error", message: chunk.error })}\n\n`);
        break;
      } else if (chunk.type === 'done') {
        res.write(
          `data: ${JSON.stringify({
            type: "done",
            duration: chunk.duration,
            cost: chunk.cost || 0,
            provider: 'siliconflow',
          })}\n\n`
        );
      }
    }

    // 保存助手回复
    if (fullResponse) {
      db.createMessage({
        id: assistantMessageId,
        session_id: session.id,
        role: 'assistant',
        content: fullResponse,
        model: selectedModel,
        created_at: new Date().toISOString(),
        tool_calls: null,
      });
    }

    // 更新会话标题
    const finalMessages = db.getMessagesBySession(session.id);
    if (finalMessages.length <= 2) {
      db.updateSession(session.id, {
        title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
        model: selectedModel,
      });
    }

    console.log(`[Chat] 完成 ✓`);
    res.end();
  } catch (error: any) {
    console.error(`[Chat] 异常:`, error?.message);
    res.write(`data: ${JSON.stringify({ type: "error", message: error?.message || "处理请求时发生错误" })}\n\n`);
    res.end();
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     ◉ DocQA 智能问答助手 - 服务已启动      ║
║     硅基流动 SiliconFlow 驱动             ║
║                                            ║
║     地址: http://localhost:${PORT}           ║
║     数据: SQLite                           ║
║                                            ║
╚════════════════════════════════════════════╝
  `);
});
