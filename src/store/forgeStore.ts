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
  SystemMessage,
  SystemMessageType,
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

// Theme presets inspired by themegen - now with 3D viewer colors and editor theming
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
  // Editor Colors (Monaco)
  '--editor-bg': string;
  '--editor-fg': string;
  '--editor-line-highlight': string;
  '--editor-selection': string;
  '--editor-cursor': string;
  '--editor-line-number': string;
  '--editor-line-number-active': string;
  '--editor-comment': string;
  '--editor-keyword': string;
  '--editor-function': string;
  '--editor-variable': string;
  '--editor-number': string;
  '--editor-string': string;
  '--editor-operator': string;
}

export const THEME_PRESETS: Record<ThemePreset, { name: string; category: 'dark' | 'light' | 'high-contrast'; colors: ThemeColors }> = {
  // ============================================
  // DARK THEMES
  // ============================================
  cyberpunk: {
    name: '🌃 Cyberpunk',
    category: 'dark',
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
      '--viewer-bg': '#0a0a14',
      '--viewer-model-color': '#00d9ff',
      '--viewer-model-emissive': '#002233',
      '--viewer-grid-cell': '#1a1a3a',
      '--viewer-grid-section': '#2a2a5a',
      '--editor-bg': '#0d0d1a',
      '--editor-fg': '#c8c8d8',
      '--editor-line-highlight': '#1a1a2e',
      '--editor-selection': '#264f78',
      '--editor-cursor': '#00d9ff',
      '--editor-line-number': '#4a4a6a',
      '--editor-line-number-active': '#00d9ff',
      '--editor-comment': '#6a9955',
      '--editor-keyword': '#c586c0',
      '--editor-function': '#dcdcaa',
      '--editor-variable': '#9cdcfe',
      '--editor-number': '#b5cea8',
      '--editor-string': '#ce9178',
      '--editor-operator': '#d4d4d4',
    },
  },
  midnight: {
    name: '🌙 Midnight Blue',
    category: 'dark',
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
      '--viewer-bg': '#0d1117',
      '--viewer-model-color': '#58a6ff',
      '--viewer-model-emissive': '#0d2744',
      '--viewer-grid-cell': '#21262d',
      '--viewer-grid-section': '#30363d',
      '--editor-bg': '#0d1117',
      '--editor-fg': '#c9d1d9',
      '--editor-line-highlight': '#161b22',
      '--editor-selection': '#264f78',
      '--editor-cursor': '#58a6ff',
      '--editor-line-number': '#484f58',
      '--editor-line-number-active': '#58a6ff',
      '--editor-comment': '#8b949e',
      '--editor-keyword': '#ff7b72',
      '--editor-function': '#d2a8ff',
      '--editor-variable': '#79c0ff',
      '--editor-number': '#a5d6ff',
      '--editor-string': '#a5d6ff',
      '--editor-operator': '#c9d1d9',
    },
  },
  aurora: {
    name: '🌌 Aurora Borealis',
    category: 'dark',
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
      '--viewer-bg': '#0a1014',
      '--viewer-model-color': '#00ffc8',
      '--viewer-model-emissive': '#003322',
      '--viewer-grid-cell': '#1a2533',
      '--viewer-grid-section': '#2a4050',
      '--editor-bg': '#131c27',
      '--editor-fg': '#ccfbf1',
      '--editor-line-highlight': '#1a2533',
      '--editor-selection': '#264f78',
      '--editor-cursor': '#00ffc8',
      '--editor-line-number': '#2e3d50',
      '--editor-line-number-active': '#00ffc8',
      '--editor-comment': '#5eead4',
      '--editor-keyword': '#a855f7',
      '--editor-function': '#f0abfc',
      '--editor-variable': '#67e8f9',
      '--editor-number': '#4ade80',
      '--editor-string': '#fbbf24',
      '--editor-operator': '#ccfbf1',
    },
  },
  ember: {
    name: '🔥 Ember Glow',
    category: 'dark',
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
      '--viewer-bg': '#120a08',
      '--viewer-model-color': '#ff6b35',
      '--viewer-model-emissive': '#331500',
      '--viewer-grid-cell': '#2e1a15',
      '--viewer-grid-section': '#4a2820',
      '--editor-bg': '#1a0f0c',
      '--editor-fg': '#fed7aa',
      '--editor-line-highlight': '#2e1a15',
      '--editor-selection': '#5c3a2e',
      '--editor-cursor': '#ff6b35',
      '--editor-line-number': '#4f2f26',
      '--editor-line-number-active': '#ff6b35',
      '--editor-comment': '#8b6f5c',
      '--editor-keyword': '#f7c948',
      '--editor-function': '#ffb86c',
      '--editor-variable': '#fed7aa',
      '--editor-number': '#4ade80',
      '--editor-string': '#fbbf24',
      '--editor-operator': '#fed7aa',
    },
  },
  forest: {
    name: '🌲 Deep Forest',
    category: 'dark',
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
      '--viewer-bg': '#080e0a',
      '--viewer-model-color': '#22c55e',
      '--viewer-model-emissive': '#0a2210',
      '--viewer-grid-cell': '#16251e',
      '--viewer-grid-section': '#1e3828',
      '--editor-bg': '#0c1410',
      '--editor-fg': '#bbf7d0',
      '--editor-line-highlight': '#16251e',
      '--editor-selection': '#1e4030',
      '--editor-cursor': '#22c55e',
      '--editor-line-number': '#284234',
      '--editor-line-number-active': '#22c55e',
      '--editor-comment': '#4ade80',
      '--editor-keyword': '#84cc16',
      '--editor-function': '#a3e635',
      '--editor-variable': '#86efac',
      '--editor-number': '#fbbf24',
      '--editor-string': '#fcd34d',
      '--editor-operator': '#bbf7d0',
    },
  },
  ocean: {
    name: '🌊 Deep Ocean',
    category: 'dark',
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
      '--viewer-bg': '#020617',
      '--viewer-model-color': '#0ea5e9',
      '--viewer-model-emissive': '#021a2f',
      '--viewer-grid-cell': '#1e293b',
      '--viewer-grid-section': '#334155',
      '--editor-bg': '#0f172a',
      '--editor-fg': '#e2e8f0',
      '--editor-line-highlight': '#1e293b',
      '--editor-selection': '#334155',
      '--editor-cursor': '#0ea5e9',
      '--editor-line-number': '#475569',
      '--editor-line-number-active': '#0ea5e9',
      '--editor-comment': '#64748b',
      '--editor-keyword': '#f472b6',
      '--editor-function': '#a78bfa',
      '--editor-variable': '#38bdf8',
      '--editor-number': '#34d399',
      '--editor-string': '#fbbf24',
      '--editor-operator': '#e2e8f0',
    },
  },
  nord: {
    name: '❄️ Nord',
    category: 'dark',
    colors: {
      '--bg-deepest': '#1e222a',
      '--bg-deep': '#2e3440',
      '--bg-dark': '#3b4252',
      '--bg-medium': '#434c5e',
      '--bg-light': '#4c566a',
      '--bg-lighter': '#5e6779',
      '--accent-primary': '#88c0d0',
      '--accent-secondary': '#b48ead',
      '--accent-success': '#a3be8c',
      '--accent-warning': '#ebcb8b',
      '--accent-danger': '#bf616a',
      '--text-bright': '#eceff4',
      '--text-normal': '#d8dee9',
      '--text-dim': '#a3b1c2',
      '--text-muted': '#7b879a',
      '--viewer-bg': '#2e3440',
      '--viewer-model-color': '#88c0d0',
      '--viewer-model-emissive': '#1a3040',
      '--viewer-grid-cell': '#3b4252',
      '--viewer-grid-section': '#4c566a',
      '--editor-bg': '#2e3440',
      '--editor-fg': '#d8dee9',
      '--editor-line-highlight': '#3b4252',
      '--editor-selection': '#434c5e',
      '--editor-cursor': '#88c0d0',
      '--editor-line-number': '#4c566a',
      '--editor-line-number-active': '#88c0d0',
      '--editor-comment': '#616e88',
      '--editor-keyword': '#81a1c1',
      '--editor-function': '#88c0d0',
      '--editor-variable': '#d8dee9',
      '--editor-number': '#b48ead',
      '--editor-string': '#a3be8c',
      '--editor-operator': '#81a1c1',
    },
  },
  dracula: {
    name: '🧛 Dracula',
    category: 'dark',
    colors: {
      '--bg-deepest': '#1e1f29',
      '--bg-deep': '#282a36',
      '--bg-dark': '#343746',
      '--bg-medium': '#3e4154',
      '--bg-light': '#44475a',
      '--bg-lighter': '#545772',
      '--accent-primary': '#bd93f9',
      '--accent-secondary': '#ff79c6',
      '--accent-success': '#50fa7b',
      '--accent-warning': '#f1fa8c',
      '--accent-danger': '#ff5555',
      '--text-bright': '#f8f8f2',
      '--text-normal': '#e6e6e0',
      '--text-dim': '#b0b0a8',
      '--text-muted': '#6272a4',
      '--viewer-bg': '#282a36',
      '--viewer-model-color': '#bd93f9',
      '--viewer-model-emissive': '#2a1a44',
      '--viewer-grid-cell': '#3e4154',
      '--viewer-grid-section': '#44475a',
      '--editor-bg': '#282a36',
      '--editor-fg': '#f8f8f2',
      '--editor-line-highlight': '#343746',
      '--editor-selection': '#44475a',
      '--editor-cursor': '#f8f8f2',
      '--editor-line-number': '#545772',
      '--editor-line-number-active': '#f8f8f2',
      '--editor-comment': '#6272a4',
      '--editor-keyword': '#ff79c6',
      '--editor-function': '#50fa7b',
      '--editor-variable': '#f8f8f2',
      '--editor-number': '#bd93f9',
      '--editor-string': '#f1fa8c',
      '--editor-operator': '#ff79c6',
    },
  },
  monokai: {
    name: '🎨 Monokai Pro',
    category: 'dark',
    colors: {
      '--bg-deepest': '#19181a',
      '--bg-deep': '#221f22',
      '--bg-dark': '#2d2a2e',
      '--bg-medium': '#363337',
      '--bg-light': '#403e41',
      '--bg-lighter': '#525053',
      '--accent-primary': '#ffd866',
      '--accent-secondary': '#ab9df2',
      '--accent-success': '#a9dc76',
      '--accent-warning': '#fc9867',
      '--accent-danger': '#ff6188',
      '--text-bright': '#fcfcfa',
      '--text-normal': '#d6d6d4',
      '--text-dim': '#939293',
      '--text-muted': '#727072',
      '--viewer-bg': '#221f22',
      '--viewer-model-color': '#ffd866',
      '--viewer-model-emissive': '#443c1a',
      '--viewer-grid-cell': '#363337',
      '--viewer-grid-section': '#403e41',
      '--editor-bg': '#2d2a2e',
      '--editor-fg': '#fcfcfa',
      '--editor-line-highlight': '#363337',
      '--editor-selection': '#49474b',
      '--editor-cursor': '#fcfcfa',
      '--editor-line-number': '#5b595c',
      '--editor-line-number-active': '#ffd866',
      '--editor-comment': '#727072',
      '--editor-keyword': '#ff6188',
      '--editor-function': '#a9dc76',
      '--editor-variable': '#fcfcfa',
      '--editor-number': '#ab9df2',
      '--editor-string': '#ffd866',
      '--editor-operator': '#ff6188',
    },
  },
  tokyoNight: {
    name: '🗼 Tokyo Night',
    category: 'dark',
    colors: {
      '--bg-deepest': '#16161e',
      '--bg-deep': '#1a1b26',
      '--bg-dark': '#1f2335',
      '--bg-medium': '#24283b',
      '--bg-light': '#292e42',
      '--bg-lighter': '#3b4261',
      '--accent-primary': '#7aa2f7',
      '--accent-secondary': '#bb9af7',
      '--accent-success': '#9ece6a',
      '--accent-warning': '#e0af68',
      '--accent-danger': '#f7768e',
      '--text-bright': '#c0caf5',
      '--text-normal': '#a9b1d6',
      '--text-dim': '#787c99',
      '--text-muted': '#565f89',
      '--viewer-bg': '#1a1b26',
      '--viewer-model-color': '#7aa2f7',
      '--viewer-model-emissive': '#1a2244',
      '--viewer-grid-cell': '#24283b',
      '--viewer-grid-section': '#292e42',
      '--editor-bg': '#1a1b26',
      '--editor-fg': '#a9b1d6',
      '--editor-line-highlight': '#1f2335',
      '--editor-selection': '#283457',
      '--editor-cursor': '#c0caf5',
      '--editor-line-number': '#3b4261',
      '--editor-line-number-active': '#7aa2f7',
      '--editor-comment': '#565f89',
      '--editor-keyword': '#bb9af7',
      '--editor-function': '#7aa2f7',
      '--editor-variable': '#c0caf5',
      '--editor-number': '#ff9e64',
      '--editor-string': '#9ece6a',
      '--editor-operator': '#89ddff',
    },
  },

  // ============================================
  // LIGHT THEMES
  // ============================================
  solarizedLight: {
    name: '☀️ Solarized Light',
    category: 'light',
    colors: {
      '--bg-deepest': '#fdf6e3',
      '--bg-deep': '#eee8d5',
      '--bg-dark': '#e4ddc8',
      '--bg-medium': '#d5cdb6',
      '--bg-light': '#c9c1a5',
      '--bg-lighter': '#b3ab93',
      '--accent-primary': '#268bd2',
      '--accent-secondary': '#6c71c4',
      '--accent-success': '#859900',
      '--accent-warning': '#b58900',
      '--accent-danger': '#dc322f',
      '--text-bright': '#002b36',
      '--text-normal': '#073642',
      '--text-dim': '#586e75',
      '--text-muted': '#93a1a1',
      '--viewer-bg': '#eee8d5',
      '--viewer-model-color': '#268bd2',
      '--viewer-model-emissive': '#8ec0e6',
      '--viewer-grid-cell': '#d5cdb6',
      '--viewer-grid-section': '#b3ab93',
      '--editor-bg': '#fdf6e3',
      '--editor-fg': '#657b83',
      '--editor-line-highlight': '#eee8d5',
      '--editor-selection': '#d5cdb6',
      '--editor-cursor': '#268bd2',
      '--editor-line-number': '#93a1a1',
      '--editor-line-number-active': '#268bd2',
      '--editor-comment': '#93a1a1',
      '--editor-keyword': '#859900',
      '--editor-function': '#268bd2',
      '--editor-variable': '#073642',
      '--editor-number': '#d33682',
      '--editor-string': '#2aa198',
      '--editor-operator': '#657b83',
    },
  },
  paperLight: {
    name: '📄 Paper',
    category: 'light',
    colors: {
      '--bg-deepest': '#ffffff',
      '--bg-deep': '#f8f9fa',
      '--bg-dark': '#f1f3f5',
      '--bg-medium': '#e9ecef',
      '--bg-light': '#dee2e6',
      '--bg-lighter': '#ced4da',
      '--accent-primary': '#228be6',
      '--accent-secondary': '#7950f2',
      '--accent-success': '#40c057',
      '--accent-warning': '#fd7e14',
      '--accent-danger': '#fa5252',
      '--text-bright': '#000000',
      '--text-normal': '#212529',
      '--text-dim': '#495057',
      '--text-muted': '#868e96',
      '--viewer-bg': '#f8f9fa',
      '--viewer-model-color': '#228be6',
      '--viewer-model-emissive': '#a5d8ff',
      '--viewer-grid-cell': '#dee2e6',
      '--viewer-grid-section': '#adb5bd',
      '--editor-bg': '#ffffff',
      '--editor-fg': '#212529',
      '--editor-line-highlight': '#f1f3f5',
      '--editor-selection': '#d0ebff',
      '--editor-cursor': '#228be6',
      '--editor-line-number': '#adb5bd',
      '--editor-line-number-active': '#228be6',
      '--editor-comment': '#868e96',
      '--editor-keyword': '#e64980',
      '--editor-function': '#228be6',
      '--editor-variable': '#212529',
      '--editor-number': '#ae3ec9',
      '--editor-string': '#37b24d',
      '--editor-operator': '#495057',
    },
  },
  daybreak: {
    name: '🌅 Daybreak',
    category: 'light',
    colors: {
      '--bg-deepest': '#fffbf5',
      '--bg-deep': '#fff7ed',
      '--bg-dark': '#ffedd5',
      '--bg-medium': '#fed7aa',
      '--bg-light': '#fdba74',
      '--bg-lighter': '#fb923c',
      '--accent-primary': '#ea580c',
      '--accent-secondary': '#7c3aed',
      '--accent-success': '#16a34a',
      '--accent-warning': '#ca8a04',
      '--accent-danger': '#dc2626',
      '--text-bright': '#0c0a09',
      '--text-normal': '#1c1917',
      '--text-dim': '#44403c',
      '--text-muted': '#78716c',
      '--viewer-bg': '#fff7ed',
      '--viewer-model-color': '#ea580c',
      '--viewer-model-emissive': '#ffedd5',
      '--viewer-grid-cell': '#fed7aa',
      '--viewer-grid-section': '#fb923c',
      '--editor-bg': '#fffbf5',
      '--editor-fg': '#1c1917',
      '--editor-line-highlight': '#fff7ed',
      '--editor-selection': '#fed7aa',
      '--editor-cursor': '#ea580c',
      '--editor-line-number': '#a8a29e',
      '--editor-line-number-active': '#ea580c',
      '--editor-comment': '#78716c',
      '--editor-keyword': '#c026d3',
      '--editor-function': '#ea580c',
      '--editor-variable': '#1c1917',
      '--editor-number': '#7c3aed',
      '--editor-string': '#16a34a',
      '--editor-operator': '#44403c',
    },
  },
  sepia: {
    name: '📜 Sepia',
    category: 'light',
    colors: {
      '--bg-deepest': '#f4ecd8',
      '--bg-deep': '#e8dfc9',
      '--bg-dark': '#ddd4be',
      '--bg-medium': '#cfc5ae',
      '--bg-light': '#bfb49c',
      '--bg-lighter': '#a89e88',
      '--accent-primary': '#8b4513',
      '--accent-secondary': '#654321',
      '--accent-success': '#556b2f',
      '--accent-warning': '#b8860b',
      '--accent-danger': '#a52a2a',
      '--text-bright': '#1a1108',
      '--text-normal': '#3d2914',
      '--text-dim': '#5c4a32',
      '--text-muted': '#8b7355',
      '--viewer-bg': '#e8dfc9',
      '--viewer-model-color': '#8b4513',
      '--viewer-model-emissive': '#ddd4be',
      '--viewer-grid-cell': '#cfc5ae',
      '--viewer-grid-section': '#a89e88',
      '--editor-bg': '#f4ecd8',
      '--editor-fg': '#3d2914',
      '--editor-line-highlight': '#e8dfc9',
      '--editor-selection': '#cfc5ae',
      '--editor-cursor': '#8b4513',
      '--editor-line-number': '#a89e88',
      '--editor-line-number-active': '#8b4513',
      '--editor-comment': '#8b7355',
      '--editor-keyword': '#654321',
      '--editor-function': '#8b4513',
      '--editor-variable': '#3d2914',
      '--editor-number': '#556b2f',
      '--editor-string': '#b8860b',
      '--editor-operator': '#5c4a32',
    },
  },

  // ============================================
  // HIGH CONTRAST THEMES
  // ============================================
  hcDark: {
    name: '⬛ High Contrast Dark',
    category: 'high-contrast',
    colors: {
      '--bg-deepest': '#000000',
      '--bg-deep': '#0a0a0a',
      '--bg-dark': '#141414',
      '--bg-medium': '#1e1e1e',
      '--bg-light': '#2a2a2a',
      '--bg-lighter': '#3a3a3a',
      '--accent-primary': '#00ffff',
      '--accent-secondary': '#ff00ff',
      '--accent-success': '#00ff00',
      '--accent-warning': '#ffff00',
      '--accent-danger': '#ff0000',
      '--text-bright': '#ffffff',
      '--text-normal': '#ffffff',
      '--text-dim': '#e0e0e0',
      '--text-muted': '#a0a0a0',
      '--viewer-bg': '#000000',
      '--viewer-model-color': '#00ffff',
      '--viewer-model-emissive': '#004444',
      '--viewer-grid-cell': '#333333',
      '--viewer-grid-section': '#666666',
      '--editor-bg': '#000000',
      '--editor-fg': '#ffffff',
      '--editor-line-highlight': '#1e1e1e',
      '--editor-selection': '#0066cc',
      '--editor-cursor': '#ffffff',
      '--editor-line-number': '#666666',
      '--editor-line-number-active': '#ffffff',
      '--editor-comment': '#7f7f7f',
      '--editor-keyword': '#ff00ff',
      '--editor-function': '#00ffff',
      '--editor-variable': '#ffffff',
      '--editor-number': '#00ff00',
      '--editor-string': '#ffff00',
      '--editor-operator': '#ffffff',
    },
  },
  hcLight: {
    name: '⬜ High Contrast Light',
    category: 'high-contrast',
    colors: {
      '--bg-deepest': '#ffffff',
      '--bg-deep': '#f5f5f5',
      '--bg-dark': '#e8e8e8',
      '--bg-medium': '#d0d0d0',
      '--bg-light': '#b0b0b0',
      '--bg-lighter': '#909090',
      '--accent-primary': '#0000cc',
      '--accent-secondary': '#880088',
      '--accent-success': '#006600',
      '--accent-warning': '#886600',
      '--accent-danger': '#cc0000',
      '--text-bright': '#000000',
      '--text-normal': '#000000',
      '--text-dim': '#202020',
      '--text-muted': '#505050',
      '--viewer-bg': '#ffffff',
      '--viewer-model-color': '#0000cc',
      '--viewer-model-emissive': '#aaaaff',
      '--viewer-grid-cell': '#cccccc',
      '--viewer-grid-section': '#888888',
      '--editor-bg': '#ffffff',
      '--editor-fg': '#000000',
      '--editor-line-highlight': '#f0f0f0',
      '--editor-selection': '#add6ff',
      '--editor-cursor': '#000000',
      '--editor-line-number': '#666666',
      '--editor-line-number-active': '#000000',
      '--editor-comment': '#505050',
      '--editor-keyword': '#880088',
      '--editor-function': '#0000cc',
      '--editor-variable': '#000000',
      '--editor-number': '#006600',
      '--editor-string': '#886600',
      '--editor-operator': '#000000',
    },
  },
  matrix: {
    name: '💊 Matrix',
    category: 'high-contrast',
    colors: {
      '--bg-deepest': '#000000',
      '--bg-deep': '#001100',
      '--bg-dark': '#002200',
      '--bg-medium': '#003300',
      '--bg-light': '#004400',
      '--bg-lighter': '#005500',
      '--accent-primary': '#00ff00',
      '--accent-secondary': '#00cc00',
      '--accent-success': '#00ff00',
      '--accent-warning': '#88ff00',
      '--accent-danger': '#ff0000',
      '--text-bright': '#00ff00',
      '--text-normal': '#00dd00',
      '--text-dim': '#00aa00',
      '--text-muted': '#007700',
      '--viewer-bg': '#000800',
      '--viewer-model-color': '#00ff00',
      '--viewer-model-emissive': '#003300',
      '--viewer-grid-cell': '#003300',
      '--viewer-grid-section': '#006600',
      '--editor-bg': '#000800',
      '--editor-fg': '#00ff00',
      '--editor-line-highlight': '#001800',
      '--editor-selection': '#004400',
      '--editor-cursor': '#00ff00',
      '--editor-line-number': '#005500',
      '--editor-line-number-active': '#00ff00',
      '--editor-comment': '#007700',
      '--editor-keyword': '#88ff00',
      '--editor-function': '#00ffaa',
      '--editor-variable': '#00dd00',
      '--editor-number': '#00ff88',
      '--editor-string': '#00ff44',
      '--editor-operator': '#00ff00',
    },
  },
  terminal: {
    name: '💻 Retro Terminal',
    category: 'high-contrast',
    colors: {
      '--bg-deepest': '#000000',
      '--bg-deep': '#0d0d0d',
      '--bg-dark': '#1a1a1a',
      '--bg-medium': '#262626',
      '--bg-light': '#333333',
      '--bg-lighter': '#404040',
      '--accent-primary': '#33ff33',
      '--accent-secondary': '#ffb000',
      '--accent-success': '#33ff33',
      '--accent-warning': '#ffff33',
      '--accent-danger': '#ff3333',
      '--text-bright': '#33ff33',
      '--text-normal': '#20c020',
      '--text-dim': '#18a018',
      '--text-muted': '#108010',
      '--viewer-bg': '#000000',
      '--viewer-model-color': '#33ff33',
      '--viewer-model-emissive': '#0a3310',
      '--viewer-grid-cell': '#1a3a1a',
      '--viewer-grid-section': '#2a5a2a',
      '--editor-bg': '#0a0a0a',
      '--editor-fg': '#33ff33',
      '--editor-line-highlight': '#1a2a1a',
      '--editor-selection': '#2a4a2a',
      '--editor-cursor': '#33ff33',
      '--editor-line-number': '#108010',
      '--editor-line-number-active': '#33ff33',
      '--editor-comment': '#108010',
      '--editor-keyword': '#ffb000',
      '--editor-function': '#33ffff',
      '--editor-variable': '#33ff33',
      '--editor-number': '#ff33ff',
      '--editor-string': '#ffff33',
      '--editor-operator': '#33ff33',
    },
  },
};

