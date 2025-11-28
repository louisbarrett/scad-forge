// Core Types for SCAD Forge

import type * as THREE from 'three';

// Theme Configuration
export type ThemePreset = 'cyberpunk' | 'midnight' | 'aurora' | 'ember' | 'forest' | 'ocean';

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

// LLM Configuration - Multi-model support
export interface LLMConfig {
  provider: 'ollama' | 'openai' | 'custom';
  baseUrl: string;
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
