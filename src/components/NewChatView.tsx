import { useState } from 'react';
import { Bot, Plus, X } from 'lucide-react';
import { APP_CONFIG } from '../config';
import { Model, Agent } from '../types';
import { ICON_MAP } from '../utils/iconMap';

interface NewChatViewProps {
  agents: Agent[];
  models: Model[];
  selectedModel: string;
  newChatAgentId: string;
  isConfigured: boolean;
  onSelectModel: (modelId: string) => void;
  onSelectAgent: (agentId: string) => void;
  onAddCustomModel: (modelId: string) => Model;
}

export function NewChatView({
  agents,
  models,
  selectedModel,
  newChatAgentId,
  isConfigured,
  onSelectModel,
  onSelectAgent,
}: NewChatViewProps) {
  const [customModelInput, setCustomModelInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const selectedAgent = agents.find((a) => a.id === newChatAgentId);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg mx-auto"
            style={{ background: 'linear-gradient(135deg, #00a870, #00c890)' }}
          >
            <span className="text-3xl font-bold text-white">{APP_CONFIG.nameInitial}</span>
          </div>
          <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--td-text-color-primary)' }}>
            {APP_CONFIG.name}
          </h2>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            基于硅基流动的智能文档问答助手
          </p>
        </div>

        {/* 配置状态提示 */}
        <div
          className="mb-6 p-3 rounded-xl flex items-center gap-2 text-sm"
          style={{
            backgroundColor: isConfigured ? 'rgba(0,168,112,0.06)' : 'rgba(237,123,47,0.06)',
            border: `1px solid ${isConfigured ? 'rgba(0,168,112,0.2)' : 'var(--td-warning-color-3)'}`,
          }}
        >
          {isConfigured ? (
            <>
              ✅ 硅基流动已配置，可以开始对话
              <span style={{ marginLeft: 'auto', fontSize: '11px' }}>在下方输入框直接开始</span>
            </>
          ) : (
            <>
              ⚠️ 请先配置 API Key
              <span style={{ marginLeft: 'auto', fontSize: '11px' }}>在下方输入框快速设置</span>
            </>
          )}
        </div>

        {/* Agent 选择 */}
        {agents.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-primary)' }}>
              选择角色
            </label>
            <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto">
              {agents.map((agent) => {
                const AgentIcon = ICON_MAP[agent.icon || 'Bot'] || Bot;
                const isSelected = agent.id === newChatAgentId;
                return (
                  <div
                    key={agent.id}
                    className={`p-3 rounded-xl cursor-pointer transition-all border-2`}
                    style={{
                      borderColor: isSelected ? (agent.color || '#00a870') : 'transparent',
                      backgroundColor: isSelected ? 'rgba(0,168,112,0.08)' : 'var(--td-bg-color-component)',
                    }}
                    onClick={() => onSelectAgent(agent.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: agent.color || '#0052d9' }}
                      >
                        <AgentIcon size={18} color="white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--td-text-color-primary)' }}>
                          {agent.name}
                        </div>
                        {agent.description && (
                          <div className="text-xs truncate mt-0.5" style={{ color: 'var(--td-text-color-placeholder)' }}>
                            {agent.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 模型选择 */}
        {models.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-primary)' }}>
              选择模型
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto mb-3">
              {models.map((model) => {
                const isSelected = model.modelId === selectedModel;
                return (
                  <div
                    key={model.modelId}
                    className={`p-2.5 rounded-lg cursor-pointer transition-all text-sm border ${isSelected ? 'border-2' : 'border border-transparent'}`}
                    style={{
                      borderColor: isSelected ? '#00a870' : 'transparent',
                      backgroundColor: isSelected ? 'rgba(0,168,112,0.08)' : 'var(--td-bg-color-component)',
                    }}
                    onClick={() => onSelectModel(model.modelId)}
                  >
                    <div className="font-medium truncate" style={{ color: 'var(--td-text-color-primary)' }}>
                      {model.name}
                    </div>
                    {model.description && (
                      <div className="text-xs truncate mt-0.5" style={{ color: 'var(--td-text-color-placeholder)' }}>
                        {model.description}
                      </div>
                    )}
                    {model.category && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded mt-1" style={{
                        backgroundColor: 'var(--td-bg-color-container)',
                        color: 'var(--td-text-color-placeholder)',
                      }}>
                        {model.category}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 自定义模型输入 */}
            {showCustomInput ? (
              <div className="flex items-center gap-2">
                <input
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder="输入模型 ID，如 Qwen/Qwen2.5-7B-Instruct"
                  className="flex-1 p-2 text-sm rounded-lg border outline-none focus:border-blue-400"
                  style={{ border: '1px solid var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container)' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customModelInput.trim()) {
                      const m = onAddCustomModel(customModelInput.trim());
                      onSelectModel(m.modelId);
                      setCustomModelInput('');
                      setShowCustomInput(false);
                    }
                  }}
                />
                <button
                  className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                  onClick={() => {
                    if (customModelInput.trim()) {
                      const m = onAddCustomModel(customModelInput.trim());
                      onSelectModel(m.modelId);
                      setCustomModelInput('');
                      setShowCustomInput(false);
                    }
                  }}
                >
                  <Plus size={16} />
                </button>
                <button
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                  onClick={() => { setShowCustomInput(false); setCustomModelInput(''); }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: '#00a870' }}
                onClick={() => setShowCustomInput(true)}
              >
                <Plus size={12} /> 使用其他模型
              </button>
            )}
          </div>
        )}

        {/* 选中的 Agent 预览 */}
        {selectedAgent && (selectedAgent.systemPrompt || '').trim().length > 0 && (
          <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: 'var(--td-bg-color-component)' }}>
            <p className="text-xs line-clamp-2" style={{ color: 'var(--td-text-color-secondary)' }}>
              {selectedAgent.systemPrompt.slice(0, 150)}
            </p>
          </div>
        )}

        <p className="text-center text-xs mt-4" style={{ color: 'var(--td-text-color-placeholder)' }}>
          选择模型后在下方输入问题开始对话
        </p>
      </div>
    </div>
  );
}