// Load LLM config from localStorage with migration support
function loadLLMConfig(): LLMConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LLM_CONFIG);
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Migrate old single apiKey to providerApiKeys if needed
      let providerApiKeys = parsed.providerApiKeys || {};
      if (parsed.apiKey && !parsed.providerApiKeys) {
        // Try to detect which provider the old apiKey was for based on baseUrl
        const baseUrl = parsed.baseUrl || '';
        if (baseUrl.includes('api.openai.com')) {
          providerApiKeys = { ...providerApiKeys, openai: parsed.apiKey };
        } else if (baseUrl.includes('api.x.ai')) {
          providerApiKeys = { ...providerApiKeys, xai: parsed.apiKey };
        } else if (baseUrl.includes('api.together.xyz')) {
          providerApiKeys = { ...providerApiKeys, together: parsed.apiKey };
        } else if (baseUrl.includes('api.groq.com')) {
          providerApiKeys = { ...providerApiKeys, groq: parsed.apiKey };
        } else if (!baseUrl.includes('localhost')) {
          providerApiKeys = { ...providerApiKeys, custom: parsed.apiKey };
        }
      }
      
      return { 
        ...DEFAULT_LLM_CONFIG, 
        ...parsed, 
        providerApiKeys,
      };
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

// Default OpenSCAD code - minimum viable starting point
const DEFAULT_CODE = `// SCAD Forge - New Design
// Start building your 3D model here

$fn = 32;

cube(20, center=true);
`;

