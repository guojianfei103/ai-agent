import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import '@tdesign-react/chat/es/style/index.js';

import { useAgents } from './hooks/useAgents';
import { useTheme } from './hooks/useTheme';
import { useSessions } from './hooks/useSessions';
import { useModels } from './hooks/useModels';
import { useChat } from './hooks/useChat';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import SettingsPage from './components/SettingsPage';
import { ChatPage } from './pages/ChatPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/chat/:sessionId" element={<AppContent />} />
      <Route path="/settings" element={<AppContent />} />
    </Routes>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const isSettingsPage = location.pathname === '/settings';

  // Hooks
  const { theme, toggleTheme } = useTheme();
  const { agents, addAgent, updateAgent, deleteAgent, getAgent } = useAgents();
  const { models, selectedModel, setSelectedModel, fetchModels, customModels, setCustomModels, addCustomModel } = useModels();
  const {
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    currentSession,
    sessionModels,
    fetchSessions,
    deleteSession,
    updateSessionModel,
    addSession,
    updateSession,
    updateSessionMessages,
  } = useSessions();

  // API Key 配置状态
  const [isConfigured, setIsConfigured] = useState(false);

  // 检查配置状态
  useEffect(() => {
    fetch('/api/config/status')
      .then((res) => res.json())
      .then((data) => setIsConfigured(data.configured))
      .catch(() => {});
  }, []);

  // 聊天 Hook
  const {
    isLoading,
    inputValue,
    setInputValue,
    permissionRequest,
    sendMessage,
    handleStop,
    handlePermissionAllow,
    handlePermissionDeny,
  } = useChat({
    currentSession,
    currentSessionId,
    selectedModel,
    getAgent,
    addSession,
    updateSession,
    updateSessionMessages,
    updateSessionModel,
    setCurrentSessionId,
    setSessions,
  });

  // 从 URL 同步 sessionId
  useEffect(() => {
    if (urlSessionId && urlSessionId !== currentSessionId) {
      setCurrentSessionId(urlSessionId);
    } else if (!urlSessionId && !isSettingsPage && currentSessionId) {
      setCurrentSessionId(null);
    }
  }, [urlSessionId, isSettingsPage, currentSessionId, setCurrentSessionId]);

  // 切换会话时恢复模型选择
  useEffect(() => {
    if (currentSessionId && sessionModels[currentSessionId]) {
      setSelectedModel(sessionModels[currentSessionId]);
    } else if (currentSession) {
      setSelectedModel(currentSession.model);
    }
  }, [currentSessionId, sessionModels, currentSession, setSelectedModel]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const updateCurrentSessionModel = useCallback(
    (modelId: string) => {
      setSelectedModel(modelId);
      if (currentSessionId) {
        updateSessionModel(currentSessionId, modelId);
      }
    },
    [currentSessionId, updateSessionModel, setSelectedModel]
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      const navigateTo = await deleteSession(sessionId);
      if (navigateTo) navigate(navigateTo);
    },
    [deleteSession, navigate]
  );

  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    navigate('/');
  }, [navigate, setCurrentSessionId]);

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      setCurrentSessionId(sessionId);
      navigate(`/chat/${sessionId}`);
    },
    [navigate, setCurrentSessionId]
  );

  const handleOpenSettings = useCallback(() => navigate('/settings'), [navigate]);

  const handleConfigured = useCallback(() => {
    setIsConfigured(true);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen w-screen" style={{ backgroundColor: 'var(--td-bg-color-page)' }}>
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        isSettingsPage={isSettingsPage}
        sidebarOpen={sidebarOpen}
        agents={agents}
        getAgent={getAgent}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onOpenSettings={handleOpenSettings}
      />

      <main className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: 'var(--td-bg-color-page)' }}>
        <Header
          isSettingsPage={isSettingsPage}
          sidebarOpen={sidebarOpen}
          theme={theme}
          currentSession={currentSession}
          models={models}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onToggleTheme={toggleTheme}
          onRefreshModels={fetchModels}
        />

        {isSettingsPage ? (
          <SettingsPage
            agents={agents}
            customModels={customModels}
            onModelsChange={setCustomModels}
            onAdd={addAgent}
            onUpdate={updateAgent}
            onDelete={deleteAgent}
            onConfigured={handleConfigured}
          />
        ) : (
          <ChatPage
            currentSession={currentSession}
            models={models}
            selectedModel={selectedModel}
            isConfigured={isConfigured}
            agents={agents}
            isLoading={isLoading}
            inputValue={inputValue}
            permissionRequest={permissionRequest}
            onSendMessage={sendMessage}
            onStop={handleStop}
            onInputChange={setInputValue}
            onModelChange={updateCurrentSessionModel}
            onPermissionAllow={handlePermissionAllow}
            onPermissionDeny={handlePermissionDeny}
            onConfigured={handleConfigured}
            onAddCustomModel={addCustomModel}
          />
        )}
      </main>
    </div>
  );
}

export default App;
