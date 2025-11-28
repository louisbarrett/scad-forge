import { useState, useRef, useEffect, useCallback } from 'react';
import { useForgeStore } from '../store/forgeStore';
import { getLLMService, extractCodeFromResponse } from '../services/llm';
import type { ChatMessage, LLMConfig } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
  onApplyCode?: (code: string) => void;
  onProposeMutation?: (code: string) => void;
}

function MessageBubble({ message, onApplyCode, onProposeMutation }: MessageBubbleProps) {
  const extractedCode = message.role === 'assistant' ? extractCodeFromResponse(message.content) : null;
  
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
          return (
            <div key={i} className="message-code-block">
              <div className="code-header">
                <span className="code-lang">{lang || 'code'}</span>
                {onApplyCode && lang === 'openscad' && (
                  <button
                    className="apply-code-btn"
                    onClick={() => onApplyCode(code.trim())}
                  >
                    ⚡ Apply Changes
                  </button>
                )}
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
    <div className={`message-bubble ${message.role}`}>
      <div className="message-header">
        <span className="message-role">
          {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
        </span>
        <span className="message-time">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      
      <div className="message-content">
        {message.status === 'pending' ? (
          <div className="message-loading">
            <span className="loading-dot">●</span>
            <span className="loading-dot">●</span>
            <span className="loading-dot">●</span>
          </div>
        ) : message.status === 'error' ? (
          <div className="message-error">
            ❌ {message.error || 'An error occurred'}
          </div>
        ) : (
          formatContent(message.content)
        )}
      </div>
      
      {message.attachedImage && (
        <div className="message-attachment">
          <img src={message.attachedImage} alt="Attached scene" />
        </div>
      )}
      
      {extractedCode && message.status === 'complete' && (
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

function SettingsModal({ config, onSave, onClose }: SettingsModalProps) {
  const [localConfig, setLocalConfig] = useState(config);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  
  // Fetch models when baseUrl changes
  const fetchModels = useCallback(async (baseUrl: string, apiKey?: string) => {
    setModelsLoading(true);
    setModelsError(null);
    setAvailableModels([]);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      const response = await fetch(`${baseUrl}/models`, { headers });
      
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
      setModelsError(msg);
    } finally {
      setModelsLoading(false);
    }
  }, []);
  
  // Fetch models on mount
  useEffect(() => {
    fetchModels(localConfig.baseUrl, localConfig.apiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - URL changes trigger fetchModels via onBlur
  
  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };
  
  const handleRefreshModels = () => {
    fetchModels(localConfig.baseUrl, localConfig.apiKey);
  };
  
  const handleUrlChange = (newUrl: string) => {
    setLocalConfig({ ...localConfig, baseUrl: newUrl });
  };
  
  const handleUrlBlur = () => {
    fetchModels(localConfig.baseUrl, localConfig.apiKey);
  };
  
  const presets = [
    { name: 'Ollama', baseUrl: 'http://localhost:11434/v1', model: '' },
    { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
    { name: 'Together', baseUrl: 'https://api.together.xyz/v1', model: '' },
    { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: '' },
  ];
  
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
              {presets.map((preset) => (
                <button
                  key={preset.name}
                  className={`preset-btn ${localConfig.baseUrl === preset.baseUrl ? 'active' : ''}`}
                  onClick={() => {
                    setLocalConfig({ ...localConfig, baseUrl: preset.baseUrl, model: preset.model || localConfig.model });
                    fetchModels(preset.baseUrl, localConfig.apiKey);
                  }}
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
          
          <div className="settings-field">
            <label>API Key {localConfig.baseUrl.includes('localhost') && <span className="label-hint">(optional for local)</span>}</label>
            <input
              type="password"
              value={localConfig.apiKey || ''}
              onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value || undefined })}
              onBlur={handleUrlBlur}
              placeholder="sk-..."
            />
          </div>
          
          <div className="settings-field model-field">
            <div className="label-row">
              <label>Model</label>
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
            ) : null}
            
            {availableModels.length > 0 ? (
              <div className="model-selector">
                <select
                  value={localConfig.model}
                  onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                >
                  {!availableModels.find(m => m.id === localConfig.model) && localConfig.model && (
                    <option value={localConfig.model}>{localConfig.model}</option>
                  )}
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} {model.owned_by ? `(${model.owned_by})` : ''}
                    </option>
                  ))}
                </select>
                <span className="model-count">{availableModels.length} models available</span>
              </div>
            ) : (
              <input
                type="text"
                value={localConfig.model}
                onChange={(e) => setLocalConfig({ ...localConfig, model: e.target.value })}
                placeholder={modelsLoading ? 'Loading models...' : 'Enter model name'}
              />
            )}
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
                <span className="toggle-label">Auto-Apply Code</span>
                <span className="toggle-hint">Apply LLM code changes automatically</span>
              </label>
              
              <label className={`toggle-option ${localConfig.autoRender ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={localConfig.autoRender ?? true}
                  onChange={(e) => setLocalConfig({ ...localConfig, autoRender: e.target.checked })}
                />
                <span className="toggle-icon">▶</span>
                <span className="toggle-label">Auto-Render</span>
                <span className="toggle-hint">Render after applying changes</span>
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
}

export function ChatPanel({ onCompile }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [includeCode, setIncludeCode] = useState(true);
  const [includeImage, setIncludeImage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    code,
    captures,
    chatMessages,
    llmConfig,
    isChatStreaming,
    addChatMessage,
    updateChatMessage,
    appendToChatMessage,
    clearChat,
    setChatStreaming,
    updateLLMConfig,
    addMutation,
  } = useForgeStore();
  
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
  
  const handleSend = useCallback(async () => {
    if (!input.trim() || isChatStreaming) return;
    
    const userMessage = {
      role: 'user' as const,
      content: input.trim(),
      attachedCode: includeCode ? code : undefined,
      attachedImage: includeImage && latestCapture ? latestCapture.imageDataUrl : undefined,
    };
    
    addChatMessage(userMessage);
    setInput('');
    
    // Create placeholder for assistant response
    const assistantMsgId = addChatMessage({
      role: 'assistant',
      content: '',
      status: 'pending',
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
        includeImage && latestCapture ? latestCapture.imageDataUrl : undefined
      )) {
        appendToChatMessage(assistantMsgId, chunk);
      }
      
      updateChatMessage(assistantMsgId, { status: 'complete' });
      
      // Auto-apply if enabled
      if (llmConfig.autoApply) {
        const finalMessage = useForgeStore.getState().chatMessages.find(m => m.id === assistantMsgId);
        if (finalMessage) {
          const extractedCode = extractCodeFromResponse(finalMessage.content);
          if (extractedCode) {
            // Apply the code
            useForgeStore.getState().setCode(extractedCode);
            useForgeStore.getState().pushPatch('LLM Chat: Auto-applied code', extractedCode, 'llm');
            
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
  }, [input, includeCode, includeImage, code, latestCapture, llmConfig, isChatStreaming, addChatMessage, updateChatMessage, appendToChatMessage, setChatStreaming, onCompile]);
  
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
            <span className="option-icon">📝</span> Include Code
          </label>
          <label className={`option-toggle ${includeImage ? 'active' : ''} ${!latestCapture ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              checked={includeImage}
              onChange={(e) => setIncludeImage(e.target.checked)}
              disabled={!latestCapture}
            />
            <span className="option-icon">📷</span> Include Image
            {!latestCapture && <span className="option-hint">(capture first)</span>}
          </label>
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
          title="Click to change model"
        >
          <span className="model-icon">🤖</span>
          <span className="model-name">{llmConfig.model || 'No model selected'}</span>
          <span className="model-url">{new URL(llmConfig.baseUrl).host}</span>
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

