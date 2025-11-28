import { useState, useCallback } from 'react';
import { useForgeStore } from '../store/forgeStore';
import type { SceneCapture } from '../types';

interface CaptureCardProps {
  capture: SceneCapture;
  onDelete: () => void;
  onSendToVLM: () => void;
}

function CaptureCard({ capture, onDelete, onSendToVLM }: CaptureCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`capture-card ${expanded ? 'expanded' : ''}`}>
      <div className="capture-preview" onClick={() => setExpanded(!expanded)}>
        <img src={capture.imageDataUrl} alt="Scene capture" />
        <div className="capture-overlay">
          <span className="capture-time">
            {new Date(capture.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
      
      {expanded && (
        <div className="capture-details">
          <div className="capture-info">
            <div className="info-row">
              <span className="info-label">Camera:</span>
              <span className="info-value">
                [{capture.cameraPosition.map((n) => n.toFixed(1)).join(', ')}]
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Code:</span>
              <span className="info-value">{capture.code.length} chars</span>
            </div>
          </div>
          
          <div className="capture-code">
            <pre>{capture.code.slice(0, 200)}...</pre>
          </div>
        </div>
      )}
      
      <div className="capture-actions">
        <button className="action-btn send-btn" onClick={onSendToVLM}>
          📤 Send to VLM
        </button>
        <button className="action-btn delete-btn" onClick={onDelete}>
          🗑
        </button>
      </div>
    </div>
  );
}

interface VLMPanelProps {
  onRequestMutation: (prompt: string, capture: SceneCapture) => void;
}

export function VLMPanel({ onRequestMutation }: VLMPanelProps) {
  const { captures, clearCaptures } = useForgeStore();
  const [prompt, setPrompt] = useState('');
  const [selectedCapture, setSelectedCapture] = useState<SceneCapture | null>(null);
  
  const handleSendToVLM = useCallback((capture: SceneCapture) => {
    setSelectedCapture(capture);
  }, []);
  
  const handleSubmit = useCallback(() => {
    if (selectedCapture && prompt.trim()) {
      onRequestMutation(prompt, selectedCapture);
      setPrompt('');
      setSelectedCapture(null);
    }
  }, [selectedCapture, prompt, onRequestMutation]);
  
  const handleDeleteCapture = useCallback((timestamp: number) => {
    // Note: Would need to add this to store, for now just log
    console.log('Delete capture:', timestamp);
  }, []);
  
  // Generate VLM context payload
  const generatePayload = useCallback((capture: SceneCapture, userPrompt: string) => {
    return {
      system: `You are an expert OpenSCAD designer helping improve 3D printable designs. 
You receive: an image of the current 3D model and the OpenSCAD source code.
Respond with specific code modifications in a structured format.`,
      
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: capture.imageDataUrl.split(',')[1],
              },
            },
            {
              type: 'text',
              text: `Here is my OpenSCAD code:

\`\`\`openscad
${capture.code}
\`\`\`

${userPrompt}

Please provide your suggested code modification.`,
            },
          ],
        },
      ],
    };
  }, []);
  
  return (
    <div className="vlm-panel">
      <div className="panel-header">
        <span className="panel-title">
          <span className="panel-icon">👁</span>
          VLM Interface
          {captures.length > 0 && (
            <span className="capture-count">{captures.length}</span>
          )}
        </span>
        <div className="panel-actions">
          {captures.length > 0 && (
            <button
              className="action-btn clear-btn"
              onClick={clearCaptures}
              title="Clear captures"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      
      {selectedCapture ? (
        <div className="vlm-compose">
          <div className="compose-preview">
            <img src={selectedCapture.imageDataUrl} alt="Selected capture" />
            <button
              className="close-preview"
              onClick={() => setSelectedCapture(null)}
            >
              ✕
            </button>
          </div>
          
          <div className="compose-prompt">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What would you like the VLM to help with?

Examples:
• Add fillets to all sharp edges
• Make it more compact
• Add mounting holes for M3 screws
• Optimize for 3D printing"
              rows={4}
            />
          </div>
          
          <div className="compose-actions">
            <button
              className="action-btn cancel-btn"
              onClick={() => setSelectedCapture(null)}
            >
              Cancel
            </button>
            <button
              className="action-btn submit-btn"
              onClick={handleSubmit}
              disabled={!prompt.trim()}
            >
              🚀 Send to VLM
            </button>
          </div>
          
          <div className="payload-preview">
            <details>
              <summary>View API Payload</summary>
              <pre>
                {JSON.stringify(generatePayload(selectedCapture, prompt), null, 2).slice(0, 500)}...
              </pre>
            </details>
          </div>
        </div>
      ) : (
        <div className="capture-list">
          {captures.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📷</div>
              <div className="empty-text">No captures yet</div>
              <div className="empty-hint">
                Click the camera button in the viewer to capture the current scene.
                <br />
                Captures include both the image and code for VLM analysis.
              </div>
            </div>
          ) : (
            captures.map((capture) => (
              <CaptureCard
                key={capture.timestamp}
                capture={capture}
                onDelete={() => handleDeleteCapture(capture.timestamp)}
                onSendToVLM={() => handleSendToVLM(capture)}
              />
            ))
          )}
        </div>
      )}
      
      <div className="panel-footer">
        <div className="footer-hint">
          Capture scene → Add prompt → Send to VLM → Review mutations
        </div>
      </div>
    </div>
  );
}
