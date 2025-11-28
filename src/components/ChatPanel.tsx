import { useState, useRef, useEffect, useCallback } from 'react';
import { useForgeStore } from '../store/forgeStore';
import { getLLMService, extractCodeFromResponse, getApiKeyForProvider, PROVIDER_URLS } from '../services/llm';
import type { ChatMessage, LLMConfig, LLMProvider } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
  onApplyCode?: (code: string) => void;
  onProposeMutation?: (code: string) => void;
  autoApplyEnabled?: boolean;
  wasAutoApplied?: boolean;
}

// Loading wave animation component
function LoadingWave() {
  return (
    <div className="loading-wave-container">
      <div className="loading-wave">
        <div className="loading-wave-text">
          <span className="wave-icon">🤖</span>
          <span>Generating response...</span>
        </div>
        <div className="loading-wave-bars">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="wave-bar"
              style={{ animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </div>
        <div className="loading-wave-progress">
          <div className="wave-progress-track">
            <div className="wave-progress-fill" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, onApplyCode, onProposeMutation, autoApplyEnabled, wasAutoApplied }: MessageBubbleProps) {
  const extractedCode = message.role === 'assistant' ? extractCodeFromResponse(message.content) : null;
  const isStreaming = message.status === 'streaming';
  const showAutoAppliedBadge = wasAutoApplied && extractedCode && message.status === 'complete';
  
  // Format message content with code highlighting
  const formatContent = (content: string) => {
    // Split by code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        // Extract language and code
        const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
        if (match) {
          const [, lang, code] = match;
          const isOpenSCAD = lang === 'openscad';
          return (
            <div key={i} className="message-code-block">
              <div className="code-header">
                <span className="code-lang">{lang || 'code'}</span>
                {isOpenSCAD && wasAutoApplied ? (
                  <span className="auto-applied-badge">✓ Auto-Applied</span>
                ) : isOpenSCAD && onApplyCode && !autoApplyEnabled ? (
                  <button
                    className="apply-code-btn"
                    onClick={() => onApplyCode(code.trim())}
                  >
                    ⚡ Apply Changes
                  </button>
                ) : null}
              </div>
              <pre><code>{code.trim()}</code></pre>
            </div>
          );
        }
      }
      // Regular text - preserve line breaks
      return part.split('\n').map((line, j) => (
        <span key={`${i}-${j}`}>
          {line}
          {j < part.split('\n').length - 1 && <br />}
        </span>
      ));
    });
  };
  
  return (
    <div className={`message-bubble ${message.role} ${isStreaming ? 'streaming' : ''} ${showAutoAppliedBadge ? 'auto-applied' : ''}`}>
      <div className="message-header">
        <span className="message-role">
          {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
          {message.modelUsed && (
            <span className="message-model-badge">
              {message.modelUsed === 'vision' ? '👁 Vision' : 
               message.modelUsed === 'planning' ? '⚙️ Planning' : 
               '🔄 Vision+Planning'}
            </span>
          )}
          {isStreaming && <span className="streaming-indicator">Generating...</span>}
          {showAutoAppliedBadge && <span className="auto-applied-indicator">✓ Applied</span>}
        </span>
        <span className="message-time">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      
      <div className="message-content">
        {message.status === 'pending' || isStreaming ? (
          <LoadingWave />
        ) : message.status === 'error' ? (
          <div className="message-error">
            ❌ {message.error || 'An error occurred'}
          </div>
        ) : (
          <div className="message-content-reveal">
            {formatContent(message.content)}
          </div>
        )}
      </div>
      
      {message.attachedImage && (
        <div className="message-attachment">
          <img src={message.attachedImage} alt="Attached scene" />
        </div>
      )}
      
      {extractedCode && message.status === 'complete' && !wasAutoApplied && (
        <div className="message-actions">
          {onApplyCode && (
            <button
              className="action-btn apply-direct-btn"
              onClick={() => onApplyCode(extractedCode)}
            >
              ✓ Apply to Editor
            </button>
          )}
          {onProposeMutation && (
            <button
              className="action-btn propose-btn"
              onClick={() => onProposeMutation(extractedCode)}
            >
              ⚡ Propose as Mutation
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface ModelInfo {
  id: string;
  name: string;
  owned_by?: string;
}

interface SettingsModalProps {
  config: LLMConfig;
  onSave: (config: Partial<LLMConfig>) => void;
  onClose: () => void;
}

// Provider presets with their info
const PROVIDER_PRESETS: Array<{
  id: LLMProvider;
  name: string;
  baseUrl: string;
  defaultModel: string;
  requiresKey: boolean;
  keyPlaceholder: string;
  fallbackModels?: string[]; // Known models if /models endpoint fails
}> = [
  { id: 'ollama', name: 'Ollama', baseUrl: PROVIDER_URLS.ollama, defaultModel: '', requiresKey: false, keyPlaceholder: '(optional for local)' },
  { id: 'openai', name: 'OpenAI', baseUrl: PROVIDER_URLS.openai, defaultModel: 'gpt-4o', requiresKey: true, keyPlaceholder: 'sk-...', 
    fallbackModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'] },
  { id: 'xai', name: 'X.AI (Grok)', baseUrl: PROVIDER_URLS.xai, defaultModel: 'grok-2-vision-1212', requiresKey: true, keyPlaceholder: 'xai-...',
    fallbackModels: ['grok-2-vision-1212', 'grok-2-1212', 'grok-beta', 'grok-vision-beta'] },
  { id: 'together', name: 'Together', baseUrl: PROVIDER_URLS.together, defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', requiresKey: true, keyPlaceholder: '',
    fallbackModels: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Llama-Vision-Free', 'Qwen/Qwen2.5-Coder-32B-Instruct', 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B'] },
  { id: 'groq', name: 'Groq', baseUrl: PROVIDER_URLS.groq, defaultModel: 'llama-3.3-70b-versatile', requiresKey: true, keyPlaceholder: 'gsk_...',
    fallbackModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'] },
];

// Helper to detect provider from baseUrl
function detectProviderFromUrl(baseUrl: string): LLMProvider {
  if (baseUrl.includes('api.openai.com')) return 'openai';
  if (baseUrl.includes('api.x.ai')) return 'xai';
  if (baseUrl.includes('api.together.xyz')) return 'together';
  if (baseUrl.includes('api.groq.com')) return 'groq';
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) return 'ollama';
  return 'custom';
}

function SettingsModal({ config, onSave, onClose }: SettingsModalProps) {
  const [localConfig, setLocalConfig] = useState(() => ({
    ...config,
    providerApiKeys: config.providerApiKeys || {},
  }));
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  
  // Detect current provider from baseUrl
  const currentProvider = detectProviderFromUrl(localConfig.baseUrl);
  
  // Get API key for current provider
  const getCurrentApiKey = useCallback(() => {
    return getApiKeyForProvider(localConfig);
  }, [localConfig]);
  
  // Update API key for a specific provider
  const updateProviderApiKey = useCallback((provider: LLMProvider, key: string) => {
    setLocalConfig(prev => ({
      ...prev,
      providerApiKeys: {
        ...prev.providerApiKeys,
        [provider]: key || undefined,
      },
    }));
  }, []);
  
  // Get fallback models for the current provider
  const getFallbackModels = useCallback((baseUrl: string): ModelInfo[] => {
    const provider = PROVIDER_PRESETS.find(p => baseUrl.includes(new URL(p.baseUrl).hostname));
    if (provider?.fallbackModels) {
      return provider.fallbackModels.map(id => ({ id, name: id }));
    }
    return [];
  }, []);

  // Fetch models when baseUrl changes
  const fetchModels = useCallback(async (baseUrl: string, apiKey?: string) => {
    setModelsLoading(true);
    setModelsError(null);
    setAvailableModels([]);
    
    try {
      // Don't send Content-Type for GET requests - some APIs reject it
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch(`${baseUrl}/models`, { 
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle different API response formats
      let models: ModelInfo[] = [];
      if (Array.isArray(data)) {
        // Ollama format: direct array
        models = data.map((m: { id?: string; name?: string; model?: string }) => ({
          id: m.id || m.name || m.model || '',
          name: m.name || m.id || m.model || '',
        }));
      } else if (data.data && Array.isArray(data.data)) {
        // OpenAI format: { data: [...] }
        models = data.data.map((m: { id: string; owned_by?: string }) => ({
          id: m.id,
          name: m.id,
          owned_by: m.owned_by,
        }));
      } else if (data.models && Array.isArray(data.models)) {
        // Alternative format: { models: [...] }
        models = data.models.map((m: { name?: string; model?: string }) => ({
          id: m.name || m.model || '',
          name: m.name || m.model || '',
        }));
      }
      
      setAvailableModels(models);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch models';
      
      // Try to use fallback models for known providers
      const fallbacks = getFallbackModels(baseUrl);
      if (fallbacks.length > 0) {
        setAvailableModels(fallbacks);
        setModelsError(`Using known models (API returned: ${msg})`);
      } else {
        setModelsError(msg);
      }
    } finally {
      setModelsLoading(false);
    }
  }, [getFallbackModels]);
  
  // Fetch models on mount
  useEffect(() => {
    fetchModels(localConfig.baseUrl, getCurrentApiKey());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - URL changes trigger fetchModels via onBlur
  
  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };
  
  const handleRefreshModels = () => {
    fetchModels(localConfig.baseUrl, getCurrentApiKey());
  };
  
  const handleUrlChange = (newUrl: string) => {
    setLocalConfig({ ...localConfig, baseUrl: newUrl });
  };
  
  const handleUrlBlur = () => {
    fetchModels(localConfig.baseUrl, getCurrentApiKey());
  };
  
  const handleProviderSelect = (preset: typeof PROVIDER_PRESETS[0]) => {
    setLocalConfig(prev => ({ 
      ...prev, 
      baseUrl: preset.baseUrl, 
      provider: preset.id,
      model: preset.defaultModel || prev.model,
    }));
    // Fetch models with the appropriate API key for the new provider
    const apiKey = localConfig.providerApiKeys[preset.id as keyof typeof localConfig.providerApiKeys];
    fetchModels(preset.baseUrl, apiKey);
  };
  
  // Helper to render model selector
  const renderModelSelector = (
    label: string,
    icon: string,
    description: string,
    value: string,
    onChange: (value: string) => void
  ) => (
    <div className="model-config-item">
      <label>
        <span className="model-type-icon">{icon}</span>
        {label}
      </label>
      <div className="model-type-desc">{description}</div>
      {availableModels.length > 0 ? (
        <div className="model-selector">
          <select value={value} onChange={(e) => onChange(e.target.value)}>
            {!availableModels.find(m => m.id === value) && value && (
              <option value={value}>{value}</option>
            )}
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} {model.owned_by ? `(${model.owned_by})` : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={modelsLoading ? 'Loading models...' : 'Enter model name'}
        />
      )}
    </div>
  );
  
  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>⚙️ LLM Settings</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="settings-content">
          <div className="settings-presets">
            <label>Provider</label>
            <div className="preset-buttons">
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={`preset-btn ${currentProvider === preset.id ? 'active' : ''}`}
                  onClick={() => handleProviderSelect(preset)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
          
          <div className="settings-field">
            <label>API Base URL</label>
            <input
              type="text"
              value={localConfig.baseUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="http://localhost:11434/v1"
            />
          </div>
          
          {/* Per-Provider API Keys Section */}
          <div className="settings-section api-keys-section">
            <label className="section-label">API Keys</label>
            <div className="api-keys-grid">
              {PROVIDER_PRESETS.filter(p => p.requiresKey).map((preset) => {
                const isCurrentProvider = currentProvider === preset.id;
                const keyValue = localConfig.providerApiKeys[preset.id as keyof typeof localConfig.providerApiKeys] || '';
                return (
                  <div 
                    key={preset.id} 
                    className={`api-key-field ${isCurrentProvider ? 'current' : ''}`}
                  >
                    <label>
                      {preset.name}
                      {isCurrentProvider && <span className="current-badge">Active</span>}
                    </label>
                    <input
                      type="password"
                      value={keyValue}
                      onChange={(e) => updateProviderApiKey(preset.id, e.target.value)}
                      onBlur={() => {
                        if (isCurrentProvider) {
                          fetchModels(localConfig.baseUrl, keyValue || undefined);
                        }
                      }}
                      placeholder={preset.keyPlaceholder}
                    />
                  </div>
                );
              })}
            </div>
            <div className="api-keys-hint">
              API keys are stored locally in your browser and sent directly to the provider.
            </div>
          </div>
          
          <div className="settings-field model-field">
            <div className="label-row">
              <label>Available Models</label>
              <button 
                className="refresh-btn" 
                onClick={handleRefreshModels}
                disabled={modelsLoading}
                title="Refresh models list"
              >
                {modelsLoading ? '⏳' : '🔄'} Refresh
              </button>
            </div>
            
            {modelsError ? (
              <div className="models-error">
                <span className="error-icon">⚠️</span>
                <span>{modelsError}</span>
              </div>
            ) : availableModels.length > 0 && (
              <span className="model-count">{availableModels.length} models available</span>
            )}
          </div>
          
          {/* Multi-model configuration */}
          <div className="model-config-section">
            <label className="section-label">Model Configuration</label>
            <div className="model-config-grid">
              {renderModelSelector(
                'Planning Model',
                '⚙️',
                'Generates OpenSCAD code from text descriptions',
                localConfig.planningModel || localConfig.model,
                (value) => setLocalConfig({ ...localConfig, planningModel: value })
              )}
              
              {renderModelSelector(
                'Vision Model',
                '👁',
                'Analyzes images to understand 3D geometry',
                localConfig.visionModel || localConfig.model,
                (value) => setLocalConfig({ ...localConfig, visionModel: value })
              )}
            </div>
          </div>
          
          <div className="settings-row">
            <div className="settings-field">
              <label>Temperature: {localConfig.temperature}</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={localConfig.temperature}
                onChange={(e) => setLocalConfig({ ...localConfig, temperature: parseFloat(e.target.value) })}
              />
            </div>
            
            <div className="settings-field">
              <label>Max Tokens</label>
              <input
                type="number"
                value={localConfig.maxTokens}
                onChange={(e) => setLocalConfig({ ...localConfig, maxTokens: parseInt(e.target.value) || 4096 })}
                min="256"
                max="32768"
              />
            </div>
          </div>
          
          <div className="settings-section">
            <label className="section-label">Automation</label>
            <div className="settings-toggles">
              <label className={`toggle-option ${localConfig.autoApply ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={localConfig.autoApply ?? false}
                  onChange={(e) => setLocalConfig({ ...localConfig, autoApply: e.target.checked })}
                />
                <span className="toggle-icon">⚡</span>
                <div>
                  <span className="toggle-label">Auto-Apply Code</span>
                  <span className="toggle-hint">Apply LLM code changes automatically</span>
                </div>
              </label>
              
              <label className={`toggle-option ${localConfig.autoRender ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={localConfig.autoRender ?? true}
                  onChange={(e) => setLocalConfig({ ...localConfig, autoRender: e.target.checked })}
                />
                <span className="toggle-icon">▶</span>
                <div>
                  <span className="toggle-label">Auto-Render</span>
                  <span className="toggle-hint">Render after applying changes</span>
                </div>
              </label>
            </div>
          </div>
        </div>
        
        <div className="settings-footer">
          <button className="action-btn cancel-btn" onClick={onClose}>Cancel</button>
          <button className="action-btn save-btn" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}

interface ChatPanelProps {
  onCompile?: () => void;
  onCancelCompile?: () => void;
  isCompiling?: boolean;
  triggerCapture?: () => Promise<string | null>;
}

export function ChatPanel({ onCompile, onCancelCompile, isCompiling, triggerCapture }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [includeCode, setIncludeCode] = useState(true);
  const [includeImage, setIncludeImage] = useState(false);
  const [includeSystem, setIncludeSystem] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoAppliedMessages, setAutoAppliedMessages] = useState<Set<string>>(new Set());
  const [isCapturing, setIsCapturing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    code,
    captures,
    chatMessages,
    llmConfig,
    isChatStreaming,
    systemMessages,
    addChatMessage,
    updateChatMessage,
    appendToChatMessage,
    clearChat,
    setChatStreaming,
    updateLLMConfig,
    addMutation,
    addCapture,
  } = useForgeStore();
  
  // Quick toggle handlers for auto-apply and auto-render
  const toggleAutoApply = useCallback(() => {
    const newValue = !llmConfig.autoApply;
    updateLLMConfig({ autoApply: newValue });
    const llmService = getLLMService();
    llmService.updateConfig({ autoApply: newValue });
  }, [llmConfig.autoApply, updateLLMConfig]);
  
  const toggleAutoRender = useCallback(() => {
    const newValue = !llmConfig.autoRender;
    updateLLMConfig({ autoRender: newValue });
    const llmService = getLLMService();
    llmService.updateConfig({ autoRender: newValue });
  }, [llmConfig.autoRender, updateLLMConfig]);
  
  // Initialize LLM service with stored config on mount
  useEffect(() => {
    const llmService = getLLMService();
    llmService.updateConfig(llmConfig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - we don't want to re-init on every config change
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  // Get the latest capture for image attachment
  const latestCapture = captures.length > 0 ? captures[captures.length - 1] : null;
  
  // Format system messages for inclusion in chat
  const formatSystemMessagesForChat = useCallback(() => {
    const recentMessages = systemMessages.slice(-5); // Last 5 messages
    if (recentMessages.length === 0) return '';
    
    const formatted = recentMessages.map(m => {
      const icon = m.type === 'error' ? '❌' : m.type === 'warning' ? '⚠️' : 'ℹ️';
      return `${icon} [${m.type.toUpperCase()}] ${m.content}`;
    }).join('\n');
    
    return `\n\n---\n**Recent System Messages:**\n${formatted}`;
  }, [systemMessages]);
  
  const handleSend = useCallback(async () => {
    if (!input.trim() || isChatStreaming || isCapturing) return;
    
    // Capture start time to check if user edits during LLM generation
    const startTime = Date.now();
    
    let imageDataUrl: string | undefined;
    
    // Auto-capture if includeImage is enabled
    if (includeImage && triggerCapture) {
      setIsCapturing(true);
      try {
        const capturedUrl = await triggerCapture();
        if (capturedUrl) {
          imageDataUrl = capturedUrl;
          // Also save to captures store
          addCapture({
            imageDataUrl: capturedUrl,
            code,
            cameraPosition: [0, 0, 0],
            cameraTarget: [0, 0, 0],
          });
        }
      } catch (e) {
        console.warn('Failed to capture image:', e);
      } finally {
        setIsCapturing(false);
      }
    } else if (includeImage && latestCapture) {
      // Fall back to existing capture if no trigger function
      imageDataUrl = latestCapture.imageDataUrl;
    }
    
    const hasImage = !!imageDataUrl;
    
    // Build message content with optional system messages
    let messageContent = input.trim();
    if (includeSystem && systemMessages.length > 0) {
      messageContent += formatSystemMessagesForChat();
    }
    
    const userMessage = {
      role: 'user' as const,
      content: messageContent,
      attachedCode: includeCode ? code : undefined,
      attachedImage: imageDataUrl,
    };
    
    addChatMessage(userMessage);
    setInput('');
    
    // Create placeholder for assistant response
    const assistantMsgId = addChatMessage({
      role: 'assistant',
      content: '',
      status: 'pending',
      modelUsed: hasImage ? 'both' : 'planning',
    });
    
    setChatStreaming(true);
    
    try {
      const llmService = getLLMService();
      llmService.updateConfig(llmConfig);
      
      // Get all messages including the one we just added
      const allMessages = [...useForgeStore.getState().chatMessages];
      // Remove the pending assistant message for the API call
      const messagesForApi = allMessages.filter(m => m.id !== assistantMsgId);
      
      updateChatMessage(assistantMsgId, { status: 'streaming', content: '' });
      
      for await (const chunk of llmService.streamChat(
        messagesForApi,
        code,
        imageDataUrl
      )) {
        appendToChatMessage(assistantMsgId, chunk);
      }
      
      updateChatMessage(assistantMsgId, { status: 'complete' });
      
      // Auto-apply if enabled - but check if user edited during generation
      if (llmConfig.autoApply) {
        const currentState = useForgeStore.getState();
        const finalMessage = currentState.chatMessages.find(m => m.id === assistantMsgId);
        
        // Check if user edited code during LLM generation
        const userEditedDuringGeneration = currentState.lastUserEdit > startTime;
        
        if (finalMessage && !userEditedDuringGeneration) {
          const extractedCode = extractCodeFromResponse(finalMessage.content);
          if (extractedCode) {
            // Apply the code
            useForgeStore.getState().setCode(extractedCode);
            useForgeStore.getState().pushPatch('LLM Chat: Auto-applied code', extractedCode, 'llm');
            
            // Mark this message as auto-applied
            setAutoAppliedMessages(prev => new Set([...prev, assistantMsgId]));
            
            // Auto-render if enabled
            if (llmConfig.autoRender && onCompile) {
              // Small delay to let state update
              setTimeout(() => onCompile(), 100);
            }
          }
        }
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      updateChatMessage(assistantMsgId, {
        status: 'error',
        error: errorMessage,
        content: '',
      });
    } finally {
      setChatStreaming(false);
    }
  }, [input, includeCode, includeImage, includeSystem, code, latestCapture, llmConfig, isChatStreaming, isCapturing, systemMessages, triggerCapture, addChatMessage, updateChatMessage, appendToChatMessage, setChatStreaming, onCompile, addCapture, formatSystemMessagesForChat]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // Apply code directly to the editor
  const handleApplyCode = useCallback((proposedCode: string) => {
    // Directly update the code in the editor
    useForgeStore.getState().setCode(proposedCode);
    // Also push to history so it can be undone
    useForgeStore.getState().pushPatch('LLM Chat: Applied code changes', proposedCode, 'llm');
    
    // Auto-render if enabled
    if (llmConfig.autoRender && onCompile) {
      setTimeout(() => onCompile(), 100);
    }
  }, [llmConfig.autoRender, onCompile]);
  
  // Propose code as a mutation (for review)
  const handleProposeMutation = useCallback((proposedCode: string) => {
    addMutation({
      description: 'LLM Chat Suggestion',
      proposedCode,
      reasoning: 'Code proposed during chat conversation',
      confidence: 0.85,
    });
  }, [addMutation]);
  
  const handleAbort = useCallback(() => {
    const llmService = getLLMService();
    llmService.abort();
    setChatStreaming(false);
  }, [setChatStreaming]);
  
  return (
    <div className="chat-panel">
      <div className="panel-header">
        <span className="panel-title">
          <span className="panel-icon">💬</span>
          LLM Chat
          {isChatStreaming && <span className="streaming-badge">Streaming...</span>}
        </span>
        <div className="panel-actions">
          {isCompiling && onCancelCompile && (
            <button
              className="action-btn compile-status-btn"
              onClick={onCancelCompile}
              title="Cancel render (Esc)"
            >
              <span className="mini-spinner"></span>
              Rendering...
              <span className="cancel-x">✕</span>
            </button>
          )}
          <button
            className="action-btn settings-btn"
            onClick={() => setShowSettings(true)}
            title="LLM Settings"
          >
            ⚙️
          </button>
          {chatMessages.length > 0 && (
            <button
              className="action-btn clear-btn"
              onClick={clearChat}
              title="Clear chat"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      
      <div className="chat-messages">
        {chatMessages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-text">Start a conversation</div>
            <div className="empty-hint">
              Ask the LLM to help you modify your OpenSCAD code.
              <br /><br />
              Examples:
              <br />• "Add fillets to all edges"
              <br />• "Make it 20% smaller"
              <br />• "Add mounting holes for M3 screws"
              <br />• "Optimize for 3D printing"
            </div>
          </div>
        ) : (
          <>
            {chatMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onApplyCode={msg.role === 'assistant' ? handleApplyCode : undefined}
                onProposeMutation={msg.role === 'assistant' ? handleProposeMutation : undefined}
                autoApplyEnabled={llmConfig.autoApply}
                wasAutoApplied={autoAppliedMessages.has(msg.id)}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      <div className="chat-input-area">
        <div className="input-options">
          <label className={`option-toggle ${includeCode ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={includeCode}
              onChange={(e) => setIncludeCode(e.target.checked)}
            />
            <span className="option-icon">📝</span> Code
          </label>
          <label className={`option-toggle ${includeImage ? 'active' : ''}`} title="Auto-captures the 3D view when sending">
            <input
              type="checkbox"
              checked={includeImage}
              onChange={(e) => setIncludeImage(e.target.checked)}
            />
            <span className="option-icon">📷</span> Image
            {isCapturing && <span className="option-hint">(capturing...)</span>}
          </label>
          <label className={`option-toggle ${includeSystem ? 'active' : ''} ${systemMessages.length === 0 ? 'disabled' : ''}`} title="Include recent errors and warnings in context">
            <input
              type="checkbox"
              checked={includeSystem}
              onChange={(e) => setIncludeSystem(e.target.checked)}
              disabled={systemMessages.length === 0}
            />
            <span className="option-icon">⚠️</span> Errors
            {systemMessages.length > 0 && <span className="option-badge">{systemMessages.length}</span>}
          </label>
          
          <div className="option-divider" />
          
          <button 
            className={`option-toggle automation-toggle ${llmConfig.autoApply ? 'active' : ''}`}
            onClick={toggleAutoApply}
            title={llmConfig.autoApply ? 'Auto-apply enabled - code will be applied automatically' : 'Auto-apply disabled - you\'ll need to manually apply code'}
          >
            <span className="option-icon">⚡</span> Auto-Apply
          </button>
          <button 
            className={`option-toggle automation-toggle ${llmConfig.autoRender ? 'active' : ''}`}
            onClick={toggleAutoRender}
            title={llmConfig.autoRender ? 'Auto-render enabled - model will render after changes' : 'Auto-render disabled - you\'ll need to manually compile'}
          >
            <span className="option-icon">▶</span> Auto-Render
          </button>
        </div>
        
        <div className="input-container">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the LLM to modify your code..."
            rows={2}
            disabled={isChatStreaming}
          />
          
          <div className="input-actions">
            {isChatStreaming ? (
              <button className="action-btn abort-btn" onClick={handleAbort}>
                ⏹ Stop
              </button>
            ) : (
              <button
                className="action-btn send-btn"
                onClick={handleSend}
                disabled={!input.trim()}
              >
                ➤ Send
              </button>
            )}
          </div>
        </div>
        
        <div className="input-hint">
          Press Enter to send • Shift+Enter for new line
        </div>
      </div>
      
      <div className="panel-footer">
        <button 
          className="model-indicator clickable"
          onClick={() => setShowSettings(true)}
          title="Click to change models"
        >
          <div className="model-indicator-multi">
            <div className="model-row">
              <span className="model-row-label">⚙️ Plan:</span>
              <span className="model-row-value">{llmConfig.planningModel || llmConfig.model || 'Not set'}</span>
            </div>
            <div className="model-row">
              <span className="model-row-label">👁 Vision:</span>
              <span className="model-row-value">{llmConfig.visionModel || llmConfig.model || 'Not set'}</span>
            </div>
          </div>
          <span className="model-edit">⚙️</span>
        </button>
      </div>
      
      {showSettings && (
        <SettingsModal
          config={llmConfig}
          onSave={(config) => {
            updateLLMConfig(config);
            const llmService = getLLMService();
            llmService.updateConfig(config);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
