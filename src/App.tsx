import { useEffect, useCallback, useState, useRef, MouseEvent as ReactMouseEvent } from 'react';
import { CodeEditor } from './components/CodeEditor';
import { Viewer } from './components/Viewer';
import { MutationPanel } from './components/MutationPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { VLMPanel } from './components/VLMPanel';
import { ChatPanel } from './components/ChatPanel';
import { useForgeStore, THEME_PRESETS, applyTheme, selectCanUndo, selectCanRedo } from './store/forgeStore';
import { getEngine } from './engine/openscad';
import type { SceneCapture, ThemePreset } from './types';
import './App.css';

type RightPanel = 'chat' | 'mutations' | 'history' | 'vlm';

// Storage key for panel sizes
const PANEL_SIZES_KEY = 'scad-forge-panel-sizes';

interface PanelSizes {
  editorWidth: number;
  viewerWidth: number;
  sideWidth: number;
}

const DEFAULT_PANEL_SIZES: PanelSizes = {
  editorWidth: 33,
  viewerWidth: 34,
  sideWidth: 33,
};

function loadPanelSizes(): PanelSizes {
  try {
    const stored = localStorage.getItem(PANEL_SIZES_KEY);
    if (stored) {
      return JSON.parse(stored);
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

function App() {
  const [rightPanel, setRightPanel] = useState<RightPanel>('chat');
  const [engineReady, setEngineReady] = useState(false);
  
  // Resizable panel state
  const [panelSizes, setPanelSizes] = useState<PanelSizes>(loadPanelSizes);
  const [isDragging, setIsDragging] = useState<'left' | 'right' | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  
  const {
    code,
    themeConfig,
    historyIndex,
    setTheme,
    setRenderResult,
    setEngineStatus,
    addCapture,
    pushPatch,
    undo,
    redo,
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
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCompile, handleUndo, handleRedo]);
  
  // Panel resize handlers
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
      let newSizes = { ...prev };
      
      if (isDragging === 'left') {
        // Dragging the left handle (between editor and viewer)
        const editorWidth = Math.max(15, Math.min(50, mousePercent));
        const remaining = 100 - editorWidth;
        const viewerRatio = prev.viewerWidth / (prev.viewerWidth + prev.sideWidth);
        newSizes = {
          editorWidth,
          viewerWidth: remaining * viewerRatio,
          sideWidth: remaining * (1 - viewerRatio),
        };
      } else if (isDragging === 'right') {
        // Dragging the right handle (between viewer and side panel)
        const sideWidth = Math.max(15, Math.min(50, 100 - mousePercent));
        const remaining = 100 - sideWidth;
        const editorRatio = prev.editorWidth / (prev.editorWidth + prev.viewerWidth);
        newSizes = {
          editorWidth: remaining * editorRatio,
          viewerWidth: remaining * (1 - editorRatio),
          sideWidth,
        };
      }
      
      return newSizes;
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
      
      <main className="app-main" ref={mainRef}>
        {/* Resize overlay when dragging */}
        {isDragging && <div className="resize-overlay" />}
        
        <div 
          className="editor-pane" 
          style={{ width: `${panelSizes.editorWidth}%` }}
        >
          <CodeEditor onCompile={handleCompile} />
        </div>
        
        {/* Left resize handle */}
        <div 
          className={`resize-handle resize-handle-h ${isDragging === 'left' ? 'dragging' : ''}`}
          onMouseDown={handleResizeStart('left')}
          onDoubleClick={handleDoubleClick}
          title="Drag to resize • Double-click to reset"
        />
        
        <div 
          className="viewer-pane"
          style={{ width: `${panelSizes.viewerWidth}%` }}
        >
          <Viewer onCapture={handleCapture} />
        </div>
        
        {/* Right resize handle */}
        <div 
          className={`resize-handle resize-handle-h ${isDragging === 'right' ? 'dragging' : ''}`}
          onMouseDown={handleResizeStart('right')}
          onDoubleClick={handleDoubleClick}
          title="Drag to resize • Double-click to reset"
        />
        
        <div 
          className="side-pane"
          style={{ width: `${panelSizes.sideWidth}%` }}
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
