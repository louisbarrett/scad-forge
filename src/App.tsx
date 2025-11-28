import { useEffect, useCallback, useState, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { CodeEditor } from './components/CodeEditor';
import { Viewer } from './components/Viewer';
import { MutationPanel } from './components/MutationPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { ChatPanel } from './components/ChatPanel';
import { useForgeStore, THEME_PRESETS, applyTheme, selectCanUndo, selectCanRedo } from './store/forgeStore';
import { getEngine, WASMOpenSCADEngine } from './engine/openscad';
import { getLLMService, extractCodeFromResponse } from './services/llm';
import type { ThemePreset } from './types';
import './App.css';

// Maximum auto-fix attempts to prevent infinite loops
const MAX_AUTO_FIX_ATTEMPTS = 3;

type RightPanel = 'chat' | 'mutations' | 'history';

// System Console Component
function SystemConsole() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { systemMessages, clearSystemMessages } = useForgeStore();
  
  const errorCount = systemMessages.filter(m => m.type === 'error').length;
  const warningCount = systemMessages.filter(m => m.type === 'warning').length;
  
  if (systemMessages.length === 0) {
    return (
      <div className="system-console-indicator clean">
        <span className="console-icon">✓</span>
        <span>No issues</span>
      </div>
    );
  }
  
  return (
    <div className={`system-console ${isExpanded ? 'expanded' : ''}`}>
      <button 
        className="system-console-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="console-counts">
          {errorCount > 0 && <span className="error-count">❌ {errorCount}</span>}
          {warningCount > 0 && <span className="warning-count">⚠️ {warningCount}</span>}
          {errorCount === 0 && warningCount === 0 && <span className="info-count">ℹ️ {systemMessages.length}</span>}
        </span>
        <span className="console-label">Console</span>
        <span className="console-expand">{isExpanded ? '▼' : '▲'}</span>
      </button>
      
      {isExpanded && (
        <div className="system-console-content">
          <div className="console-header">
            <span>System Messages ({systemMessages.length})</span>
            <button onClick={clearSystemMessages} className="clear-console-btn" title="Clear console">
              🗑️ Clear
            </button>
          </div>
          <div className="console-messages">
            {systemMessages.slice(-20).reverse().map((msg) => (
              <div key={msg.id} className={`console-message ${msg.type}`}>
                <span className="message-icon">
                  {msg.type === 'error' ? '❌' : msg.type === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
                <span className="message-content">{msg.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Storage key for panel sizes
const PANEL_SIZES_KEY = 'scad-forge-panel-sizes';
const EDITOR_COLLAPSED_KEY = 'scad-forge-editor-collapsed';

interface PanelSizes {
  editorWidth: number;  // Left-anchored - absolute width
  sideWidth: number;    // Right-anchored - absolute width
  // viewerWidth is calculated as the remaining space
}

const DEFAULT_PANEL_SIZES: PanelSizes = {
  editorWidth: 30,
  sideWidth: 30,
};

function loadPanelSizes(): PanelSizes {
  try {
    const stored = localStorage.getItem(PANEL_SIZES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate old format if needed
      if ('viewerWidth' in parsed) {
        return {
          editorWidth: parsed.editorWidth || DEFAULT_PANEL_SIZES.editorWidth,
          sideWidth: parsed.sideWidth || DEFAULT_PANEL_SIZES.sideWidth,
        };
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load panel sizes:', e);
  }
  return DEFAULT_PANEL_SIZES;
}

function savePanelSizes(sizes: PanelSizes): void {
  try {
    localStorage.setItem(PANEL_SIZES_KEY, JSON.stringify(sizes));
  } catch (e) {
    console.warn('Failed to save panel sizes:', e);
  }
}

function loadEditorCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(EDITOR_COLLAPSED_KEY);
    return stored === 'true';
  } catch (e) {
    console.warn('Failed to load editor collapsed state:', e);
  }
  return false;
}

function saveEditorCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(EDITOR_COLLAPSED_KEY, String(collapsed));
  } catch (e) {
    console.warn('Failed to save editor collapsed state:', e);
  }
}

function App() {
  const [rightPanel, setRightPanel] = useState<RightPanel>('chat');
  const [engineReady, setEngineReady] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  
  // Resizable panel state - editor anchors left, side-pane anchors right
  const [panelSizes, setPanelSizes] = useState<PanelSizes>(loadPanelSizes);
  const [isDragging, setIsDragging] = useState<'left' | 'right' | null>(null);
  const [editorCollapsed, setEditorCollapsed] = useState<boolean>(loadEditorCollapsed);
  const mainRef = useRef<HTMLDivElement>(null);
  
  // Capture trigger ref - allows ChatPanel to trigger captures
  const triggerCaptureRef = useRef<(() => Promise<string | null>) | null>(null);
  
  const {
    code,
    themeConfig,
    historyIndex,
    engineStatus,
    autoFixEnabled,
    autoFixAttempts,
    isAutoFixing,
    setTheme,
    setRenderResult,
    setEngineStatus,
    addCapture,
    pushPatch,
    undo,
    redo,
    setCode,
    startAutoFix,
    endAutoFix,
    resetAutoFixAttempts,
    addChatMessage,
    addSystemMessage,
  } = useForgeStore();
  
  const canUndo = useForgeStore(selectCanUndo);
  const canRedo = useForgeStore(selectCanRedo);
  
  // Initialize theme on mount
  useEffect(() => {
    applyTheme(themeConfig.preset);
  }, [themeConfig.preset]);
  
  // Initialize engine
  useEffect(() => {
    const init = async () => {
      setEngineStatus({ ready: false, compiling: false });
      const engine = await getEngine();
      
      // Wire up system message callback
      if (engine instanceof WASMOpenSCADEngine) {
        engine.setSystemMessageCallback((type, content) => {
          addSystemMessage(type, content, 'openscad');
        });
      }
      
      setEngineReady(engine.isReady());
      setEngineStatus({ ready: true });
      
      // Initial compile
      handleCompile();
    };
    
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run once on mount
  
  // Cancel compile handler
  const handleCancelCompile = useCallback(async () => {
    const engine = await getEngine();
    engine.cancel();
    setIsCompiling(false);
    setEngineStatus({ compiling: false });
  }, [setEngineStatus]);
  
  // Auto-fix handler - attempts to fix broken code using LLM
  const handleAutoFix = useCallback(async (errorMessage: string) => {
    const state = useForgeStore.getState();
    
    // Check if auto-fix is enabled and we haven't exceeded max attempts
    if (!state.autoFixEnabled || state.autoFixAttempts >= MAX_AUTO_FIX_ATTEMPTS) {
      console.log('Auto-fix skipped:', state.autoFixEnabled ? 'max attempts reached' : 'disabled');
      return false;
    }
    
    startAutoFix();
    
    // Add a system message to chat showing auto-fix is in progress
    addChatMessage({
      role: 'system',
      content: `🔧 Auto-fix attempt ${state.autoFixAttempts + 1}/${MAX_AUTO_FIX_ATTEMPTS}: Analyzing error...\n\n\`${errorMessage}\``,
    });
    
    try {
      const llmService = getLLMService();
      llmService.updateConfig(state.llmConfig);
      
      // Stream the fix attempt
      let fullResponse = '';
      for await (const chunk of llmService.streamAttemptFix(state.code, errorMessage)) {
        fullResponse += chunk;
      }
      
      // Extract the fixed code
      const fixedCode = extractCodeFromResponse(fullResponse);
      
      if (fixedCode && fixedCode !== state.code) {
        // Apply the fix
        setCode(fixedCode);
        pushPatch(`Auto-fix: ${errorMessage.slice(0, 50)}...`, fixedCode, 'llm');
        
        // Add success message to chat
        addChatMessage({
          role: 'assistant',
          content: `✅ Applied auto-fix for: \`${errorMessage.slice(0, 100)}\`\n\nRecompiling...`,
        });
        
        endAutoFix(true);
        return true;
      } else {
        // No valid fix found
        addChatMessage({
          role: 'assistant',
          content: `⚠️ Could not extract a valid fix from LLM response. Manual intervention may be needed.`,
        });
        endAutoFix(false, 'No valid fix extracted');
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('Auto-fix failed:', errorMsg);
      
      addChatMessage({
        role: 'assistant',
        content: `❌ Auto-fix failed: ${errorMsg}`,
      });
      
      endAutoFix(false, errorMsg);
      return false;
    }
  }, [startAutoFix, endAutoFix, setCode, pushPatch, addChatMessage]);
  
  // Compile handler
  const handleCompile = useCallback(async (skipAutoFix = false) => {
    const engine = await getEngine();
    // Always get fresh code from store to avoid stale closure issues
    const currentCode = useForgeStore.getState().code;
    
    setIsCompiling(true);
    setEngineStatus({ compiling: true });
    
    try {
      const result = await engine.compile(currentCode);
      
      // Don't update if compilation was cancelled/superseded
      if (result.error === 'Compilation cancelled' || result.error === 'Compilation superseded') {
        return;
      }
      
      setRenderResult(result);
      
      // If compilation succeeded, reset auto-fix attempts
      if (result.success) {
        resetAutoFixAttempts();
      } else if (!skipAutoFix && result.error) {
        // Compilation failed - attempt auto-fix
        const state = useForgeStore.getState();
        if (state.autoFixEnabled && state.autoFixAttempts < MAX_AUTO_FIX_ATTEMPTS && !state.isAutoFixing) {
          setIsCompiling(false);
          setEngineStatus({ compiling: false });
          
          // Attempt auto-fix
          const fixed = await handleAutoFix(result.error);
          if (fixed) {
            // Recompile with the fixed code (skip auto-fix to prevent loop on same error)
            setTimeout(() => handleCompile(true), 100);
          }
          return;
        }
      }
    } catch (error) {
      // Ignore cancellation errors
      const errorMsg = error instanceof Error ? error.message : 'Compilation failed';
      if (errorMsg === 'Compilation superseded' || errorMsg === 'Compilation cancelled') {
        return;
      }
      
      setRenderResult({
        success: false,
        error: errorMsg,
      });
    } finally {
      setIsCompiling(false);
      setEngineStatus({ compiling: false });
    }
  }, [setRenderResult, setEngineStatus, resetAutoFixAttempts, handleAutoFix]);
  
  // Capture handler - just saves to store, no panel switching
  const handleCapture = useCallback(
    (
      imageDataUrl: string,
      cameraPosition: [number, number, number],
      cameraTarget: [number, number, number]
    ) => {
      addCapture({
        imageDataUrl,
        code,
        cameraPosition,
        cameraTarget,
      });
    },
    [code, addCapture]
  );
  
  // Theme change handler
  const handleThemeChange = useCallback((preset: ThemePreset) => {
    setTheme(preset);
  }, [setTheme]);
  
  // Track if we've mounted to avoid initial recompile
  const hasMounted = useRef(false);
  const prevHistoryIndex = useRef(historyIndex);
  
  // Auto-recompile when navigating history (undo/redo)
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      prevHistoryIndex.current = historyIndex;
      return;
    }
    
    // Only recompile if historyIndex changed (undo/redo action)
    if (prevHistoryIndex.current !== historyIndex && engineReady) {
      prevHistoryIndex.current = historyIndex;
      handleCompile();
    }
  }, [historyIndex, engineReady, handleCompile]);
  
  // Undo handler
  const handleUndo = useCallback(() => {
    if (canUndo) {
      undo();
    }
  }, [canUndo, undo]);
  
  // Redo handler
  const handleRedo = useCallback(() => {
    if (canRedo) {
      redo();
    }
  }, [canRedo, redo]);
  
  // Export STL handler
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExportSTL = useCallback(async () => {
    const engine = await getEngine();
    const currentCode = useForgeStore.getState().code;
    
    setIsExporting(true);
    addSystemMessage('info', 'Starting STL export...', 'export');
    
    try {
      const result = await engine.exportSTL(currentCode);
      
      if (!result.success || !result.data) {
        addSystemMessage('error', `STL export failed: ${result.error || 'Unknown error'}`, 'export');
        return;
      }
      
      // Create blob and download - copy to a new Uint8Array with its own ArrayBuffer for blob compatibility
      const stlData = new Uint8Array(result.data);
      const blob = new Blob([stlData], { type: 'application/sla' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `scad-forge-export-${Date.now()}.stl`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      addSystemMessage('info', 'STL exported successfully!', 'export');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addSystemMessage('error', `STL export error: ${errorMsg}`, 'export');
    } finally {
      setIsExporting(false);
    }
  }, [addSystemMessage]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleCompile();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
      
      // Escape to cancel compile
      if (e.key === 'Escape' && isCompiling) {
        handleCancelCompile();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCompile, handleUndo, handleRedo, handleCancelCompile, isCompiling]);
  
  // Panel resize handlers - editor anchors left, side-pane anchors right
  const handleResizeStart = useCallback((handle: 'left' | 'right') => (e: ReactMouseEvent) => {
    e.preventDefault();
    setIsDragging(handle);
  }, []);
  
  const handleResizeMove = useCallback((e: globalThis.MouseEvent) => {
    if (!isDragging || !mainRef.current) return;
    
    const mainRect = mainRef.current.getBoundingClientRect();
    const totalWidth = mainRect.width;
    const mouseX = e.clientX - mainRect.left;
    const mousePercent = (mouseX / totalWidth) * 100;
    
    setPanelSizes(prev => {
      if (isDragging === 'left') {
        // Dragging the left handle - adjusts editor width (anchored left)
        const editorWidth = Math.max(15, Math.min(50, mousePercent));
        return { ...prev, editorWidth };
      } else if (isDragging === 'right') {
        // Dragging the right handle - adjusts side panel width (anchored right)
        const sideWidth = Math.max(15, Math.min(50, 100 - mousePercent));
        return { ...prev, sideWidth };
      }
      return prev;
    });
  }, [isDragging]);
  
  const handleResizeEnd = useCallback(() => {
    if (isDragging) {
      savePanelSizes(panelSizes);
      setIsDragging(null);
    }
  }, [isDragging, panelSizes]);
  
  // Global mouse event listeners for resizing
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleResizeMove, handleResizeEnd]);
  
  // Double-click to reset panel sizes
  const handleDoubleClick = useCallback(() => {
    setPanelSizes(DEFAULT_PANEL_SIZES);
    savePanelSizes(DEFAULT_PANEL_SIZES);
  }, []);
  
  // Toggle editor collapsed state
  const toggleEditorCollapsed = useCallback(() => {
    setEditorCollapsed(prev => {
      const newState = !prev;
      saveEditorCollapsed(newState);
      return newState;
    });
  }, []);
  
  
  return (
    <div className="app">
      {/* Ambient Background Effects */}
      <div className="ambient-bg">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>
      
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">SCAD Forge</span>
          <span className="logo-tag">AI-Powered OpenSCAD IDE</span>
        </div>
        
        <div className="header-status">
          {isAutoFixing ? (
            <span className="status auto-fixing">
              <span className="compile-spinner"></span>
              🔧 Auto-fixing... ({autoFixAttempts}/{MAX_AUTO_FIX_ATTEMPTS})
            </span>
          ) : engineStatus.compiling ? (
            <button 
              className="status compiling" 
              onClick={handleCancelCompile}
              title="Click to cancel (or press Escape)"
            >
              <span className="compile-spinner"></span>
              Compiling... 
              <span className="cancel-hint">✕</span>
            </button>
          ) : engineReady ? (
            <span className="status ready">Engine Ready</span>
          ) : (
            <span className="status loading">Loading Engine...</span>
          )}
        </div>
        
        <nav className="header-nav">
          {/* Theme Selector */}
          <div className="theme-selector">
            <span>🎨</span>
            <select 
              value={themeConfig.preset} 
              onChange={(e) => handleThemeChange(e.target.value as ThemePreset)}
            >
              {Object.entries(THEME_PRESETS).map(([key, theme]) => (
                <option key={key} value={key}>{theme.name}</option>
              ))}
            </select>
          </div>
          
          {/* Undo/Redo Buttons */}
          <div className="undo-redo-group">
            <button
              className={`nav-btn undo-btn ${!canUndo ? 'disabled' : ''}`}
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              ↶ Undo
            </button>
            <button
              className={`nav-btn redo-btn ${!canRedo ? 'disabled' : ''}`}
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
            >
              ↷ Redo
            </button>
          </div>
          
          {/* Auto-Fix Toggle */}
          <button
            className={`nav-btn auto-fix-btn ${autoFixEnabled ? 'active' : ''}`}
            onClick={() => useForgeStore.getState().setAutoFixEnabled(!autoFixEnabled)}
            title={`Auto-fix ${autoFixEnabled ? 'enabled' : 'disabled'} (${autoFixAttempts}/${MAX_AUTO_FIX_ATTEMPTS} attempts)`}
          >
            🔧 {autoFixEnabled ? 'Auto-Fix On' : 'Auto-Fix Off'}
          </button>
          
          <button
            className="nav-btn new-btn"
            onClick={() => {
              if (confirm('Start a new design? Your current work will be saved to history.')) {
                useForgeStore.getState().newDesign();
                handleCompile();
              }
            }}
          >
            ✨ New
          </button>
          <button
            className="nav-btn"
            onClick={() => pushPatch('Manual save', code, 'user')}
          >
            💾 Save
          </button>
          <button 
            className="nav-btn" 
            onClick={handleExportSTL}
            disabled={isExporting || !engineReady}
            title={isExporting ? 'Exporting...' : 'Export as STL file'}
          >
            {isExporting ? '⏳ Exporting...' : '📤 Export STL'}
          </button>
        </nav>
      </header>
      
      <main className="app-main" ref={mainRef}>
        {/* Resize overlay when dragging */}
        {isDragging && <div className="resize-overlay" />}
        
        {/* Collapsed Editor Toggle */}
        {editorCollapsed && (
          <button 
            className="editor-expand-btn"
            onClick={toggleEditorCollapsed}
            title="Expand editor (click to show)"
          >
            <span className="expand-icon">⟩</span>
            <span className="expand-label">Code</span>
          </button>
        )}
        
        {/* Editor - anchored left */}
        <div 
          className={`editor-pane ${editorCollapsed ? 'collapsed' : ''}`}
          style={{ 
            width: editorCollapsed ? '0%' : `${panelSizes.editorWidth}%`, 
            flexShrink: 0,
            overflow: editorCollapsed ? 'hidden' : undefined,
          }}
        >
          <div className="editor-collapse-toggle">
            <button 
              className="collapse-btn"
              onClick={toggleEditorCollapsed}
              title="Collapse editor"
            >
              <span className="collapse-icon">⟨</span>
            </button>
          </div>
          <CodeEditor onCompile={handleCompile} />
        </div>
        
        {/* Left resize handle - hidden when collapsed */}
        {!editorCollapsed && (
          <div 
            className={`resize-handle resize-handle-h ${isDragging === 'left' ? 'dragging' : ''}`}
            onMouseDown={handleResizeStart('left')}
            onDoubleClick={handleDoubleClick}
            title="Drag to resize • Double-click to reset"
          />
        )}
        
        {/* Viewer - flexible center, takes remaining space */}
        <div 
          className="viewer-pane"
          style={{ 
            flex: 1,
            minWidth: 0, // Allow flex item to shrink below content size
          }}
        >
          <Viewer 
            onCapture={handleCapture} 
            captureRef={triggerCaptureRef}
            onCompile={handleCompile}
            onCancelCompile={handleCancelCompile}
          />
        </div>
        
        {/* Right resize handle */}
        <div 
          className={`resize-handle resize-handle-h ${isDragging === 'right' ? 'dragging' : ''}`}
          onMouseDown={handleResizeStart('right')}
          onDoubleClick={handleDoubleClick}
          title="Drag to resize • Double-click to reset"
        />
        
        {/* Side Panel - anchored right */}
        <div 
          className="side-pane"
          style={{ width: `${panelSizes.sideWidth}%`, flexShrink: 0 }}
        >
          <div className="panel-tabs">
            <button
              className={`panel-tab ${rightPanel === 'chat' ? 'active' : ''}`}
              onClick={() => setRightPanel('chat')}
            >
              💬 Chat
            </button>
            <button
              className={`panel-tab ${rightPanel === 'mutations' ? 'active' : ''}`}
              onClick={() => setRightPanel('mutations')}
            >
              ⚡ Mutations
            </button>
            <button
              className={`panel-tab ${rightPanel === 'history' ? 'active' : ''}`}
              onClick={() => setRightPanel('history')}
            >
              ⟲ History
            </button>
          </div>
          
          <div className="panel-content">
            {rightPanel === 'chat' && (
              <ChatPanel 
                onCompile={handleCompile} 
                onCancelCompile={handleCancelCompile}
                isCompiling={engineStatus.compiling}
                triggerCapture={() => triggerCaptureRef.current?.() ?? Promise.resolve(null)}
              />
            )}
            {rightPanel === 'mutations' && <MutationPanel />}
            {rightPanel === 'history' && <HistoryPanel />}
          </div>
        </div>
      </main>
      
      <footer className="app-footer">
        <div className="footer-left">
          <span className="keybind">Ctrl+Enter</span> Compile
          <span className="keybind">Ctrl+Z</span> Undo
          <span className="keybind">Ctrl+Y</span> Redo
          <span className="keybind">Esc</span> Cancel
        </div>
        <div className="footer-center">
          <SystemConsole />
        </div>
        <div className="footer-right">
          AZAI Fabrication Profile • 220³mm Print • 400²mm Laser
        </div>
      </footer>
    </div>
  );
}

export default App;
