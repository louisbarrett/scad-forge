import { useState, useCallback } from 'react';
import { useForgeStore } from '../store/forgeStore';
import { getLLMService, extractCodeFromResponse } from '../services/llm';
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
  const { captures, clearCaptures, llmConfig, addMutation } = useForgeStore();
  const [prompt, setPrompt] = useState('');
  const [selectedCapture, setSelectedCapture] = useState<SceneCapture | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<'idle' | 'vision' | 'planning'>('idle');
  const [processingOutput, setProcessingOutput] = useState('');
  const [visionAnalysis, setVisionAnalysis] = useState('');
  
  const handleSendToVLM = useCallback((capture: SceneCapture) => {
    setSelectedCapture(capture);
    setProcessingOutput('');
    setVisionAnalysis('');
    setProcessingStep('idle');
  }, []);
  
  const handleSubmit = useCallback(async () => {
    if (!selectedCapture || !prompt.trim()) return;
    
    setIsProcessing(true);
    setProcessingOutput('');
    setVisionAnalysis('');
    
    try {
      const llmService = getLLMService();
      llmService.updateConfig(llmConfig);
      
      let fullOutput = '';
      let capturedVisionAnalysis = '';
      
      // Use the streaming vision mutation pipeline
      for await (const chunk of llmService.streamVisionMutation(
        selectedCapture.imageDataUrl,
        prompt,
        selectedCapture.code,
        (analysis) => {
          capturedVisionAnalysis = analysis;
          setVisionAnalysis(analysis);
        }
      )) {
        if (chunk.type === 'vision') {
          setProcessingStep('vision');
        } else if (chunk.type === 'planning') {
          setProcessingStep('planning');
        }
        fullOutput += chunk.content;
        setProcessingOutput(fullOutput);
      }
      
      // Extract code from the planning output
      const extractedCode = extractCodeFromResponse(fullOutput);
      
      if (extractedCode) {
        // Add as mutation with vision analysis
        addMutation({
          description: `Visual: ${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}`,
          proposedCode: extractedCode,
          reasoning: `Based on visual analysis: ${capturedVisionAnalysis.slice(0, 200)}...`,
          confidence: 0.8 + Math.random() * 0.15,
          visionAnalysis: capturedVisionAnalysis,
        });
        
        // Also call the original handler if provided
        onRequestMutation(prompt, selectedCapture);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setProcessingOutput(`Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
      setProcessingStep('idle');
    }
  }, [selectedCapture, prompt, llmConfig, addMutation, onRequestMutation]);
  
  const handleDeleteCapture = useCallback((timestamp: number) => {
    // Note: Would need to add this to store, for now just log
    console.log('Delete capture:', timestamp);
  }, []);
  
  // Generate VLM context payload
  const generatePayload = useCallback((_capture: SceneCapture, userPrompt: string) => {
    return {
      pipeline: 'vision → planning',
      step1_vision: {
        model: llmConfig.visionModel || llmConfig.model,
        system: 'You are a 3D CAD design analyst...',
        content: [
          { type: 'image', data: '[image data]' },
          { type: 'text', text: `Analyze for: ${userPrompt}` },
        ],
      },
      step2_planning: {
        model: llmConfig.planningModel || llmConfig.model,
        system: 'You are an OpenSCAD code generator...',
        input: '[vision analysis + code + prompt]',
      },
    };
  }, [llmConfig]);
  
  return (
    <div className="vlm-panel">
      <div className="panel-header">
        <span className="panel-title">
          <span className="panel-icon">👁</span>
          Vision + Planning
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
              onClick={() => {
                setSelectedCapture(null);
                setProcessingOutput('');
                setVisionAnalysis('');
              }}
              disabled={isProcessing}
            >
              ✕
            </button>
          </div>
          
          {/* Processing status */}
          {isProcessing && (
            <div className="vlm-processing">
              <div className={`vlm-processing-step ${processingStep === 'vision' ? 'active' : processingStep === 'planning' ? 'complete' : ''}`}>
                <span className="step-icon">{processingStep === 'vision' ? '🔄' : '✓'}</span>
                <span className="step-label">
                  👁 Vision Model: {llmConfig.visionModel || llmConfig.model}
                </span>
              </div>
              <div className={`vlm-processing-step ${processingStep === 'planning' ? 'active' : ''}`}>
                <span className="step-icon">{processingStep === 'planning' ? '🔄' : '○'}</span>
                <span className="step-label">
                  ⚙️ Planning Model: {llmConfig.planningModel || llmConfig.model}
                </span>
              </div>
              {processingOutput && (
                <div className="vlm-processing-output">
                  {processingOutput}
                </div>
              )}
            </div>
          )}
          
          {/* Vision analysis result */}
          {visionAnalysis && !isProcessing && (
            <div className="mutation-vision-analysis">
              <div className="mutation-vision-analysis-header">
                <span>👁 Vision Analysis</span>
              </div>
              {visionAnalysis.slice(0, 300)}...
            </div>
          )}
          
          <div className="compose-prompt">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What would you like to modify?

The vision model will analyze the image first,
then the planning model will generate the code.

Examples:
• Add fillets to all sharp edges
• Make it more compact
• Add mounting holes for M3 screws"
              rows={4}
              disabled={isProcessing}
            />
          </div>
          
          <div className="compose-actions">
            <button
              className="action-btn cancel-btn"
              onClick={() => {
                setSelectedCapture(null);
                setProcessingOutput('');
                setVisionAnalysis('');
              }}
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              className="action-btn submit-btn"
              onClick={handleSubmit}
              disabled={!prompt.trim() || isProcessing}
            >
              {isProcessing ? '🔄 Processing...' : '🚀 Vision → Planning'}
            </button>
          </div>
          
          <div className="payload-preview">
            <details>
              <summary>View Pipeline Configuration</summary>
              <pre>
                {JSON.stringify(generatePayload(selectedCapture, prompt), null, 2)}
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
                <br /><br />
                <strong>Dual-Model Pipeline:</strong>
                <br />1. 👁 Vision model analyzes the image
                <br />2. ⚙️ Planning model generates code
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
          Capture scene → Vision analyzes → Planning generates code
        </div>
      </div>
    </div>
  );
}
