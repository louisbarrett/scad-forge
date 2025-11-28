// Core Types for SCAD Forge

import type * as THREE from 'three';

// Theme Configuration
// Dark themes
export type ThemeDark = 'cyberpunk' | 'midnight' | 'aurora' | 'ember' | 'forest' | 'ocean' | 'nord' | 'dracula' | 'monokai' | 'tokyoNight';
// Light themes  
export type ThemeLight = 'solarizedLight' | 'paperLight' | 'daybreak' | 'sepia';
// High-contrast themes
export type ThemeHighContrast = 'hcDark' | 'hcLight' | 'matrix' | 'terminal';

export type ThemePreset = ThemeDark | ThemeLight | ThemeHighContrast;

export interface ThemeConfig {
  preset: ThemePreset;
  customColors?: Partial<ThemeColors>;
}

export interface ThemeColors {
  bgDeep: string;
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentPrimary: string;
  accentSecondary: string;
  accentSuccess: string;
  accentWarning: string;
  accentError: string;
}

// LLM Provider types
export type LLMProvider = 'ollama' | 'openai' | 'together' | 'groq' | 'xai' | 'custom';

// Per-provider API keys
export interface ProviderApiKeys {
  openai?: string;
  together?: string;
  groq?: string;
  xai?: string;
  custom?: string;
  // Ollama typically doesn't need an API key for local usage
}

// LLM Configuration - Multi-model support with per-provider API keys
export interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string;
  // Per-provider API keys
  providerApiKeys: ProviderApiKeys;
  // Legacy single apiKey (for backward compatibility, will be migrated)
  apiKey?: string;
  // Planning/coding model for generating OpenSCAD code
  planningModel: string;
  // Vision model for analyzing images and visual context
  visionModel: string;
  // Legacy single model (used as fallback)
  model: string;
  temperature: number;
  maxTokens: number;
  // Auto-apply settings
  autoApply: boolean;  // Automatically apply LLM code to editor
  autoRender: boolean; // Automatically render after applying code
}

// Chat Message Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  // Optional attached context
  attachedCode?: string;
  attachedImage?: string;
  // If the message resulted in a mutation proposal
  proposedMutationId?: string;
  // Status for assistant messages
  status?: 'pending' | 'streaming' | 'complete' | 'error';
  error?: string;
  // Which model was used
  modelUsed?: 'planning' | 'vision' | 'both';
}

export interface CodePatch {
  id: string;
  timestamp: number;
  description: string;
  oldCode: string;
  newCode: string;
  diff: string;
  source: 'user' | 'llm';
  status: 'pending' | 'accepted' | 'rejected';
}

export interface CodeHistory {
  patches: CodePatch[];
  currentIndex: number;
}

export interface RenderResult {
  success: boolean;
  stlData?: ArrayBuffer;
  geometry?: THREE.BufferGeometry;
  error?: string;
  warnings?: string[];
  renderTime?: number;
}

export interface SceneCapture {
  imageDataUrl: string;
  code: string;
  timestamp: number;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
}

export interface LLMMutation {
  id: string;
  description: string;
  proposedCode: string;
  diff: string;
  confidence?: number;
  reasoning?: string;
  // Track which models were used
  visionAnalysis?: string;
}

export interface EngineStatus {
  ready: boolean;
  compiling: boolean;
  progress?: number;
  lastError?: string;
}

export interface ViewerState {
  wireframe: boolean;
  showAxes: boolean;
  showGrid: boolean;
  autoRotate: boolean;
  backgroundColor: string;
}

export interface EditorSettings {
  fontSize: number;
  theme: 'vs-dark' | 'vs-light' | 'hc-black';
  minimap: boolean;
  wordWrap: boolean;
  autoCompile: boolean;
  compileDelay: number;
}

// System Console Message (errors/warnings from OpenSCAD)
export type SystemMessageType = 'error' | 'warning' | 'info';

export interface SystemMessage {
  id: string;
  type: SystemMessageType;
  content: string;
  timestamp: number;
  source?: string; // e.g., 'openscad', 'llm', 'system'
}

// Imported file (STL, DXF, SVG, etc.)
export interface ImportedFile {
  name: string;
  size: number;
  type: string;
  timestamp: number;
}

// OpenSCAD specific types
export interface ScadVariable {
  name: string;
  value: number | string | boolean | number[];
  type: 'number' | 'string' | 'boolean' | 'vector';
  line: number;
}

export interface ScadModule {
  name: string;
  params: string[];
  startLine: number;
  endLine: number;
}

export interface ScadAnalysis {
  variables: ScadVariable[];
  modules: ScadModule[];
  includes: string[];
  uses: string[];
  errors: { line: number; message: string }[];
}
