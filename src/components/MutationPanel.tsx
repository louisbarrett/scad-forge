import { useMemo } from 'react';
import { useForgeStore, selectHasPendingMutations } from '../store/forgeStore';
import { parseDiffLines, formatDiffSummary } from '../utils/diff';
import type { LLMMutation } from '../types';

interface DiffViewProps {
  oldCode: string;
  newCode: string;
  maxLines?: number;
}

function DiffView({ oldCode, newCode, maxLines = 20 }: DiffViewProps) {
  const lines = useMemo(() => {
    const allLines = parseDiffLines(oldCode, newCode);
    
    // Filter to only show changed lines and some context
    const filtered: typeof allLines = [];
    let inChangeBlock = false;
    let contextBuffer: typeof allLines = [];
    
    for (const line of allLines) {
      if (line.type !== 'context') {
        // Add buffered context
        filtered.push(...contextBuffer.slice(-2));
        contextBuffer = [];
        filtered.push(line);
        inChangeBlock = true;
      } else {
        if (inChangeBlock) {
          // Add trailing context
          if (contextBuffer.length < 2) {
            contextBuffer.push(line);
          } else {
            // End of change block
            filtered.push(...contextBuffer);
            contextBuffer = [];
            inChangeBlock = false;
          }
        } else {
          contextBuffer.push(line);
          if (contextBuffer.length > 3) {
            contextBuffer.shift();
          }
        }
      }
    }
    
    // Add remaining context
    if (contextBuffer.length > 0 && inChangeBlock) {
      filtered.push(...contextBuffer.slice(0, 2));
    }
    
    return filtered.slice(0, maxLines);
  }, [oldCode, newCode, maxLines]);
  
  if (lines.length === 0) {
    return <div className="diff-empty">No changes</div>;
  }
  
  return (
    <div className="diff-view">
      {lines.map((line, i) => (
        <div key={i} className={`diff-line diff-${line.type}`}>
          <span className="diff-gutter">
            {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
          </span>
          <span className="diff-line-num">
            {line.lineNumber.old ?? line.lineNumber.new ?? ''}
          </span>
          <span className="diff-content">{line.content || ' '}</span>
        </div>
      ))}
    </div>
  );
}

interface MutationCardProps {
  mutation: LLMMutation;
  isSelected: boolean;
  currentCode: string;
  onSelect: () => void;
  onAccept: () => void;
  onReject: () => void;
}

function MutationCard({
  mutation,
  isSelected,
  currentCode,
  onSelect,
  onAccept,
  onReject,
}: MutationCardProps) {
  const summary = useMemo(
    () => formatDiffSummary(currentCode, mutation.proposedCode),
    [currentCode, mutation.proposedCode]
  );
  
  return (
    <div
      className={`mutation-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="mutation-header">
        <span className="mutation-icon">⚡</span>
        <span className="mutation-title">{mutation.description}</span>
        <span className="mutation-summary">{summary}</span>
      </div>
      
      {mutation.reasoning && (
        <div className="mutation-reasoning">{mutation.reasoning}</div>
      )}
      
      {mutation.confidence !== undefined && (
        <div className="mutation-confidence">
          <div
            className="confidence-bar"
            style={{ width: `${mutation.confidence * 100}%` }}
          />
          <span className="confidence-label">
            {Math.round(mutation.confidence * 100)}% confidence
          </span>
        </div>
      )}
      
      {isSelected && (
        <div className="mutation-diff">
          <DiffView oldCode={currentCode} newCode={mutation.proposedCode} />
        </div>
      )}
      
      <div className="mutation-actions">
        <button
          className="action-btn accept-btn"
          onClick={(e) => {
            e.stopPropagation();
            onAccept();
          }}
        >
          ✓ Accept
        </button>
        <button
          className="action-btn reject-btn"
          onClick={(e) => {
            e.stopPropagation();
            onReject();
          }}
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
}

export function MutationPanel() {
  const {
    code,
    pendingMutations,
    selectedMutation,
    selectMutation,
    acceptMutation,
    rejectMutation,
    clearMutations,
    addMutation,
  } = useForgeStore();
  
  const hasMutations = useForgeStore(selectHasPendingMutations);
  
  // Demo: Add sample mutation for testing
  const handleAddDemoMutation = () => {
    addMutation({
      description: 'Increase wall thickness for better strength',
      proposedCode: code.replace(/wall\s*=\s*\d+/, 'wall = 5'),
      reasoning: 'Thicker walls will improve structural integrity for functional prints.',
      confidence: 0.85,
    });
  };
  
  return (
    <div className="mutation-panel">
      <div className="panel-header">
        <span className="panel-title">
          <span className="panel-icon">⚡</span>
          LLM Mutations
          {hasMutations && (
            <span className="mutation-count">{pendingMutations.length}</span>
          )}
        </span>
        <div className="panel-actions">
          {hasMutations && (
            <button
              className="action-btn clear-btn"
              onClick={clearMutations}
              title="Clear all mutations"
            >
              Clear
            </button>
          )}
          <button
            className="action-btn demo-btn"
            onClick={handleAddDemoMutation}
            title="Add demo mutation"
          >
            + Demo
          </button>
        </div>
      </div>
      
      <div className="mutation-list">
        {pendingMutations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◇</div>
            <div className="empty-text">No pending mutations</div>
            <div className="empty-hint">
              LLM-proposed code changes will appear here.
              <br />
              Send a capture to your VLM to get suggestions.
            </div>
          </div>
        ) : (
          pendingMutations.map((mutation) => (
            <MutationCard
              key={mutation.id}
              mutation={mutation}
              isSelected={selectedMutation === mutation.id}
              currentCode={code}
              onSelect={() =>
                selectMutation(selectedMutation === mutation.id ? null : mutation.id)
              }
              onAccept={() => acceptMutation(mutation.id)}
              onReject={() => rejectMutation(mutation.id)}
            />
          ))
        )}
      </div>
      
      <div className="panel-footer">
        <div className="footer-hint">
          Click mutation to preview • Ctrl+Enter to compile
        </div>
      </div>
    </div>
  );
}
