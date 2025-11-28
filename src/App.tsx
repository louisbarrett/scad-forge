import { useEffect, useCallback, useState } from 'react';
import { CodeEditor } from './components/CodeEditor';
import { Viewer } from './components/Viewer';
import { MutationPanel } from './components/MutationPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { VLMPanel } from './components/VLMPanel';
import { ChatPanel } from './components/ChatPanel';
import { useForgeStore, THEME_PRESETS, applyTheme } from './store/forgeStore';
import { getEngine } from './engine/openscad';
import type { SceneCapture, ThemePreset } from './types';
import './App.css';

type RightPanel = 'chat' | 'mutations' | 'history' | 'vlm';

function App() {
  const [rightPanel, setRightPanel] = useState<RightPanel>('chat');
  const [engineReady, setEngineReady] = useState(false);
  
  const {
    code,
    themeConfig,
    setTheme,
    setRenderResult,
    setEngineStatus,
    addCapture,
    pushPatch,
  } = useForgeStore();
  
  // Initialize theme on mount
  useEffect(() => {
    applyTheme(themeConfig.preset);
  }, [themeConfig.preset]);
  
  // Initialize engine
  useEffect(() => {
    const init = async () => {
      setEngineStatus({ ready: false, compiling: false });
      const engine = await getEngine();
      setEngineReady(engine.isReady());
      setEngineStatus({ ready: true });
      
      // Initial compile
      handleCompile();
    };
    
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run once on mount
  
  // Compile handler
  const handleCompile = useCallback(async () => {
    const engine = await getEngine();
    // Always get fresh code from store to avoid stale closure issues
    const currentCode = useForgeStore.getState().code;
    
    setEngineStatus({ compiling: true });
    
    try {
      const result = await engine.compile(currentCode);
      
      // Don't update if compilation was cancelled/superseded
      if (result.error === 'Compilation cancelled' || result.error === 'Compilation superseded') {
        return;
      }
      
      setRenderResult(result);
    } catch (error) {
      // Ignore cancellation errors
      const errorMsg = error instanceof Error ? error.message : 'Compilation failed';
      if (errorMsg === 'Compilation superseded') {
        return;
      }
      
      setRenderResult({
        success: false,
        error: errorMsg,
      });
    } finally {
      setEngineStatus({ compiling: false });
    }
  }, [setRenderResult, setEngineStatus]);
  
  // Capture handler
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
      
      // Switch to VLM panel
      setRightPanel('vlm');
    },
    [code, addCapture]
  );
  
  // VLM mutation request handler
  const handleVLMRequest = useCallback(
    (prompt: string, capture: SceneCapture) => {
      // This is now handled by VLMPanel directly with the dual-model pipeline
      // Just switch to mutations panel to see the result
      console.debug('VLM request:', prompt.slice(0, 50), 'for capture at', capture.timestamp);
      setTimeout(() => {
        setRightPanel('mutations');
      }, 500);
    },
    []
  );
  
  // Theme change handler
  const handleThemeChange = useCallback((preset: ThemePreset) => {
    setTheme(preset);
  }, [setTheme]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleCompile();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useForgeStore.getState().undo();
      }
      
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        useForgeStore.getState().redo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCompile]);
  
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
          <span className="logo-tag">VLM-Powered OpenSCAD IDE</span>
        </div>
        
        <div className="header-status">
          {engineReady ? (
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
          <button className="nav-btn" onClick={() => {}}>
            📤 Export STL
          </button>
        </nav>
      </header>
      
      <main className="app-main">
        <div className="editor-pane">
          <CodeEditor onCompile={handleCompile} />
        </div>
        
        <div className="viewer-pane">
          <Viewer onCapture={handleCapture} />
        </div>
        
        <div className="side-pane">
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
            <button
              className={`panel-tab ${rightPanel === 'vlm' ? 'active' : ''}`}
              onClick={() => setRightPanel('vlm')}
            >
              👁 Vision
            </button>
          </div>
          
          <div className="panel-content">
            {rightPanel === 'chat' && <ChatPanel onCompile={handleCompile} />}
            {rightPanel === 'mutations' && <MutationPanel />}
            {rightPanel === 'history' && <HistoryPanel />}
            {rightPanel === 'vlm' && <VLMPanel onRequestMutation={handleVLMRequest} />}
          </div>
        </div>
      </main>
      
      <footer className="app-footer">
        <div className="footer-left">
          <span className="keybind">Ctrl+Enter</span> Compile
          <span className="keybind">Ctrl+Z</span> Undo
          <span className="keybind">Ctrl+Y</span> Redo
        </div>
        <div className="footer-right">
          AZAI Fabrication Profile • 220³mm Print • 400²mm Laser
        </div>
      </footer>
    </div>
  );
}

export default App;
