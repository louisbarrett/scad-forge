import { create } from 'zustand';
import { createDiff } from '../utils/diff';
import { v4 as uuidv4 } from 'uuid';
import type {
  CodePatch,
  LLMMutation,
  RenderResult,
  EngineStatus,
  ViewerState,
  EditorSettings,
  SceneCapture,
  ChatMessage,
  LLMConfig,
  ThemePreset,
  ThemeConfig,
} from '../types';
import { DEFAULT_LLM_CONFIG } from '../services/llm';

// LocalStorage keys
const STORAGE_KEYS = {
  LLM_CONFIG: 'scad-forge-llm-config',
  CHAT_MESSAGES: 'scad-forge-chat-messages',
  CODE: 'scad-forge-code',
  EDITOR_SETTINGS: 'scad-forge-editor-settings',
  VIEWER_STATE: 'scad-forge-viewer-state',
  THEME_CONFIG: 'scad-forge-theme-config',
} as const;

// Theme presets inspired by themegen - now with 3D viewer colors
export interface ThemeColors {
  // UI Colors
  '--bg-deepest': string;
  '--bg-deep': string;
  '--bg-dark': string;
  '--bg-medium': string;
  '--bg-light': string;
  '--bg-lighter': string;
  '--accent-primary': string;
  '--accent-secondary': string;
  '--accent-success': string;
  '--accent-warning': string;
  '--accent-danger': string;
  '--text-bright': string;
  '--text-normal': string;
  '--text-dim': string;
  '--text-muted': string;
  // 3D Viewer Colors
  '--viewer-bg': string;
  '--viewer-model-color': string;
  '--viewer-model-emissive': string;
  '--viewer-grid-cell': string;
  '--viewer-grid-section': string;
}

