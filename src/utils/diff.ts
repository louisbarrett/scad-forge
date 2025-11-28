import { diffLines, createPatch, applyPatch as applyUnifiedPatch } from 'diff';

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNumber: {
    old?: number;
    new?: number;
  };
}

/**
 * Create a unified diff string between two code versions
 */
export function createDiff(oldCode: string, newCode: string): string {
  return createPatch('code.scad', oldCode, newCode, 'previous', 'proposed');
}

/**
 * Apply a patch to code
 */
export function applyPatch(code: string, patch: string): string | null {
  const result = applyUnifiedPatch(code, patch);
  return result === false ? null : result;
}

/**
 * Parse diff into structured lines for display
 */
export function parseDiffLines(oldCode: string, newCode: string): DiffLine[] {
  const changes = diffLines(oldCode, newCode);
  const result: DiffLine[] = [];
  
  let oldLine = 1;
  let newLine = 1;
  
  for (const change of changes) {
    const lines = change.value.split('\n').filter((_, i, arr) => 
      i < arr.length - 1 || arr[i] !== ''
    );
    
    for (const line of lines) {
      if (change.added) {
        result.push({
          type: 'add',
          content: line,
          lineNumber: { new: newLine++ },
        });
      } else if (change.removed) {
        result.push({
          type: 'remove',
          content: line,
          lineNumber: { old: oldLine++ },
        });
      } else {
        result.push({
          type: 'context',
          content: line,
          lineNumber: { old: oldLine++, new: newLine++ },
        });
      }
    }
  }
  
  return result;
}

/**
 * Get a summary of changes
 */
export function getDiffSummary(oldCode: string, newCode: string): {
  additions: number;
  deletions: number;
  changes: number;
} {
  const changes = diffLines(oldCode, newCode);
  
  let additions = 0;
  let deletions = 0;
  
  for (const change of changes) {
    const lineCount = change.value.split('\n').length - 1;
    if (change.added) {
      additions += lineCount;
    } else if (change.removed) {
      deletions += lineCount;
    }
  }
  
  return {
    additions,
    deletions,
    changes: additions + deletions,
  };
}

/**
 * Generate a human-readable summary
 */
export function formatDiffSummary(oldCode: string, newCode: string): string {
  const { additions, deletions } = getDiffSummary(oldCode, newCode);
  
  const parts: string[] = [];
  if (additions > 0) parts.push(`+${additions}`);
  if (deletions > 0) parts.push(`-${deletions}`);
  
  return parts.join(' / ') || 'No changes';
}
