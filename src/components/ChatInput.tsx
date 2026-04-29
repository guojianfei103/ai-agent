/**
 * 聊天输入框组件
 * 
 * 特色功能：未配置 API Key 时，输入框变为内联快速配置卡片
 * 无需跳转到设置页面，直接在聊天页就能完成配置
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Select, Button, MessagePlugin } from 'tdesign-react';
import { ChatSender } from '@tdesign-react/chat';
import { ChevronDownIcon } from 'tdesign-icons-react';
import { Sparkles, KeyRound, ExternalLink } from 'lucide-react';
import { Model } from '../types';

interface ChatInputProps {
  inputValue: string;
  selectedModel: string;
  models: Model[];
  isLoading: boolean;
  isConfigured: boolean; // API Key 是否已配置
  onSend: (message: string) => void;
  onStop: () => void;
  onChange: (value: string) => void;
  onModelChange: (modelId: string) => void;
  onConfigured?: () => void; // 配置成功后通知父组件
}

export function ChatInput({
  inputValue,
  selectedModel,
  models,
  isLoading,
  isConfigured,
  onSend,
  onStop,
  onChange,
  onModelChange,
  onConfigured,
}: ChatInputProps) {
  const chatSenderRef = useRef<any>(null);

  // ===== 内联 API Key 配置状态 =====
  const [quickApiKey, setQuickApiKey] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  // 快速保存 API Key
  const handleQuickSave = useCallback(async () => {
    if (!quickApiKey.trim()) {
      MessagePlugin.warning('请输入 API Key');
      return;
    }
    if (!quickApiKey.trim().startsWith('sk-')) {
      MessagePlugin.warning('API Key 应以 sk- 开头');
      return;
    }

    setQuickSaving(true);
    try {
      // 测试连接
      const testRes = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: quickApiKey.trim() }),
      });
      const testData = await testRes.json();

      if (!testData.success) {
        MessagePlugin.error(`连接失败: ${testData.error || '未知错误'}`);
        return;
      }

      // 保存
      const saveRes = await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: quickApiKey.trim() }),
      });
      const saveData = await saveRes.json();

      if (saveData.success) {
        MessagePlugin.success('🎉 配置成功，开始对话吧！');
        setQuickApiKey('');
        onConfigured?.();
      } else {
        MessagePlugin.error(saveData.error || '保存失败');
      }
    } catch (e: any) {
      MessagePlugin.error(`配置失败: ${e.message}`);
    } finally {
      setQuickSaving(false);
    }
  }, [quickApiKey, onConfigured]);

  const handleSend = useCallback(
    (e: any) => {
      const content = e?.detail?.message || e?.detail || e?.message || inputValue;
      if (content && typeof content === 'string' && content.trim() && selectedModel) {
        onSend(content.trim());
      } else if (inputValue.trim() && selectedModel) {
        onSend(inputValue.trim());
      }
    },
    [inputValue, selectedModel, onSend]
  );

  const handleChange = useCallback(
    (e: any) => {
      const value = e?.detail ?? e ?? '';
      onChange(typeof value === 'string' ? value : '');
    },
    [onChange]
  );

  // ===== 未配置时显示的快速配置卡片 =====
  if (!isConfigured) {
    return (
      <div className="px-4 pb-6 pt-4" style={{ backgroundColor: 'var(--td-bg-color-page)' }}>
        <div className="max-w-3xl mx-auto">
          <div
            className="p-5 rounded-xl border-2"
            style={{
              borderColor: 'rgba(0,168,112,0.3)',
              backgroundColor: 'rgba(0,168,112,0.04)',
            }}
          >
            {/* 标题 */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(0,168,112,0.15)' }}>
                <KeyRound size={16} color="#00a870" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                  配置硅基流动 API Key 即可开始对话
                </p>
                <p className="text-xs" style={{ color: 'var(--td-text-color-secondary)' }}>
                  只需一步，填入 Key 就能用
                </p>
              </div>
            </div>

            {/* 输入行 */}
            <div className="flex gap-2">
              <input
                value={quickApiKey}
                onChange={(e) => setQuickApiKey(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxx"
                type="password"
                onKeyDown={(e) => e.key === 'Enter' && handleQuickSave()}
                className="flex-1 p-2.5 rounded-lg text-sm border outline-none focus:border-blue-400 transition-colors"
                style={{ border: '1px solid var(--td-component-border)', backgroundColor: 'var(--td-bg-color-container)' }}
              />
              <Button
                theme="primary"
                onClick={handleQuickSave}
                loading={quickSaving}
                disabled={!quickApiKey.trim()}
              >
                启用
              </Button>
            </div>

            {/* 获取 Key 链接 */}
            <div className="mt-2 flex items-center gap-2">
              <a
                href="https://cloud.siliconflow.cn/account/ak"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs"
                style={{ color: 'var(--td-brand-color)' }}
              >
                <ExternalLink size={12} />
                没有 Key？去控制台创建 →
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== 已配置：正常输入框 =====
  return (
    <div className="px-4 pb-6 pt-4" style={{ backgroundColor: 'var(--td-bg-color-page)' }}>
      <div className="max-w-3xl mx-auto">
        <ChatSender
          ref={chatSenderRef}
          value={inputValue}
          placeholder="输入你的问题..."
          disabled={!selectedModel}
          loading={isLoading}
          autosize={{ minRows: 1, maxRows: 6 }}
          actions={['send']}
          onSend={handleSend}
          onStop={onStop}
          onChange={handleChange}
        >
          <div slot="footer-prefix" className="flex items-center gap-2">
            {/* 提供商标识 */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(0,168,112,0.1)', color: '#00a870' }}>
              <Sparkles size={12} />
              SiliconFlow
            </div>

            <div className="h-4 w-px" style={{ backgroundColor: 'var(--td-component-stroke)' }} />

            {/* 模型选择器 */}
            <Select
              value={selectedModel}
              onChange={(value) => onModelChange(value as string)}
              placeholder="选择模型"
              size="small"
              style={{ width: 180 }}
              filterable
              borderless
              suffixIcon={<ChevronDownIcon />}
            >
              {models.map((model) => (
                <Select.Option key={model.modelId} value={model.modelId} label={model.name} />
              ))}
            </Select>
          </div>
        </ChatSender>
      </div>
    </div>
  );
}
