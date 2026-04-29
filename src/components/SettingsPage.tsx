/**
 * 设置页面 - 硅基流动配置
 */
import { useState, useEffect, useCallback } from 'react';
import { Button, MessagePlugin } from 'tdesign-react';
// 注意：不使用 TDesign Input，避免 key="default" 重复警告
import { CheckCircleFilledIcon, CloseCircleFilledIcon, RefreshIcon } from 'tdesign-icons-react';
import { Sparkles, Plus, Trash2 } from 'lucide-react';
import { CustomAgent, PermissionMode, Model } from '../types';

interface SettingsPageProps {
  agents: CustomAgent[];
  customModels: Model[];
  onModelsChange: (models: Model[]) => void;
  onAdd: (agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => CustomAgent;
  onUpdate: (id: string, updates: Partial<Omit<CustomAgent, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
  onConfigured?: () => void;
}

interface CustomModelForm {
  modelId: string;
  name: string;
  description: string;
}

export default function SettingsPage({ agents, customModels, onModelsChange, onAdd, onUpdate, onDelete, onConfigured }: SettingsPageProps) {
  const [apiKey, setApiKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // 自定义模型管理
  const [showModelForm, setShowModelForm] = useState(false);
  const [modelForm, setModelForm] = useState<CustomModelForm>({ modelId: '', name: '', description: '' });
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  const resetModelForm = () => {
    setModelForm({ modelId: '', name: '', description: '' });
    setEditingModelId(null);
    setShowModelForm(false);
  };

  const handleModelSubmit = () => {
    if (!modelForm.modelId.trim()) {
      MessagePlugin.warning('请输入模型 ID');
      return;
    }
    const updated = editingModelId
      ? customModels.map(m => m.modelId === editingModelId ? { ...m, ...modelForm } : m)
      : [...customModels, { ...modelForm, category: '自定义' as const }];
    onModelsChange(updated);
    resetModelForm();
    MessagePlugin.success(editingModelId ? '模型已更新' : '模型已添加');
  };

  const startEditModel = (model: Model) => {
    setModelForm({ modelId: model.modelId, name: model.name, description: model.description || '' });
    setEditingModelId(model.modelId);
    setShowModelForm(true);
  };

  const deleteModel = (modelId: string) => {
    onModelsChange(customModels.filter(m => m.modelId !== modelId));
    MessagePlugin.success('模型已删除');
  };

  // 加载配置状态
  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setIsConfigured(data.configured);
      if (data.configured && data.config?.apiKey) {
        setMaskedKey(data.config.apiKey);
        setApiKey(''); // 清空输入，显示已配置状态
      }
    } catch (e) {
      console.error('加载配置失败:', e);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // 保存 API Key
  const handleSave = async () => {
    if (!apiKey.trim()) {
      MessagePlugin.warning('请输入 API Key');
      return;
    }
    if (!apiKey.trim().startsWith('sk-')) {
      MessagePlugin.warning('API Key 格式不正确，应以 sk- 开头');
      return;
    }

    setSaving(true);
    try {
      // 先测试再保存
      const testRes = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const testData = await testRes.json();

      if (!testData.success) {
        MessagePlugin.error(`连接测试失败: ${testData.error || '未知错误'}`);
        return;
      }

      // 测试通过后保存
      const saveRes = await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const saveData = await saveRes.json();

      if (saveData.success) {
        MessagePlugin.success('🎉 API Key 保存成功，可以开始使用了！');
        setApiKey('');
        setIsConfigured(true);
        setMaskedKey(`${apiKey.trim().slice(0, 8)}****${apiKey.trim().slice(-4)}`);
        onConfigured?.();
      } else {
        MessagePlugin.error(saveData.error || '保存失败');
      }
    } catch (e: any) {
      MessagePlugin.error(`保存失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // 单独测试连接
  const handleTest = async () => {
    if (!apiKey.trim()) {
      MessagePlugin.warning('请先输入 API Key');
      return;
    }

    setTesting(true);
    try {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        MessagePlugin.success(`连接成功！发现 ${data.models?.length || '多个'} 个可用模型`);
      } else {
        MessagePlugin.error(`连接失败: ${data.error || '未知错误'}`);
      }
    } catch (e: any) {
      MessagePlugin.error(`测试失败: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  // 删除配置
  const handleReset = async () => {
    try {
      await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: '' }),
      });
      setIsConfigured(false);
      setMaskedKey('');
      setApiKey('');
      MessagePlugin.info('配置已清除');
    } catch (e) {
      MessagePlugin.error('清除失败');
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8" style={{ backgroundColor: 'var(--td-bg-color-container)' }}>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--td-text-color-primary)' }}>设置</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
            配置硅基流动 API 即可开始使用
          </p>
        </div>

        {/* ========== 硅基流动配置 ========== */}
        <div className="p-6 rounded-xl" style={{ border: '1px solid var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container-hover)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(0,168,112,0.1)' }}>
              <Sparkles size={20} color="#00a870" />
            </div>
            <div>
              <h2 className="text-lg font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                硅基流动 SiliconFlow
              </h2>
              <div className="flex items-center gap-1.5 text-xs" style={{
                color: isConfigured ? 'var(--td-success-color)' : 'var(--td-warning-color)'
              }}>
                {isConfigured
                  ? <><CheckCircleFilledIcon size={14} /> 已配置 ({maskedKey})</>
                  : <><CloseCircleFilledIcon size={14} /> 未配置</>
                }
              </div>
            </div>
          </div>

          {isConfigured ? (
            /* 已配置状态 */
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(0,168,112,0.06)', color: 'var(--td-success-color)' }}>
                <CheckCircleFilledIcon size={16} />
                API Key 已配置，可以正常使用
              </div>
              <div className="flex gap-2">
                <Button variant="outline" theme="danger" size="small" onClick={handleReset}>
                  清除配置
                </Button>
              </div>
            </div>
          ) : (
            /* 未配置状态 - 分步引导 */
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: 'var(--td-brand-color)', color: '#fff' }}>1</div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>获取 API Key</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--td-text-color-secondary)' }}>
                    前往硅基流动控制台创建 API Key
                  </p>
                  <a href="https://cloud.siliconflow.cn/account/ak" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs mt-1" style={{ color: 'var(--td-brand-color)' }}>
                    🚀 前往控制台 →
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: 'var(--td-brand-color)', color: '#fff' }}>2</div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-2" style={{ color: 'var(--td-text-color-primary)' }}>填入 API Key</p>
                  <input
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-xxxxxxxxxxxxxxxx"
                    type="password"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    className="w-full p-2.5 rounded-lg text-sm border outline-none focus:border-blue-400 transition-colors"
                    style={{ border: '1px solid var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container)' }}
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2 pl-9">
                <Button
                  theme="primary"
                  onClick={handleSave}
                  loading={saving}
                  disabled={!apiKey.trim()}
                >
                  💾 保存并开始使用
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTest}
                  loading={testing}
                  disabled={!apiKey.trim()}
                >
                  🧪 测试连接
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ========== 自定义 Agent ========== */}
        <div className="p-6 rounded-xl" style={{ border: '1px solid var(--td-component-border)' }}>
          <AgentSection agents={agents} onAdd={onAdd} onUpdate={onUpdate} onDelete={onDelete} />
        </div>

        {/* ========== 自定义模型 ========== */}
        <div className="p-6 rounded-xl" style={{ border: '1px solid var(--td-component-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium" style={{ color: 'var(--td-text-color-primary)' }}>自定义模型</h3>
            {!showModelForm && (
              <Button size="small" variant="outline" onClick={() => setShowModelForm(true)}>
                + 添加模型
              </Button>
            )}
          </div>

          {showModelForm && (
            <div className="space-y-3 mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--td-bg-color-container-hover)' }}>
              <input
                value={modelForm.modelId}
                onChange={(e) => setModelForm(p => ({ ...p, modelId: e.target.value }))}
                placeholder="模型 ID，如 Qwen/Qwen2.5-7B-Instruct"
                className="w-full p-2 rounded-lg text-sm border outline-none focus:border-blue-400 transition-colors"
                style={{ border: '1px solid var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container)' }}
              />
              <input
                value={modelForm.name}
                onChange={(e) => setModelForm(p => ({ ...p, name: e.target.value }))}
                placeholder="显示名称（可选，留空自动从 ID 提取）"
                className="w-full p-2 rounded-lg text-sm border outline-none focus:border-blue-400 transition-colors"
                style={{ border: '1px solid var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container)' }}
              />
              <input
                value={modelForm.description}
                onChange={(e) => setModelForm(p => ({ ...p, description: e.target.value }))}
                placeholder="描述（可选）"
                className="w-full p-2 rounded-lg text-sm border outline-none focus:border-blue-400 transition-colors"
                style={{ border: '1px solid var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container)' }}
              />
              <div className="flex gap-2">
                <Button size="small" theme="primary" onClick={handleModelSubmit}>
                  {editingModelId ? '更新' : '添加'}
                </Button>
                <Button size="small" variant="outline" onClick={resetModelForm}>取消</Button>
              </div>
            </div>
          )}

          {customModels.length === 0 && !showModelForm ? (
            <p className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>暂无自定义模型，点击「添加模型」增加</p>
          ) : (
            <div className="space-y-2">
              {customModels.map((model) => (
                <div key={model.modelId} className="flex items-center justify-between p-3 rounded-lg" style={{ border: '1px solid var(--td-component-border)' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--td-text-color-primary)' }}>{model.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--td-text-color-secondary)' }}>{model.modelId}</p>
                    {model.description && <p className="text-xs truncate mt-0.5" style={{ color: 'var(--td-text-color-placeholder)' }}>{model.description}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button className="p-1.5 rounded hover:bg-gray-100 transition-colors" onClick={() => startEditModel(model)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button className="p-1.5 rounded hover:bg-red-50 transition-colors" onClick={() => deleteModel(model.modelId)}>
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Agent 配置子组件 */
function AgentSection({ agents, onAdd, onUpdate, onDelete }: {
  agents: CustomAgent[];
  onAdd: (agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => CustomAgent;
  onUpdate: (id: string, updates: Partial<Omit<CustomAgent, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', systemPrompt: '', permissionMode: 'default' as PermissionMode });

  const resetForm = () => {
    setForm({ name: '', description: '', systemPrompt: '', permissionMode: 'default' });
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.systemPrompt.trim()) {
      MessagePlugin.warning('请填写名称和系统提示词');
      return;
    }

    if (editId) {
      onUpdate(editId, { name: form.name, description: form.description, systemPrompt: form.systemPrompt, permissionMode: form.permissionMode });
      MessagePlugin.success('Agent 已更新');
    } else {
      onAdd({ name: form.name, description: form.description, systemPrompt: form.systemPrompt, permissionMode: form.permissionMode });
      MessagePlugin.success('Agent 已创建');
    }
    resetForm();
  };

  const startEdit = (agent: CustomAgent) => {
    setForm({ name: agent.name, description: agent.description || '', systemPrompt: agent.systemPrompt, permissionMode: agent.permissionMode || 'default' });
    setEditId(agent.id);
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-medium" style={{ color: 'var(--td-text-color-primary)' }}>自定义 Agent</h3>
        {!showForm && (
          <Button size="small" variant="outline" onClick={() => setShowForm(true)}>+ 新增</Button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3 mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--td-bg-color-container-hover)' }}>
          <input
            value={form.name}
            onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Agent 名称"
            className="w-full p-2.5 rounded-lg text-sm border outline-none focus:border-blue-400 transition-colors"
            style={{ border: '1px solid var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container)' }}
          />
          <input
            value={form.description}
            onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="简短描述（可选）"
            className="w-full p-2.5 rounded-lg text-sm border outline-none focus:border-blue-400 transition-colors"
            style={{ border: '1px solid var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container)' }}
          />
          <textarea
            value={form.systemPrompt}
            onChange={(e) => setForm(p => ({ ...p, systemPrompt: e.target.value }))}
            placeholder="系统提示词（定义 Agent 的角色和行为）"
            rows={4}
            className="w-full p-3 rounded-lg text-sm resize-none"
            style={{ border: '1px solid var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container)' }}
          />
          <div className="flex gap-2">
            <Button size="small" theme="primary" onClick={handleSubmit}>{editId ? '更新' : '创建'}</Button>
            <Button size="small" variant="outline" onClick={resetForm}>取消</Button>
          </div>
        </div>
      )}

      {agents.length === 0 && !showForm ? (
        <p className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>暂无自定义 Agent</p>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg" style={{ border: '1px solid var(--td-component-border)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>{agent.name}</p>
                {agent.description && <p className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>{agent.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="small" variant="text" onClick={() => startEdit(agent)}>编辑</Button>
                <Button size="small" variant="text" theme="danger" onClick={() => onDelete(agent.id)}>删除</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