interface ForgeState {
  // Code state
  code: string;
  savedCode: string;
  isDirty: boolean;
  lastUserEdit: number; // Timestamp of last user edit - prevents async overwrites
  
  // History
  history: CodePatch[];
  historyIndex: number;
  
  // LLM mutations
  pendingMutations: LLMMutation[];
  selectedMutation: string | null;
  
  // Render state
  renderResult: RenderResult | null;
  engineStatus: EngineStatus;
  
  // Auto-fix state
  autoFixEnabled: boolean;
  autoFixAttempts: number;
  isAutoFixing: boolean;
  lastAutoFixError: string | null;
  
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
  
  // System console state (errors/warnings)
  systemMessages: SystemMessage[];
  
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
  
  // Auto-fix actions
  setAutoFixEnabled: (enabled: boolean) => void;
  startAutoFix: () => void;
  endAutoFix: (success: boolean, error?: string) => void;
  resetAutoFixAttempts: () => void;
  
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
  
  // System console actions
  addSystemMessage: (type: SystemMessageType, content: string, source?: string) => void;
  clearSystemMessages: () => void;
  getRecentSystemMessages: (count?: number) => SystemMessage[];
  
  // Reset
  reset: () => void;
  newDesign: () => void;
}

export const useForgeStore = create<ForgeState>((set, get) => ({
  // Initial state - load from localStorage
  code: loadCode(),
  savedCode: DEFAULT_CODE,
  isDirty: false,
  lastUserEdit: 0,
  
  history: [],
  historyIndex: -1,
  
  pendingMutations: [],
  selectedMutation: null,
  
  renderResult: null,
  engineStatus: {
    ready: false,
    compiling: false,
  },
  
  // Auto-fix state
  autoFixEnabled: true, // Enabled by default
  autoFixAttempts: 0,
  isAutoFixing: false,
  lastAutoFixError: null,
  
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
  
  // System console state
  systemMessages: [],
  
  // Actions
  setCode: (code) => {
    // Track when user last edited - helps prevent overwrites from async operations
    const now = Date.now();
    set((state) => ({
      code,
      isDirty: code !== state.savedCode,
      lastUserEdit: now,
    }));
    // Also persist to localStorage to prevent loss on re-render
    persistCode(code);
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
  
  // Auto-fix actions
  setAutoFixEnabled: (enabled) => set({ autoFixEnabled: enabled }),
  
  startAutoFix: () => set((state) => ({
    isAutoFixing: true,
    autoFixAttempts: state.autoFixAttempts + 1,
  })),
  
  endAutoFix: (success, error) => set({
    isAutoFixing: false,
    lastAutoFixError: success ? null : (error || 'Auto-fix failed'),
  }),
  
  resetAutoFixAttempts: () => set({
    autoFixAttempts: 0,
    lastAutoFixError: null,
  }),
  
  updateViewerState: (viewerState) => set((state) => ({
    viewerState: { ...state.viewerState, ...viewerState },
  })),
  
  updateEditorSettings: (settings) => set((state) => ({
    editorSettings: { ...state.editorSettings, ...settings },
  })),
  
  addCapture: (capture) => set(() => ({
    // Only keep the latest capture - replace any existing ones
    captures: [{ ...capture, timestamp: Date.now() }],
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
  
  // System console actions
  addSystemMessage: (type, content, source = 'system') => {
    const message: SystemMessage = {
      id: uuidv4(),
      type,
      content,
      timestamp: Date.now(),
      source,
    };
    set((state) => ({
      systemMessages: [...state.systemMessages.slice(-99), message], // Keep last 100
    }));
  },
  
  clearSystemMessages: () => set({ systemMessages: [] }),
  
  getRecentSystemMessages: (count = 10) => {
    const state = get();
    return state.systemMessages.slice(-count);
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
      systemMessages: [],
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
