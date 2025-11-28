import { useRef, useEffect, useCallback, useMemo } from 'react';
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react';
import type { editor, Monaco } from 'monaco-editor';
import { useForgeStore } from '../store/forgeStore';

// OpenSCAD language definition for Monaco
const OPENSCAD_LANGUAGE_DEF = {
  keywords: [
    'module', 'function', 'if', 'else', 'for', 'let', 'each',
    'intersection_for', 'assign', 'echo', 'assert', 'true', 'false',
    'undef', 'include', 'use',
  ],
  
  builtins: [
    // 3D primitives
    'cube', 'sphere', 'cylinder', 'polyhedron',
    // 2D primitives  
    'circle', 'square', 'polygon', 'text',
    // Transformations
    'translate', 'rotate', 'scale', 'mirror', 'multmatrix',
    'color', 'offset', 'hull', 'minkowski',
    // Boolean operations
    'union', 'difference', 'intersection',
    // Extrusions
    'linear_extrude', 'rotate_extrude',
    // Import/export
    'import', 'surface', 'projection',
    // Math functions
    'abs', 'sign', 'sin', 'cos', 'tan', 'acos', 'asin', 'atan', 'atan2',
    'floor', 'round', 'ceil', 'ln', 'log', 'pow', 'sqrt', 'exp',
    'rands', 'min', 'max', 'norm', 'cross',
    // Other functions
    'concat', 'lookup', 'str', 'chr', 'ord', 'search', 'version',
    'parent_module', 'len', 'is_undef', 'is_list', 'is_num', 'is_bool', 'is_string',
  ],
  
  specialVars: [
    '$fn', '$fa', '$fs', '$t', '$vpr', '$vpt', '$vpd', '$vpf',
    '$children', '$preview',
  ],
  
  operators: [
    '=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=',
    '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%',
  ],
  
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  
  tokenizer: {
    root: [
      // Comments
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      
      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string'],
      
      // Numbers
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],
      
      // Special variables
      [/\$\w+/, 'variable.predefined'],
      
      // Identifiers and keywords
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@keywords': 'keyword',
          '@builtins': 'support.function',
          '@default': 'identifier',
        },
      }],
      
      // Brackets
      [/[{}()\[\]]/, '@brackets'],
      
      // Operators
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': '',
        },
      }],
      
      // Delimiters
      [/[;,.]/, 'delimiter'],
    ],
    
    comment: [
      [/[^\/*]+/, 'comment'],
      [/\/\*/, 'comment', '@push'],
      [/\*\//, 'comment', '@pop'],
      [/[\/*]/, 'comment'],
    ],
    
    string: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],
  },
};

// Helper to get CSS variable value
function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Helper to convert hex color to Monaco format (without #)
function hexToMonaco(hex: string): string {
  return hex.replace('#', '').toUpperCase();
}

// Determine if a color is light or dark for base theme selection
function isLightColor(hex: string): boolean {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

// Create dynamic Monaco theme from CSS variables
function createDynamicTheme(): editor.IStandaloneThemeData {
  const editorBg = getCSSVar('--editor-bg') || '#0d0d1a';
  const editorFg = getCSSVar('--editor-fg') || '#c8c8d8';
  const lineHighlight = getCSSVar('--editor-line-highlight') || '#1a1a2e';
  const selection = getCSSVar('--editor-selection') || '#264f78';
  const cursor = getCSSVar('--editor-cursor') || '#00d9ff';
  const lineNumber = getCSSVar('--editor-line-number') || '#4a4a6a';
  const lineNumberActive = getCSSVar('--editor-line-number-active') || '#00d9ff';
  const comment = getCSSVar('--editor-comment') || '#6a9955';
  const keyword = getCSSVar('--editor-keyword') || '#c586c0';
  const func = getCSSVar('--editor-function') || '#dcdcaa';
  const variable = getCSSVar('--editor-variable') || '#9cdcfe';
  const number = getCSSVar('--editor-number') || '#b5cea8';
  const string = getCSSVar('--editor-string') || '#ce9178';
  const operator = getCSSVar('--editor-operator') || '#d4d4d4';

  // Determine base theme based on background luminance
  const baseTheme = isLightColor(editorBg) ? 'vs' : 'vs-dark';

  return {
    base: baseTheme,
    inherit: true,
    rules: [
      { token: 'comment', foreground: hexToMonaco(comment), fontStyle: 'italic' },
      { token: 'keyword', foreground: hexToMonaco(keyword) },
      { token: 'support.function', foreground: hexToMonaco(func) },
      { token: 'variable.predefined', foreground: hexToMonaco(variable), fontStyle: 'bold' },
      { token: 'number', foreground: hexToMonaco(number) },
      { token: 'number.float', foreground: hexToMonaco(number) },
      { token: 'string', foreground: hexToMonaco(string) },
      { token: 'operator', foreground: hexToMonaco(operator) },
      { token: 'identifier', foreground: hexToMonaco(variable) },
      { token: 'delimiter', foreground: hexToMonaco(operator) },
    ],
    colors: {
      'editor.background': editorBg,
      'editor.foreground': editorFg,
      'editor.lineHighlightBackground': lineHighlight,
      'editor.selectionBackground': selection,
      'editorCursor.foreground': cursor,
      'editorLineNumber.foreground': lineNumber,
      'editorLineNumber.activeForeground': lineNumberActive,
      'editorIndentGuide.background': lineNumber,
      'editorIndentGuide.activeBackground': lineNumberActive,
      'editor.selectionHighlightBackground': selection + '66',
      'editorBracketMatch.background': selection + '44',
      'editorBracketMatch.border': cursor,
    },
  };
}

interface CodeEditorProps {
  onCompile?: () => void;
}

export function CodeEditor({ onCompile }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const compileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeVersionRef = useRef(0);
  
  const {
    code,
    setCode,
    editorSettings,
    pendingMutations,
    selectedMutation,
    themeConfig,
  } = useForgeStore();
  
  // Get preview code (show mutation preview if selected)
  const displayCode = selectedMutation
    ? pendingMutations.find(m => m.id === selectedMutation)?.proposedCode ?? code
    : code;
  
  // Update Monaco theme when app theme changes
  const updateMonacoTheme = useCallback(() => {
    if (!monacoRef.current) return;
    
    // Increment theme version to create unique theme name
    themeVersionRef.current += 1;
    const themeName = `scad-forge-dynamic-${themeVersionRef.current}`;
    
    // Create and apply the dynamic theme
    const dynamicTheme = createDynamicTheme();
    monacoRef.current.editor.defineTheme(themeName, dynamicTheme);
    monacoRef.current.editor.setTheme(themeName);
  }, []);
  
  // React to theme changes
  useEffect(() => {
    // Small delay to ensure CSS variables are updated
    const timer = setTimeout(() => {
      updateMonacoTheme();
    }, 50);
    return () => clearTimeout(timer);
  }, [themeConfig.preset, updateMonacoTheme]);
  
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Register OpenSCAD language
    monaco.languages.register({ id: 'openscad' });
    monaco.languages.setMonarchTokensProvider('openscad', OPENSCAD_LANGUAGE_DEF as any);
    
    // Create and apply dynamic theme based on CSS variables
    const dynamicTheme = createDynamicTheme();
    monaco.editor.defineTheme('scad-forge-dynamic-0', dynamicTheme);
    monaco.editor.setTheme('scad-forge-dynamic-0');
    
    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onCompile?.();
    });
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Trigger compile on save
      onCompile?.();
    });
    
    // Focus editor
    editor.focus();
  }, [onCompile]);
  
  const handleChange: OnChange = useCallback((value) => {
    if (value !== undefined && !selectedMutation) {
      setCode(value);
      
      // Auto-compile with debounce
      if (editorSettings.autoCompile) {
        if (compileTimerRef.current) {
          clearTimeout(compileTimerRef.current);
        }
        compileTimerRef.current = setTimeout(() => {
          onCompile?.();
        }, editorSettings.compileDelay);
      }
    }
  }, [setCode, editorSettings.autoCompile, editorSettings.compileDelay, onCompile, selectedMutation]);
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (compileTimerRef.current) {
        clearTimeout(compileTimerRef.current);
      }
    };
  }, []);
  
  return (
    <div className="code-editor">
      <div className="editor-header">
        <span className="editor-title">
          <span className="file-icon">◇</span>
          model.scad
          {selectedMutation && <span className="preview-badge">PREVIEW</span>}
        </span>
      </div>
      
      <Editor
        height="100%"
        language="openscad"
        value={displayCode}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          fontSize: editorSettings.fontSize,
          minimap: { enabled: editorSettings.minimap },
          wordWrap: editorSettings.wordWrap ? 'on' : 'off',
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          readOnly: !!selectedMutation,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          fontLigatures: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          padding: { top: 16 },
        }}
        theme="scad-forge"
      />
    </div>
  );
}
