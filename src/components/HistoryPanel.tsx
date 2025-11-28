import { useMemo } from 'react';
import { useForgeStore, selectCanUndo, selectCanRedo } from '../store/forgeStore';
import { formatDiffSummary } from '../utils/diff';

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleDateString();
}

export function HistoryPanel() {
  const { history, historyIndex, undo, redo } = useForgeStore();
  
  const canUndo = useForgeStore(selectCanUndo);
  const canRedo = useForgeStore(selectCanRedo);
  
  // Reverse history for display (newest first)
  const displayHistory = useMemo(() => {
    return [...history].reverse().map((patch, reversedIndex) => ({
      ...patch,
      originalIndex: history.length - 1 - reversedIndex,
      isCurrent: history.length - 1 - reversedIndex === historyIndex,
      summary: formatDiffSummary(patch.oldCode, patch.newCode),
    }));
  }, [history, historyIndex]);
  
  return (
    <div className="history-panel">
      <div className="panel-header">
        <span className="panel-title">
          <span className="panel-icon">⟲</span>
          History
          {history.length > 0 && (
            <span className="history-count">{history.length}</span>
          )}
        </span>
        <div className="panel-actions">
          <button
            className="action-btn undo-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            className="action-btn redo-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            ↷
          </button>
        </div>
      </div>
      
      <div className="history-list">
        {displayHistory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⟲</div>
            <div className="empty-text">No history yet</div>
            <div className="empty-hint">
              Changes will be tracked here as you edit.
            </div>
          </div>
        ) : (
          <>
            {/* Current state indicator */}
            {historyIndex === history.length - 1 && (
              <div className="history-current-marker">
                <span className="current-dot" />
                <span className="current-label">Current</span>
              </div>
            )}
            
            {displayHistory.map((patch) => (
              <div
                key={patch.id}
                className={`history-item ${patch.isCurrent ? 'current' : ''} ${
                  patch.originalIndex > historyIndex ? 'future' : ''
                }`}
              >
                <div className="history-connector">
                  <div className="connector-line" />
                  <div className={`connector-dot ${patch.source}`} />
                </div>
                
                <div className="history-content">
                  <div className="history-header">
                    <span className={`source-badge ${patch.source}`}>
                      {patch.source === 'llm' ? '⚡' : '✎'}
                    </span>
                    <span className="history-description">{patch.description}</span>
                  </div>
                  
                  <div className="history-meta">
                    <span className="history-time">
                      {formatTimestamp(patch.timestamp)}
                    </span>
                    <span className="history-summary">{patch.summary}</span>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      
      <div className="panel-footer">
        <div className="footer-stats">
          {history.length > 0 && (
            <>
              <span className="stat">
                {history.filter((p) => p.source === 'user').length} manual
              </span>
              <span className="stat">
                {history.filter((p) => p.source === 'llm').length} LLM
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