export const THEME_PRESETS: Record<ThemePreset, { name: string; colors: ThemeColors }> = {
  cyberpunk: {
    name: 'Cyberpunk',
    colors: {
      '--bg-deepest': '#05050a',
      '--bg-deep': '#0a0a14',
      '--bg-dark': '#0d0d1a',
      '--bg-medium': '#12121f',
      '--bg-light': '#1a1a2e',
      '--bg-lighter': '#252540',
      '--accent-primary': '#00d9ff',
      '--accent-secondary': '#7b2dff',
      '--accent-success': '#00ff88',
      '--accent-warning': '#ffaa00',
      '--accent-danger': '#ff4466',
      '--text-bright': '#ffffff',
      '--text-normal': '#c8c8d8',
      '--text-dim': '#8888a8',
      '--text-muted': '#5a5a7a',
      // 3D Viewer - Cyan/Purple neon
      '--viewer-bg': '#0a0a14',
      '--viewer-model-color': '#00d9ff',
      '--viewer-model-emissive': '#002233',
      '--viewer-grid-cell': '#1a1a3a',
      '--viewer-grid-section': '#2a2a5a',
    },
  },
  midnight: {
    name: 'Midnight Blue',
    colors: {
      '--bg-deepest': '#0a0e14',
      '--bg-deep': '#0d1117',
      '--bg-dark': '#161b22',
      '--bg-medium': '#21262d',
      '--bg-light': '#30363d',
      '--bg-lighter': '#484f58',
      '--accent-primary': '#58a6ff',
      '--accent-secondary': '#bc8cff',
      '--accent-success': '#3fb950',
      '--accent-warning': '#d29922',
      '--accent-danger': '#f85149',
      '--text-bright': '#f0f6fc',
      '--text-normal': '#c9d1d9',
      '--text-dim': '#8b949e',
      '--text-muted': '#6e7681',
      // 3D Viewer - GitHub dark blue
      '--viewer-bg': '#0d1117',
      '--viewer-model-color': '#58a6ff',
      '--viewer-model-emissive': '#0d2744',
      '--viewer-grid-cell': '#21262d',
      '--viewer-grid-section': '#30363d',
    },
  },
  aurora: {
    name: 'Aurora Borealis',
    colors: {
      '--bg-deepest': '#0a0f14',
      '--bg-deep': '#0e151c',
      '--bg-dark': '#131c27',
      '--bg-medium': '#1a2533',
      '--bg-light': '#243040',
      '--bg-lighter': '#2e3d50',
      '--accent-primary': '#00ffc8',
      '--accent-secondary': '#a855f7',
      '--accent-success': '#4ade80',
      '--accent-warning': '#fbbf24',
      '--accent-danger': '#f87171',
      '--text-bright': '#f0fdfa',
      '--text-normal': '#ccfbf1',
      '--text-dim': '#5eead4',
      '--text-muted': '#14b8a6',
      // 3D Viewer - Northern lights teal/purple
      '--viewer-bg': '#0a1014',
      '--viewer-model-color': '#00ffc8',
      '--viewer-model-emissive': '#003322',
      '--viewer-grid-cell': '#1a2533',
      '--viewer-grid-section': '#2a4050',
    },
  },
  ember: {
    name: 'Ember Glow',
    colors: {
      '--bg-deepest': '#0f0908',
      '--bg-deep': '#1a0f0c',
      '--bg-dark': '#231410',
      '--bg-medium': '#2e1a15',
      '--bg-light': '#3d231c',
      '--bg-lighter': '#4f2f26',
      '--accent-primary': '#ff6b35',
      '--accent-secondary': '#f7c948',
      '--accent-success': '#4ade80',
      '--accent-warning': '#fbbf24',
      '--accent-danger': '#ef4444',
      '--text-bright': '#fff7ed',
      '--text-normal': '#fed7aa',
      '--text-dim': '#fdba74',
      '--text-muted': '#fb923c',
      // 3D Viewer - Warm orange/gold
      '--viewer-bg': '#120a08',
      '--viewer-model-color': '#ff6b35',
      '--viewer-model-emissive': '#331500',
      '--viewer-grid-cell': '#2e1a15',
      '--viewer-grid-section': '#4a2820',
    },
  },
  forest: {
    name: 'Deep Forest',
    colors: {
      '--bg-deepest': '#080c0a',
      '--bg-deep': '#0c1410',
      '--bg-dark': '#101c16',
      '--bg-medium': '#16251e',
      '--bg-light': '#1e3328',
      '--bg-lighter': '#284234',
      '--accent-primary': '#22c55e',
      '--accent-secondary': '#84cc16',
      '--accent-success': '#4ade80',
      '--accent-warning': '#eab308',
      '--accent-danger': '#dc2626',
      '--text-bright': '#f0fdf4',
      '--text-normal': '#bbf7d0',
      '--text-dim': '#86efac',
      '--text-muted': '#4ade80',
      // 3D Viewer - Forest green
      '--viewer-bg': '#080e0a',
      '--viewer-model-color': '#22c55e',
      '--viewer-model-emissive': '#0a2210',
      '--viewer-grid-cell': '#16251e',
      '--viewer-grid-section': '#1e3828',
    },
  },
  ocean: {
    name: 'Deep Ocean',
    colors: {
      '--bg-deepest': '#020617',
      '--bg-deep': '#0f172a',
      '--bg-dark': '#1e293b',
      '--bg-medium': '#334155',
      '--bg-light': '#475569',
      '--bg-lighter': '#64748b',
      '--accent-primary': '#0ea5e9',
      '--accent-secondary': '#6366f1',
      '--accent-success': '#10b981',
      '--accent-warning': '#f59e0b',
      '--accent-danger': '#ef4444',
      '--text-bright': '#f8fafc',
      '--text-normal': '#e2e8f0',
      '--text-dim': '#94a3b8',
      '--text-muted': '#64748b',
      // 3D Viewer - Deep blue ocean
      '--viewer-bg': '#020617',
      '--viewer-model-color': '#0ea5e9',
      '--viewer-model-emissive': '#021a2f',
      '--viewer-grid-cell': '#1e293b',
      '--viewer-grid-section': '#334155',
    },
  },
};

// Load LLM config from localStorage
function loadLLMConfig(): LLMConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LLM_CONFIG);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_LLM_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load LLM config from localStorage:', e);
  }
  return DEFAULT_LLM_CONFIG;
}

// Save LLM config to localStorage
function saveLLMConfig(config: LLMConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LLM_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save LLM config to localStorage:', e);
  }
}

// Load chat messages from localStorage
function loadChatMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load chat messages from localStorage:', e);
  }
  return [];
}

// Save chat messages to localStorage
function saveChatMessages(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(messages));
  } catch (e) {
    console.warn('Failed to save chat messages to localStorage:', e);
  }
}

// Load code from localStorage
function loadCode(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CODE);
    if (stored) {
      return stored;
    }
  } catch (e) {
    console.warn('Failed to load code from localStorage:', e);
  }
  return DEFAULT_CODE;
}

