import { useRef, useEffect, useCallback } from 'react';
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
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

// Monaco theme for SCAD Forge
const SCAD_FORGE_THEME: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'C586C0' },
    { token: 'support.function', foreground: 'DCDCAA' },
    { token: 'variable.predefined', foreground: '9CDCFE', fontStyle: 'bold' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'number.float', foreground: 'B5CEA8' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'operator', foreground: 'D4D4D4' },
    { token: 'identifier', foreground: '9CDCFE' },
  ],
  colors: {
    'editor.background': '#0d0d1a',
    'editor.foreground': '#D4D4D4',
    'editor.lineHighlightBackground': '#1a1a2e',
    'editor.selectionBackground': '#264F78',
    'editorCursor.foreground': '#00d9ff',
    'editorLineNumber.foreground': '#4a4a6a',
    'editorLineNumber.activeForeground': '#00d9ff',
  },
};

interface CodeEditorProps {
  onCompile?: () => void;
}

export function CodeEditor({ onCompile }: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const compileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const {
    code,
    setCode,
    editorSettings,
    pendingMutations,
    selectedMutation,
  } = useForgeStore();
  
  // Get preview code (show mutation preview if selected)
  const displayCode = selectedMutation
    ? pendingMutations.find(m => m.id === selectedMutation)?.proposedCode ?? code
    : code;
  
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    
    // Register OpenSCAD language
    monaco.languages.register({ id: 'openscad' });
    monaco.languages.setMonarchTokensProvider('openscad', OPENSCAD_LANGUAGE_DEF as any);
    
    // Register custom theme
    monaco.editor.defineTheme('scad-forge', SCAD_FORGE_THEME);
    monaco.editor.setTheme('scad-forge');
    
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
        <div className="editor-actions">
          <button
            className="action-btn compile-btn"
            onClick={onCompile}
            title="Compile (Ctrl+Enter)"
          >
            ▶ Render
          </button>
        </div>
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
