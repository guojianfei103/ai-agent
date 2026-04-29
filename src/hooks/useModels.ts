import { useState, useEffect, useCallback, useRef } from 'react';
import { Model } from '../types';

const STORAGE_KEY = 'defaultModel';
const CUSTOM_MODELS_KEY = 'customModels';

// 内置模型（与后端 SILICONFLOW_MODELS 同步）
const BUILTIN_MODELS: Model[] = [
  { modelId: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3', description: 'DeepSeek 最新旗舰模型，通用能力强', category: 'DeepSeek' },
  { modelId: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek-R1', description: '推理增强模型，擅长复杂逻辑和数学', category: 'DeepSeek' },
  { modelId: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', name: 'R1-Distill-Qwen-32B', description: '轻量版 R1，性价比高', category: 'DeepSeek' },
  { modelId: 'Qwen/Qwen3-235B-A22B', name: 'Qwen3-235B-A22B', description: '阿里通义千问最新 MoE 大模型', category: 'Qwen' },
  { modelId: 'Qwen/Qwen3-32B', name: 'Qwen3-32B', description: 'Qwen3 中等规模版本', category: 'Qwen' },
  { modelId: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B-Instruct', description: '通义千问 72B 指令微调版', category: 'Qwen' },
];

export function useModels() {
  const [customModels, setCustomModelsState] = useState<Model[]>(() => {
    try {
      // 迁移：把旧的 extraModels 合并到 customModels
      const saved = localStorage.getItem(CUSTOM_MODELS_KEY);
      let models: Model[] = saved ? JSON.parse(saved) : [];
      try {
        const extra = localStorage.getItem('extraModels');
        if (extra) {
          const extraModels: Model[] = JSON.parse(extra);
          const ids = new Set(models.map(m => m.modelId));
          for (const m of extraModels) {
            if (!ids.has(m.modelId)) models.push(m);
          }
          localStorage.removeItem('extraModels');
          // 保存合并后的结果
          localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(models));
        }
      } catch {}
      return models;
    } catch {
      return [];
    }
  });
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || '';
  });

  // 用 ref 保持 customModels 最新值，避免闭包问题
  const customModelsRef = useRef(customModels);
  customModelsRef.current = customModels;

  // 合并内置 + 自定义模型
  const allModels = [...BUILTIN_MODELS, ...customModels];

  // 保存到 localStorage 并更新 state
  const saveCustomModels = useCallback((ms: Model[]) => {
    setCustomModelsState(ms);
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(ms));
  }, []);

  // 清空自定义模型（设置页「清除」调用）
  const clearCustomModels = useCallback(() => {
    setCustomModelsState([]);
    localStorage.removeItem(CUSTOM_MODELS_KEY);
  }, []);

  // 添加自定义模型（供对话框「使用其他模型」调用）
  const addCustomModel = useCallback((modelId: string): Model => {
    const model: Model = {
      modelId,
      name: modelId.split('/').pop() || modelId,
      description: '自定义模型',
      category: '自定义',
    };
    const prev = customModelsRef.current;
    const updated = [...prev.filter(m => m.modelId !== modelId), model];
    saveCustomModels(updated);
    return model;
  }, [saveCustomModels]);

  // 删除单个自定义模型
  const deleteCustomModel = useCallback((modelId: string) => {
    const prev = customModelsRef.current;
    const updated = prev.filter(m => m.modelId !== modelId);
    saveCustomModels(updated);
  }, [saveCustomModels]);

  const fetchModels = useCallback(async () => {
    // 这个方法保留以兼容 Header 的 onRefreshModels
    // 但模型列表由本地 BUILTIN_MODELS + customModels 决定
  }, []);

  useEffect(() => {
    // 确保默认模型选中
    if (!selectedModel && allModels.length > 0) {
      const saved = localStorage.getItem(STORAGE_KEY);
      const modelToUse = saved && allModels.some(m => m.modelId === saved)
        ? saved
        : allModels[0].modelId;
      setSelectedModel(modelToUse);
      localStorage.setItem(STORAGE_KEY, modelToUse);
    }
  }, []);

  return {
    models: allModels,
    customModels,
    setCustomModels: saveCustomModels,
    clearCustomModels,
    addCustomModel,
    deleteCustomModel,
    selectedModel,
    setSelectedModel: (model: string) => {
      setSelectedModel(model);
      localStorage.setItem(STORAGE_KEY, model);
    },
    fetchModels,
  };
}