// Save code to localStorage
function persistCode(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CODE, code);
  } catch (e) {
    console.warn('Failed to save code to localStorage:', e);
  }
}

// Load theme config from localStorage
function loadThemeConfig(): ThemeConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.THEME_CONFIG);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load theme config from localStorage:', e);
  }
  return { preset: 'cyberpunk' };
}

// Save theme config to localStorage
function saveThemeConfig(config: ThemeConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save theme config to localStorage:', e);
  }
}

// Apply theme to document
export function applyTheme(preset: ThemePreset): void {
  const theme = THEME_PRESETS[preset];
  if (!theme) return;
  
  const root = document.documentElement;
  Object.entries(theme.colors).forEach(([prop, value]) => {
    root.style.setProperty(prop, value);
  });
}

// Default OpenSCAD code with AZAI constants
const DEFAULT_CODE = `// SCAD Forge - Visual OpenSCAD Editor
// =====================================

// --- Fabrication Constants (AZAI Profile) ---
print_max = [220, 220, 220];  // Adventurer 5M Pro
clearance_loose = 0.4;
clearance_press = 0.15;
m3_clearance = 3.4;
m3_insert_hole = 4.0;

// --- Parameters ---
$fn = 32;
size = 30;
wall = 3;
corner_radius = 3;

// --- Main Geometry ---
module rounded_cube(s, r) {
    minkowski() {
        cube(s - 2*r, center=true);
        sphere(r);
    }
}

module mounting_post(h, od, id) {
    difference() {
        cylinder(h=h, d=od);
        translate([0, 0, -0.1])
            cylinder(h=h+0.2, d=id);
    }
}

// Build the part
difference() {
    rounded_cube(size, corner_radius);
    rounded_cube(size - wall*2, corner_radius);
}

// Add mounting posts
for (xy = [[-1,-1], [1,-1], [-1,1], [1,1]]) {
    translate([xy[0]*(size/2-6), xy[1]*(size/2-6), -size/2])
        mounting_post(8, 6, m3_clearance);
}
`;

interface ForgeState {
  // Code state
  code: string;
  savedCode: string;
  isDirty: boolean;
  
  // History
  history: CodePatch[];
  historyIndex: number;
  
  // LLM mutations
  pendingMutations: LLMMutation[];
  selectedMutation: string | null;
  
  // Render state
  renderResult: RenderResult | null;
  engineStatus: EngineStatus;
  
  // Viewer settings
  viewerState: ViewerState;
  
  // Editor settings
  editorSettings: EditorSettings;
  
  // Captures
  captures: SceneCapture[];
  
  // Chat state
  chatMessages: ChatMessage[];
  chatHistory: ChatMessage[][]; // Stack of chat states for undo
  chatHistoryIndex: number;
  llmConfig: LLMConfig;
  isChatStreaming: boolean;
  
  // Theme state
  themeConfig: ThemeConfig;
  
  // Actions
  setCode: (code: string) => void;
  saveCode: () => void;
  
  // History actions
  pushPatch: (description: string, newCode: string, source: 'user' | 'llm') => void;
  undo: () => void;
  redo: () => void;
  
  // Mutation actions
  addMutation: (mutation: Omit<LLMMutation, 'id' | 'diff'>) => void;
  acceptMutation: (id: string) => void;
  rejectMutation: (id: string) => void;
  selectMutation: (id: string | null) => void;
  clearMutations: () => void;
  
  // Render actions
  setRenderResult: (result: RenderResult | null) => void;
  setEngineStatus: (status: Partial<EngineStatus>) => void;
  
  // Viewer actions
  updateViewerState: (state: Partial<ViewerState>) => void;
  
  // Editor actions
  updateEditorSettings: (settings: Partial<EditorSettings>) => void;
  
  // Capture actions
  addCapture: (capture: Omit<SceneCapture, 'timestamp'>) => void;
  clearCaptures: () => void;
  
  // Chat actions
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void;
  appendToChatMessage: (id: string, content: string) => void;
  clearChat: () => void;
  undoChat: () => void;
  redoChat: () => void;
  saveChatSnapshot: () => void;
  setChatStreaming: (streaming: boolean) => void;
  updateLLMConfig: (config: Partial<LLMConfig>) => void;
  
  // Theme actions
  setTheme: (preset: ThemePreset) => void;
  
