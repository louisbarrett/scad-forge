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
} from '../types';
import { DEFAULT_LLM_CONFIG } from '../services/llm';

// LocalStorage keys
const STORAGE_KEYS = {
  LLM_CONFIG: 'scad-forge-llm-config',
  CHAT_MESSAGES: 'scad-forge-chat-messages',
  CODE: 'scad-forge-code',
  EDITOR_SETTINGS: 'scad-forge-editor-settings',
  VIEWER_STATE: 'scad-forge-viewer-state',
} as const;

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
    compileDelay: 1000,
  },
  
  captures: [],
  
  // Chat state - load from localStorage
  chatMessages: loadChatMessages(),
  chatHistory: [],
  chatHistoryIndex: -1,
  llmConfig: loadLLMConfig(),
  isChatStreaming: false,
  
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
    set((state) => ({
      chatMessages: [...state.chatMessages, fullMessage],
    }));
    return id;
  },
  
  updateChatMessage: (id, updates) => set((state) => ({
    chatMessages: state.chatMessages.map((msg) =>
      msg.id === id ? { ...msg, ...updates } : msg
    ),
  })),
  
  appendToChatMessage: (id, content) => set((state) => ({
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
