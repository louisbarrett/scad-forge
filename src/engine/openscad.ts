import type { RenderResult, ScadAnalysis } from '../types';
import { parseOFFBytesToGeometry } from '../utils/off-parser';

/**
 * STL Export Result
 */
export interface STLExportResult {
  success: boolean;
  data?: Uint8Array;
  error?: string;
}

/**
 * OpenSCAD Engine Interface
 * Abstract the rendering backend
 */
export interface IOpenSCADEngine {
  initialize(): Promise<void>;
  compile(code: string): Promise<RenderResult>;
  exportSTL(code: string): Promise<STLExportResult>;
  analyze(code: string): ScadAnalysis;
  isReady(): boolean;
  cancel(): void;
}

/**
 * Parse OpenSCAD code for analysis (variable extraction, etc.)
 */
export function analyzeScadCode(code: string): ScadAnalysis {
  const variables: ScadAnalysis['variables'] = [];
  const modules: ScadAnalysis['modules'] = [];
  const includes: string[] = [];
  const uses: string[] = [];
  const errors: ScadAnalysis['errors'] = [];
  
  const lines = code.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();
    
    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
    
    // Variable assignment: name = value;
    const varMatch = trimmed.match(/^(\w+)\s*=\s*(.+?)\s*;/);
    if (varMatch) {
      const [, name, valueStr] = varMatch;
      
      // Parse value type
      let value: number | string | boolean | number[];
      let type: 'number' | 'string' | 'boolean' | 'vector' = 'number';
      
      if (valueStr.startsWith('[')) {
        // Vector
        type = 'vector';
        try {
          value = JSON.parse(valueStr.replace(/(\d+)\s*,/g, '$1,'));
        } catch {
          value = [0, 0, 0];
        }
      } else if (valueStr === 'true' || valueStr === 'false') {
        type = 'boolean';
        value = valueStr === 'true';
      } else if (valueStr.startsWith('"')) {
        type = 'string';
        value = valueStr.slice(1, -1);
      } else {
        type = 'number';
        value = parseFloat(valueStr) || 0;
      }
      
      variables.push({ name, value, type, line: lineNum });
    }
    
    // Module definition
    const moduleMatch = trimmed.match(/^module\s+(\w+)\s*\(([^)]*)\)/);
    if (moduleMatch) {
      const [, name, paramsStr] = moduleMatch;
      const params = paramsStr.split(',').map(p => p.trim()).filter(Boolean);
      modules.push({ name, params, startLine: lineNum, endLine: lineNum });
    }
    
    // Include/use
    const includeMatch = trimmed.match(/^include\s*<([^>]+)>/);
    if (includeMatch) includes.push(includeMatch[1]);
    
    const useMatch = trimmed.match(/^use\s*<([^>]+)>/);
    if (useMatch) uses.push(useMatch[1]);
  });
  
  return { variables, modules, includes, uses, errors };
}

/**
 * Result from OpenSCAD worker
 */
interface WorkerResult {
  success: boolean;
  output?: Uint8Array;
  stdout: string[];
  stderr: string[];
  error?: string;
  elapsedMillis: number;
}

/**
 * Real OpenSCAD WASM Engine
 * Uses the actual OpenSCAD WASM module for accurate rendering
 * OPTIMIZED: Reuses worker instance, supports compilation cancellation
 */
export class WASMOpenSCADEngine implements IOpenSCADEngine {
  private worker: Worker | null = null;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private pendingResolve: ((result: WorkerResult) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private currentStdout: string[] = [];
  private currentStderr: string[] = [];
  private compilationId = 0;
  private systemMessageCallback: ((type: 'error' | 'warning' | 'info', content: string) => void) | null = null;
  
  // Set callback for system messages
  setSystemMessageCallback(callback: (type: 'error' | 'warning' | 'info', content: string) => void) {
    this.systemMessageCallback = callback;
  }
  
  // Parse and send stderr messages to system console
  private notifySystemMessage(text: string) {
    if (!this.systemMessageCallback || !text.trim()) return;
    
    const trimmed = text.trim();
    let type: 'error' | 'warning' | 'info' = 'info';
    
    if (trimmed.startsWith('ERROR:') || trimmed.includes('error')) {
      type = 'error';
    } else if (trimmed.startsWith('WARNING:') || trimmed.includes('warning') || trimmed.startsWith('⚠')) {
      type = 'warning';
    }
    
    this.systemMessageCallback(type, trimmed);
  }
  
  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = new Promise((resolve, reject) => {
      try {
        // Create worker from public folder as ES module
        this.worker = new Worker('/openscad-worker.js', { type: 'module' });
        
        this.worker.onmessage = (e: MessageEvent) => {
          const { type, text, result } = e.data;
          
          if (type === 'ready') {
            console.log('OpenSCAD WASM engine ready');
            this.ready = true;
            resolve();
            return;
          }
          
          if (type === 'stdout') {
            this.currentStdout.push(text);
            console.log('[OpenSCAD]', text);
            return;
          }
          
          if (type === 'stderr') {
            this.currentStderr.push(text);
            console.warn('[OpenSCAD]', text);
            // Send to system console
            this.notifySystemMessage(text);
            return;
          }
          
          if (type === 'result' && this.pendingResolve) {
            // Add collected output to result
            result.stdout = [...this.currentStdout];
            result.stderr = [...this.currentStderr];
            this.pendingResolve(result);
            this.pendingResolve = null;
            this.pendingReject = null;
          }
        };
        
        this.worker.onerror = (e: ErrorEvent) => {
          console.error('OpenSCAD worker error:', e);
          if (this.pendingReject) {
            this.pendingReject(new Error(e.message));
            this.pendingResolve = null;
            this.pendingReject = null;
          }
          if (!this.ready) {
            reject(new Error(`Worker failed to initialize: ${e.message}`));
          }
        };
        
        // Set a timeout for initialization
        setTimeout(() => {
          if (!this.ready) {
            console.warn('OpenSCAD WASM taking longer than expected to initialize...');
          }
        }, 5000);
        
      } catch (e) {
        reject(e);
      }
    });
    
    return this.initPromise;
  }
  
