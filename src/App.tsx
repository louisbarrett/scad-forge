import { useEffect, useCallback, useState } from 'react';
import { CodeEditor } from './components/CodeEditor';
import { Viewer } from './components/Viewer';
import { MutationPanel } from './components/MutationPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { VLMPanel } from './components/VLMPanel';
import { ChatPanel } from './components/ChatPanel';
import { useForgeStore } from './store/forgeStore';
import { getEngine } from './engine/openscad';
import type { SceneCapture } from './types';
import './App.css';

type RightPanel = 'chat' | 'mutations' | 'history' | 'vlm';

function App() {
  const [rightPanel, setRightPanel] = useState<RightPanel>('chat');
  const [engineReady, setEngineReady] = useState(false);
  
  const {
    code,
    setRenderResult,
    setEngineStatus,
    addCapture,
    addMutation,
    pushPatch,
  } = useForgeStore();
  
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
    setRenderResult(null);
    
    try {
      const result = await engine.compile(currentCode);
      setRenderResult(result);
    } catch (error) {
      setRenderResult({
        success: false,
        error: error instanceof Error ? error.message : 'Compilation failed',
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
      // Simulate VLM response for demo
      // In production, this would call the Anthropic API
      
      setTimeout(() => {
        // Parse prompt for intent and generate mock response
        let description = 'VLM suggested modification';
        let newCode = capture.code;
        let reasoning = '';
        
        if (prompt.toLowerCase().includes('fillet') || prompt.toLowerCase().includes('round')) {
          description = 'Add rounded edges with minkowski';
          newCode = capture.code.replace(
            /corner_radius\s*=\s*\d+/,
            'corner_radius = 5'
          );
          reasoning = 'Increased corner radius for smoother edges that are easier to print and more comfortable to handle.';
        } else if (prompt.toLowerCase().includes('mount') || prompt.toLowerCase().includes('screw')) {
          description = 'Add additional mounting features';
          newCode = capture.code + `

// Additional mounting tabs
module mounting_tab() {
    difference() {
        cube([15, 10, 3]);
        translate([7.5, 5, -0.1])
            cylinder(h=4, d=m3_clearance, $fn=32);
    }
}

// Add tabs to sides
translate([size/2, 0, -size/2])
    rotate([0, 0, 0])
    mounting_tab();
`;
          reasoning = 'Added mounting tabs with M3 clearance holes for secure attachment to surfaces.';
        } else if (prompt.toLowerCase().includes('compact') || prompt.toLowerCase().includes('small')) {
          description = 'Reduce overall size';
          newCode = capture.code.replace(/size\s*=\s*\d+/, 'size = 20');
          reasoning = 'Reduced size parameter to create a more compact design while maintaining proportions.';
        } else {
          description = `Apply: ${prompt.slice(0, 50)}`;
          reasoning = 'Generic modification based on your request.';
        }
        
        addMutation({
          description,
          proposedCode: newCode,
          reasoning,
          confidence: 0.75 + Math.random() * 0.2,
        });
        
        // Switch to mutations panel
        setRightPanel('mutations');
      }, 1500);
    },
    [addMutation]
  );
  
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
              📷 Capture
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
