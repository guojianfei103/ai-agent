import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, ToolCall, Session, CustomAgent, ContentBlock } from '../types';

const STORAGE_KEYS = {
  draftInput: 'draftInput',
};

interface UseChatOptions {
  currentSession: Session | undefined;
  currentSessionId: string | null;
  selectedModel: string;
  getAgent: (id: string) => CustomAgent | undefined;
  addSession: (session: Session) => void;
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  updateSessionMessages: (sessionId: string, updater: (messages: Message[]) => Message[]) => void;
  updateSessionModel: (sessionId: string, modelId: string) => void;
  setCurrentSessionId: (id: string | null) => void;
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
}

export function useChat(options: UseChatOptions) {
  const {
    currentSession,
    currentSessionId,
    selectedModel,
    getAgent,
    updateSessionModel,
    setCurrentSessionId,
    setSessions,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.draftInput) || '';
  });
  const [permissionRequest, setPermissionRequest] = useState<any>(null);

  const saveInput = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  // 发送消息
  const sendMessage = useCallback(async (
    messageContent: string,
    onNavigate?: (path: string) => void
  ) => {
    if (!messageContent.trim() || isLoading) return;

    let sessionId = currentSessionId;

    if (!sessionId) {
      // 创建新会话
      const newSession: Session = {
        id: uuidv4(),
        title: messageContent.slice(0, 30) + (messageContent.length > 30 ? '...' : ''),
        model: selectedModel,
        agentId: '__default__',
        createdAt: new Date(),
        messages: [],
      };

      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      sessionId = newSession.id;
      updateSessionModel(newSession.id, selectedModel);

      onNavigate?.(`/chat/${newSession.id}`);
    }

    const tempUserMessageId = uuidv4();
    const tempAssistantMessageId = uuidv4();

    const userMessage: Message = {
      id: tempUserMessageId,
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    const assistantMessage: Message = {
      id: tempAssistantMessageId,
      role: 'assistant',
      content: '',
      model: selectedModel,
      timestamp: new Date(),
      isStreaming: true,
      contentBlocks: [],
    };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === sessionId) {
          return {
            ...s,
            title: s.messages.length === 0
              ? messageContent.slice(0, 30) + (messageContent.length > 30 ? '...' : '')
              : s.title,
            messages: [...s.messages, userMessage, assistantMessage],
          };
        }
        return s;
      })
    );

    setInputValue('');
    localStorage.removeItem(STORAGE_KEYS.draftInput);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: messageContent,
          model: selectedModel,
        }),
      });

      // 处理未配置 API Key 的特殊响应
      if (response.status === 401) {
        const errData = await response.json();
        if (errData.error === 'NOT_CONFIGURED') {
          setSessions((prev) =>
            prev.map((s) => ({
              ...s,
              messages: s.messages.filter((m) => m.id !== tempAssistantMessageId),
              ...(s.id === sessionId ? { messages: [...s.messages.filter((m) => m.id !== assistantMessageId)] } : {}),
            }))
          );
          setIsLoading(false);
          throw new Error('NOT_CONFIGURED');
        }
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let usedModel = selectedModel;
      let realSessionId = sessionId!;
      let realAssistantMessageId = tempAssistantMessageId;
      let contentBlocks: ContentBlock[] = [];
      let currentTextBlock = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'init') {
                realSessionId = data.sessionId;
                realAssistantMessageId = data.assistantMessageId;
                usedModel = data.model;

                if (realSessionId !== sessionId) {
                  setSessions((prev) =>
                    prev.map((s) =>
                      s.id === sessionId ? { ...s, id: realSessionId } : s
                    )
                  );
                  setCurrentSessionId(realSessionId);
                  sessionId = realSessionId;
                }

                setSessions((prev) =>
                  prev.map((s) => ({
                    ...s,
                    messages:
                      s.id === realSessionId
                        ? s.messages.map((m) =>
                            m.id === tempAssistantMessageId
                              ? { ...m, id: realAssistantMessageId }
                              : m
                          )
                        : s.messages,
                  }))
                );
              } else if (data.type === 'text') {
                fullContent += data.content;
                currentTextBlock += data.content;

                const lastBlock = contentBlocks[contentBlocks.length - 1];
                if (lastBlock && lastBlock.type === 'text') {
                  lastBlock.text = currentTextBlock;
                } else if (currentTextBlock) {
                  contentBlocks.push({ type: 'text', text: currentTextBlock });
                }

                setSessions((prev) =>
                  prev.map((s) => ({
                    ...s,
                    messages:
                      s.id === realSessionId
                        ? s.messages.map((m) =>
                            m.id === realAssistantMessageId
                              ? { ...m, content: fullContent, model: usedModel, contentBlocks: [...contentBlocks] }
                              : m
                          )
                        : s.messages,
                  }))
                );
              } else if (data.type === 'done') {
                setSessions((prev) =>
                  prev.map((s) => ({
                    ...s,
                    messages:
                      s.id === realSessionId
                        ? s.messages.map((m) =>
                            m.id === realAssistantMessageId ? { ...m, isStreaming: false } : m
                          )
                        : s.messages,
                  }))
                );
              } else if (data.type === 'error') {
                console.error('[Stream Error]', data.message);
                fullContent += `\n\n❌ ${data.message}`;
                setSessions((prev) =>
                  prev.map((s) => ({
                    ...s,
                    messages:
                      s.id === realSessionId
                        ? s.messages.map((m) =>
                            m.id === realAssistantMessageId
                              ? { ...m, content: fullContent, isStreaming: false, isError: true }
                              : m
                          )
                        : s.messages,
                  }))
                );
              } else if (data.type === 'permission_request') {
                setPermissionRequest(data);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      // NOT_CONFIGURED 不需要设置错误消息，由 ChatInput 组件处理 UI 展示
      if (error.message !== 'NOT_CONFIGURED') {
        setSessions((prev) =>
          prev.map((s) => ({
            ...s,
            messages:
              s.id === sessionId
                ? s.messages.map((m) =>
                    m.id === tempAssistantMessageId
                      ? { ...m, content: '发生错误，请重试', isStreaming: false, isError: true }
                      : m
                  )
                : s.messages,
          }))
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    currentSession,
    currentSessionId,
    selectedModel,
    getAgent,
    updateSessionModel,
    setCurrentSessionId,
    setSessions,
    isLoading,
  ]);

  const handleStop = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handlePermissionAllow = useCallback(async () => {
    if (!permissionRequest) return;
    await fetch('/api/permission-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: permissionRequest.requestId, behavior: 'allow' }),
    });
    setPermissionRequest(null);
  }, [permissionRequest]);

  const handlePermissionDeny = useCallback(async () => {
    if (!permissionRequest) return;
    await fetch('/api/permission-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: permissionRequest.requestId, behavior: 'deny', message: '用户拒绝' }),
    });
    setPermissionRequest(null);
  }, [permissionRequest]);

  return {
    isLoading,
    inputValue,
    setInputValue: saveInput,
    permissionRequest,
    sendMessage,
    handleStop,
    handlePermissionAllow,
    handlePermissionDeny,
  };
}