  // Reset
  reset: () => void;
  newDesign: () => void;
}

export const useForgeStore = create<ForgeState>((set, get) => ({
  // Initial state - load from localStorage
  code: loadCode(),
  savedCode: DEFAULT_CODE,
  isDirty: false,
  
  history: [],
  historyIndex: -1,
  
  pendingMutations: [],
  selectedMutation: null,
  
  renderResult: null,
  engineStatus: {
    ready: false,
    compiling: false,
  },
  
  viewerState: {
    wireframe: false,
    showAxes: true,
    showGrid: true,
    autoRotate: false,
    backgroundColor: '#1a1a2e',
  },
  
  editorSettings: {
    fontSize: 14,
    theme: 'vs-dark',
    minimap: false,
    wordWrap: false,
    autoCompile: true,
    compileDelay: 1500, // Increased delay to reduce unnecessary recompilations
  },
  
  captures: [],
  
  // Chat state - load from localStorage
  chatMessages: loadChatMessages(),
  chatHistory: [],
  chatHistoryIndex: -1,
  llmConfig: loadLLMConfig(),
  isChatStreaming: false,
  
  // Theme state
  themeConfig: loadThemeConfig(),
  
  // Actions
  setCode: (code) => {
    // Debounced save to localStorage happens via pushPatch
    // Only persist immediately if it's a significant change
    set((state) => ({
      code,
      isDirty: code !== state.savedCode,
    }));
  },
  
  saveCode: () => set((state) => ({
    savedCode: state.code,
    isDirty: false,
  })),
  
  pushPatch: (description, newCode, source) => {
    const state = get();
    const diff = createDiff(state.code, newCode);
    
    const patch: CodePatch = {
      id: uuidv4(),
      timestamp: Date.now(),
      description,
      oldCode: state.code,
      newCode,
      diff,
      source,
      status: 'accepted',
    };
    
    // Truncate history if we're not at the end
    const truncatedHistory = state.history.slice(0, state.historyIndex + 1);
    
    // Save to localStorage
    persistCode(newCode);
    
    set({
      code: newCode,
      savedCode: newCode,
      isDirty: false,
      history: [...truncatedHistory, patch],
      historyIndex: truncatedHistory.length,
    });
  },
  
  undo: () => {
    const state = get();
    if (state.historyIndex >= 0) {
      const patch = state.history[state.historyIndex];
      set({
        code: patch.oldCode,
        historyIndex: state.historyIndex - 1,
        isDirty: true,
      });
    }
  },
  
  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const patch = state.history[state.historyIndex + 1];
      set({
        code: patch.newCode,
        historyIndex: state.historyIndex + 1,
        isDirty: false,
      });
    }
  },
  
  addMutation: (mutation) => {
    const state = get();
    const diff = createDiff(state.code, mutation.proposedCode);
    
    const fullMutation: LLMMutation = {
      ...mutation,
      id: uuidv4(),
      diff,
    };
    
    set({
      pendingMutations: [...state.pendingMutations, fullMutation],
    });
  },
  
  acceptMutation: (id) => {
    const state = get();
    const mutation = state.pendingMutations.find((m) => m.id === id);
    
    if (mutation) {
      get().pushPatch(mutation.description, mutation.proposedCode, 'llm');
      set({
        pendingMutations: state.pendingMutations.filter((m) => m.id !== id),
        selectedMutation: null,
      });
    }
  },
  
  rejectMutation: (id) => set((state) => ({
    pendingMutations: state.pendingMutations.filter((m) => m.id !== id),
    selectedMutation: state.selectedMutation === id ? null : state.selectedMutation,
  })),
  
  selectMutation: (id) => set({ selectedMutation: id }),
  
  clearMutations: () => set({
    pendingMutations: [],
    selectedMutation: null,
  }),
  
  setRenderResult: (result) => set({ renderResult: result }),
  
  setEngineStatus: (status) => set((state) => ({
    engineStatus: { ...state.engineStatus, ...status },
  })),
  
  updateViewerState: (viewerState) => set((state) => ({
    viewerState: { ...state.viewerState, ...viewerState },
  })),
  
  updateEditorSettings: (settings) => set((state) => ({
    editorSettings: { ...state.editorSettings, ...settings },
  })),
  
  addCapture: (capture) => set((state) => ({
    captures: [...state.captures, { ...capture, timestamp: Date.now() }],
  })),
  
  clearCaptures: () => set({ captures: [] }),
  
  // Chat actions
  addChatMessage: (message) => {
    const id = uuidv4();
    const fullMessage: ChatMessage = {
      ...message,
      id,
      timestamp: Date.now(),
    };
    set((state) => {
      const newMessages = [...state.chatMessages, fullMessage];
      // Persist user messages immediately (assistant messages are persisted on complete)
      if (message.role === 'user') {
        saveChatMessages(newMessages);
      }
      return { chatMessages: newMessages };
    });
    return id;
  },
  
  updateChatMessage: (id, updates) => {
    set((state) => {
      const newMessages = state.chatMessages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      );
      // Persist when message is complete or errored (not during streaming)
      if (updates.status === 'complete' || updates.status === 'error') {
        saveChatMessages(newMessages);
      }
      return { chatMessages: newMessages };
    });
  },
  
  appendToChatMessage: (id, content) => set((state) => ({
    // Don't persist during streaming - too many writes
    chatMessages: state.chatMessages.map((msg) =>
      msg.id === id ? { ...msg, content: msg.content + content } : msg
    ),
  })),
  
  clearChat: () => {
    const state = get();
    // Save current state for undo
    const truncatedHistory = state.chatHistory.slice(0, state.chatHistoryIndex + 1);
    set({
      chatMessages: [],
      chatHistory: [...truncatedHistory, state.chatMessages],
      chatHistoryIndex: truncatedHistory.length,
    });
    saveChatMessages([]);
  },
  
  undoChat: () => {
    const state = get();
    if (state.chatHistoryIndex >= 0) {
      const previousMessages = state.chatHistory[state.chatHistoryIndex];
      set({
        chatMessages: previousMessages,
        chatHistoryIndex: state.chatHistoryIndex - 1,
      });
      saveChatMessages(previousMessages);
    }
  },
  
  redoChat: () => {
    const state = get();
    if (state.chatHistoryIndex < state.chatHistory.length - 1) {
      const nextMessages = state.chatHistory[state.chatHistoryIndex + 1] || [];
      set({
        chatMessages: nextMessages,
        chatHistoryIndex: state.chatHistoryIndex + 1,
      });
      saveChatMessages(nextMessages);
    }
  },
  
  saveChatSnapshot: () => {
    const state = get();
    // Save current state to history for undo
    const truncatedHistory = state.chatHistory.slice(0, state.chatHistoryIndex + 1);
    set({
      chatHistory: [...truncatedHistory, [...state.chatMessages]],
      chatHistoryIndex: truncatedHistory.length,
    });
  },
  
  setChatStreaming: (streaming) => set({ isChatStreaming: streaming }),
  
  updateLLMConfig: (config) => {
    const state = get();
    const newConfig = { ...state.llmConfig, ...config };
    saveLLMConfig(newConfig);
    set({ llmConfig: newConfig });
  },
  
  // Theme actions
  setTheme: (preset) => {
    const newConfig: ThemeConfig = { preset };
    saveThemeConfig(newConfig);
    applyTheme(preset);
    set({ themeConfig: newConfig });
  },
  
  reset: () => {
    persistCode(DEFAULT_CODE);
    saveChatMessages([]);
    set({
      code: DEFAULT_CODE,
      savedCode: DEFAULT_CODE,
      isDirty: false,
      history: [],
      historyIndex: -1,
      pendingMutations: [],
      selectedMutation: null,
      renderResult: null,
      captures: [],
      chatMessages: [],
      chatHistory: [],
      chatHistoryIndex: -1,
      isChatStreaming: false,
    });
  },
  
  newDesign: () => {
    const state = get();
    // Save current code to history before resetting
    if (state.code !== DEFAULT_CODE) {
      state.pushPatch('Previous design', state.code, 'user');
    }
    persistCode(DEFAULT_CODE);
    set({
      code: DEFAULT_CODE,
      savedCode: DEFAULT_CODE,
      isDirty: false,
      // Keep history so user can undo back to previous design
      pendingMutations: [],
      selectedMutation: null,
      renderResult: null,
      // Keep captures and chat for context
    });
  },
}));

// Selectors
export const selectCanUndo = (state: ForgeState) => state.historyIndex >= 0;
export const selectCanRedo = (state: ForgeState) => state.historyIndex < state.history.length - 1;
export const selectHasPendingMutations = (state: ForgeState) => state.pendingMutations.length > 0;
