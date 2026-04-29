import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Model, Session, CustomAgent, PermissionRequest } from '../types';
import { NewChatView } from '../components/NewChatView';
import { ChatMessages } from '../components/ChatMessages';
import { ChatInput } from '../components/ChatInput';

interface ChatPageProps {
  currentSession: Session | undefined;
  models: Model[];
  selectedModel: string;
  isConfigured: boolean;
  agents: CustomAgent[];
  isLoading: boolean;
  inputValue: string;
  permissionRequest: PermissionRequest | null;
  onSendMessage: (message: string) => void;
  onStop: () => void;
  onInputChange: (value: string) => void;
  onModelChange: (modelId: string) => void;
  onPermissionAllow: () => void;
  onPermissionDeny: () => void;
  onConfigured?: () => void;
  onAddCustomModel: (modelId: string) => Model;
}

export function ChatPage({
  currentSession,
  models,
  selectedModel,
  isConfigured,
  agents,
  isLoading,
  inputValue,
  permissionRequest,
  onSendMessage,
  onStop,
  onInputChange,
  onModelChange,
  onPermissionAllow,
  onPermissionDeny,
  onConfigured,
  onAddCustomModel,
}: ChatPageProps) {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newChatAgentId, setNewChatAgentId] = useState('__default__');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  const handleSend = useCallback(
    (message: string) => {
      if (!currentSession) {
        onSendMessage(message, (path: string) => {
          setNewChatAgentId('__default__');
          navigate(path);
        });
      } else {
        onSendMessage(message);
      }
    },
    [currentSession, onSendMessage, navigate]
  );

  const showNewChatView = !currentSession || currentSession.messages.length === 0;

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6">
        {showNewChatView ? (
          <NewChatView
            agents={agents}
            models={models}
            selectedModel={selectedModel}
            newChatAgentId={newChatAgentId}
            onSelectModel={onModelChange}
            onSelectAgent={setNewChatAgentId}
            isConfigured={isConfigured}
            onAddCustomModel={onAddCustomModel}
          />
        ) : (
          <ChatMessages
            messages={currentSession!.messages}
            models={models}
            messagesEndRef={messagesEndRef}
            permissionRequest={permissionRequest}
            onPermissionAllow={onPermissionAllow}
            onPermissionDeny={onPermissionDeny}
          />
        )}
      </div>

      <ChatInput
        inputValue={inputValue}
        selectedModel={selectedModel}
        models={models}
        isLoading={isLoading}
        isConfigured={isConfigured}
        onSend={handleSend}
        onStop={onStop}
        onChange={onInputChange}
        onModelChange={onModelChange}
        onConfigured={onConfigured}
      />
    </>
  );
}