  isReady(): boolean {
    return this.ready;
  }
  
  analyze(code: string): ScadAnalysis {
    return analyzeScadCode(code);
  }
  
  async compile(code: string): Promise<RenderResult> {
    if (!this.ready || !this.worker) {
      return { success: false, error: 'Engine not initialized' };
    }
    
    const startTime = performance.now();
    
    // Cancel any pending compilation by incrementing ID
    this.compilationId++;
    const thisCompilationId = this.compilationId;
    
    // Reject previous pending promise if any (cancellation)
    if (this.pendingReject) {
      this.pendingReject(new Error('Compilation superseded'));
      this.pendingResolve = null;
      this.pendingReject = null;
    }
    
    // Reset output collectors
    this.currentStdout = [];
    this.currentStderr = [];
    
    try {
      const result = await new Promise<WorkerResult>((resolve, reject) => {
        this.pendingResolve = resolve;
        this.pendingReject = reject;
        
        this.worker!.postMessage({
          code,
          format: 'off',
          cancelId: thisCompilationId,
        });
      });
      
      // Check if this compilation was superseded
      if (thisCompilationId !== this.compilationId) {
        return { success: false, error: 'Compilation cancelled' };
      }
      
      if (!result.success) {
        // Parse errors from stderr
        const errorMessages = result.stderr.filter(line => 
          line.startsWith('ERROR:') || line.startsWith('WARNING:')
        );
        
        return {
          success: false,
          error: result.error || errorMessages.join('\n') || 'Compilation failed',
          warnings: result.stderr.filter(line => line.startsWith('WARNING:')),
          renderTime: result.elapsedMillis,
        };
      }
      
      if (!result.output) {
        return {
          success: false,
          error: 'No output generated',
          renderTime: result.elapsedMillis,
        };
      }
      
      // Parse OFF output to THREE.js geometry
      const geometry = parseOFFBytesToGeometry(result.output);
      
      const renderTime = performance.now() - startTime;
      
      return {
        success: true,
        geometry,
        renderTime,
        warnings: result.stderr.filter(line => line.startsWith('WARNING:')),
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        renderTime: performance.now() - startTime,
      };
    }
  }
  
  cancel(): void {
    // Cancel any pending compilation by incrementing ID and rejecting the promise
    this.compilationId++;
    if (this.pendingReject) {
      this.pendingReject(new Error('Compilation cancelled'));
      this.pendingResolve = null;
      this.pendingReject = null;
    }
  }
  
  async exportSTL(code: string): Promise<STLExportResult> {
    if (!this.ready || !this.worker) {
      return { success: false, error: 'Engine not initialized' };
    }
    
    // Cancel any pending compilation by incrementing ID
    this.compilationId++;
    const thisCompilationId = this.compilationId;
    
    // Reject previous pending promise if any (cancellation)
    if (this.pendingReject) {
      this.pendingReject(new Error('Compilation superseded'));
      this.pendingResolve = null;
      this.pendingReject = null;
    }
    
    // Reset output collectors
    this.currentStdout = [];
    this.currentStderr = [];
    
    try {
      const result = await new Promise<WorkerResult>((resolve, reject) => {
        this.pendingResolve = resolve;
        this.pendingReject = reject;
        
        // Request STL format instead of OFF
        this.worker!.postMessage({
          code,
          format: 'stl',
          cancelId: thisCompilationId,
        });
      });
      
      // Check if this compilation was superseded
      if (thisCompilationId !== this.compilationId) {
        return { success: false, error: 'Export cancelled' };
      }
      
      if (!result.success) {
        const errorMessages = result.stderr.filter(line => 
          line.startsWith('ERROR:') || line.startsWith('WARNING:')
        );
        
        return {
          success: false,
          error: result.error || errorMessages.join('\n') || 'STL export failed',
        };
      }
      
      if (!result.output) {
        return {
          success: false,
          error: 'No STL output generated',
        };
      }
      
      return {
        success: true,
        data: result.output,
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.ready = false;
    }
  }
}

// Singleton engine instance
let engineInstance: IOpenSCADEngine | null = null;

export async function getEngine(): Promise<IOpenSCADEngine> {
  if (!engineInstance) {
    engineInstance = new WASMOpenSCADEngine();
    await engineInstance.initialize();
  }
  return engineInstance;
}

export function resetEngine(): void {
  if (engineInstance && 'terminate' in engineInstance) {
    (engineInstance as WASMOpenSCADEngine).terminate();
  }
  engineInstance = null;
}
