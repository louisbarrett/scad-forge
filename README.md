# SCAD Forge

**VLM-Powered OpenSCAD IDE with Git-Like Mutation Control**

A visual OpenSCAD editor built for the AI-assisted design workflow. Edit code, preview 3D geometry in real-time, and accept/reject LLM-proposed mutations with full version history.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        SCAD Forge                            │
├──────────────────┬──────────────────┬───────────────────────┤
│   Monaco Editor  │   Three.js View  │    Side Panels        │
│   (OpenSCAD)     │   (3D Preview)   │    - 💬 LLM Chat      │
│                  │                  │    - ⚡ Mutations     │
│                  │                  │    - ⟲ History        │
│                  │                  │    - 📷 Capture       │
├──────────────────┴──────────────────┴───────────────────────┤
│                    Zustand State Store                       │
│   - Code + history (git-like patches)                        │
│   - Chat messages + LLM configuration                        │
│   - Pending LLM mutations                                    │
│   - Render results                                           │
├─────────────────────────────────────────────────────────────┤
│              LLM Service (OpenAI-Compatible API)             │
│   - Ollama (default) - local LLMs                            │
│   - OpenAI, Together AI, or any compatible endpoint         │
├─────────────────────────────────────────────────────────────┤
│                 OpenSCAD Engine (WASM)                       │
│   - Real OpenSCAD WASM engine - accurate geometry           │
│   - STL export support                                      │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Editor
- **Monaco Editor** with OpenSCAD syntax highlighting
- **15+ theme presets** - Dark, Light, and High-Contrast themes (Cyberpunk, Midnight, Aurora, Ember, Forest, Ocean, Nord, Dracula, Monokai, Tokyo Night, Solarized Light, Paper, Daybreak, Sepia, Matrix, Terminal, and more)
- **Theme-aware editor colors** - Syntax highlighting adapts to selected theme
- **Auto-compile on edit** - Debounced compilation (1.5s delay)
- **Manual compile** - Ctrl+Enter to force compile
- **Resizable panels** - Drag handles to adjust editor/viewer/side panel sizes
- **Collapsible editor** - Hide editor for full-screen 3D view
- **Persistent settings** - Panel sizes and editor state saved to localStorage

### 3D Viewer
- **Three.js rendering** with smooth orbit controls
- **Gizmo helper** - Viewport navigation aids
- **Wireframe toggle** - View geometry edges
- **Flat/Matte shading toggle** - Switch between smooth and faceted rendering
- **Grid toggle** - Show/hide reference grid
- **Axes toggle** - Display coordinate axes
- **Auto-rotate mode** - Continuous rotation for presentations
- **Theme-aware colors** - Model and grid colors adapt to selected theme
- **📷 Capture button** - Screenshot view + code + camera position for VLM analysis
- **Error display** - Compilation errors shown with auto-fade
- **Cancel compilation** - Escape key or button to stop long-running renders

### 💬 LLM Chat Interface
- **Conversational AI assistant** for modifying 3D models
- **Dual-model architecture** - Separate planning and vision models for optimal code generation
  - Planning model: Optimized for code generation (default: `qwen2.5-coder:14b`)
  - Vision model: Analyzes images and 3D scenes (default: `llama3.2-vision`)
- **OpenAI-compatible API** - Works with multiple providers:
  - Ollama (default) - Local, free, private
  - OpenAI - GPT-4o, GPT-4, GPT-3.5-turbo
  - Together AI - Llama, Qwen, DeepSeek models
  - Groq - Fast inference with Llama, Mixtral, Gemma
  - X.AI (Grok) - Grok-2 vision models
  - Custom endpoints - Any OpenAI-compatible API
- **Streaming responses** - See the LLM thinking in real-time
- **Context-aware** - Automatically includes:
  - Current code (toggleable)
  - Scene captures (toggleable)
  - System errors/warnings (toggleable)
- **Vision support** - Two-step vision → planning pipeline:
  1. Vision model analyzes the 3D scene image
  2. Planning model generates code based on analysis
- **Code extraction** - Automatically detects OpenSCAD code blocks from responses
- **Auto-apply** - Optionally apply code changes automatically
- **Auto-render** - Optionally trigger recompilation after code changes
- **Settings panel** with:
  - Provider presets with quick configuration
  - Per-provider API key management
  - Model selection per task type (planning/vision/chat)
  - Temperature and max tokens control
  - Model list fetching from provider APIs

### Mutation System (Git-Like)
- LLM can propose code mutations
- Each mutation shows:
  - Description
  - Diff preview (additions/deletions highlighted)
  - Confidence score
  - Reasoning
- Accept or reject mutations individually
- Full undo/redo history

### 🔧 Auto-Fix Feature
- **Automatic error fixing** - LLM attempts to fix compilation errors automatically
- **Configurable** - Enable/disable via header button
- **Smart protection** - Won't overwrite user edits made during fix attempts
- **Max attempts limit** - Prevents infinite loops (default: 3 attempts)
- **Visual feedback** - Shows fix attempts in chat with progress indicators
- **Error analysis** - Uses specialized error-fixing prompts for better results

### 📁 File Import/Export
- **STL Export** - Export your designs as STL files for 3D printing
- **File Import** - Import external files for use in OpenSCAD:
  - STL files (3D models)
  - OBJ files (3D models)
  - DXF files (2D drawings)
  - SVG files (vector graphics)
  - PNG/JPG images (textures/patterns)
- **Persistent storage** - Imported files saved to IndexedDB across sessions
- **Import panel** - Manage imported files with click-to-insert import statements
- **File management** - Remove individual files or clear all imports

### 🖥️ System Console
- **Error tracking** - Collects OpenSCAD compilation errors and warnings
- **Expandable console** - Click to view detailed system messages
- **Message filtering** - See errors, warnings, and info messages separately
- **Auto-fade errors** - Errors automatically fade after 8 seconds
- **Message counts** - Quick indicator showing error/warning counts
- **Source tracking** - Messages tagged by source (OpenSCAD, import, export, etc.)

### 🎨 Theme System
- **15+ theme presets** organized by category:
  - Dark themes: Cyberpunk, Midnight, Aurora, Ember, Forest, Ocean, Nord, Dracula, Monokai, Tokyo Night
  - Light themes: Solarized Light, Paper, Daybreak, Sepia
  - High-contrast: High Contrast Dark, High Contrast Light, Matrix, Terminal
- **Theme-aware 3D viewer** - Model colors, grid, and background adapt to theme
- **Theme-aware editor** - Syntax highlighting colors match theme
- **Persistent selection** - Theme preference saved across sessions

## Workflow

### Chat-Based Workflow (Recommended)
1. **Open Chat** - Click the 💬 Chat tab
2. **Configure LLM** - Click ⚙️ to set up your provider and models
3. **Type your request** - e.g., "Add fillets to all edges" or "Make this design more compact"
4. **Include context** - Toggle options:
   - **Code** (default on) - Include current OpenSCAD code
   - **Image** - Auto-capture 3D view and include in request
   - **Errors** - Include recent compilation errors/warnings
5. **Send** - Press Enter or click Send
6. **Watch streaming** - See the LLM generate code in real-time
7. **Review response** - LLM explains and provides modified code in ```openscad blocks
8. **Apply changes** - Options:
   - **Auto-apply enabled**: Code automatically applied and compiled
   - **Manual**: Click "⚡ Apply Changes" button in code block
   - **Propose as Mutation**: Add to mutation queue for review
9. **Accept/Reject** - Review diffs in the Mutations panel if using mutations

### Vision-Enhanced Workflow
1. **Edit code** in the Monaco editor
2. **Preview** updates in 3D viewer (auto-compile or Ctrl+Enter)
3. **Enable Image** toggle in Chat panel
4. **Send request** - The system will:
   - Capture the current 3D view automatically
   - Send to vision model for analysis
   - Use planning model to generate code based on visual analysis
5. **Review** - See both the visual analysis and generated code
6. **Apply** - Use auto-apply or manual application

### Error-Fixing Workflow
1. **Compile code** - If errors occur, auto-fix attempts to resolve them
2. **Monitor progress** - Watch fix attempts in chat (if auto-fix enabled)
3. **Review fixes** - Auto-fix shows its reasoning and proposed changes
4. **Manual override** - Edit code during fix to prevent overwrite
5. **Disable if needed** - Toggle auto-fix off in header if preferred

### File Import Workflow
1. **Click Import** - Use the 📥 Import button in header
2. **Select files** - Choose STL, OBJ, DXF, SVG, or image files
3. **Files imported** - Automatically available to OpenSCAD engine
4. **Insert import** - Click file in import panel to insert `import("filename")` statement
5. **Manage files** - Remove individual files or clear all from import panel

## Quick Start

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## LLM Setup (Ollama - Default)

SCAD Forge uses Ollama by default for local LLM inference. The dual-model architecture works best with specialized models:

```bash
# Install Ollama (macOS)
brew install ollama

# Start Ollama server
ollama serve

# Pull recommended models for dual-model setup:
# Planning model (code generation)
ollama pull qwen2.5-coder:14b

# Vision model (image analysis)
ollama pull llama3.2-vision

# Alternative high-performance combination (works very well):
# Planning model - excellent for code generation
ollama pull gpt-oss:120b

# Vision model - strong visual analysis
ollama pull qwen3-vl

# Other alternative vision models:
# ollama pull llava
# ollama pull bakllava
```

**Note:** You can use the same model for both planning and vision if it supports vision (like `llama3.2-vision`), but using specialized models typically yields better results. The `gpt-oss:120b` + `qwen3-vl` combination works particularly well for high-quality code generation and visual analysis.

### Using Other Providers

Click the ⚙️ button in the Chat panel to configure:

| Provider | Base URL | Notes | Recommended Models |
|----------|----------|-------|---------------------|
| Ollama (Local) | `http://localhost:11434/v1` | Free, private, no API key | `qwen2.5-coder:14b` (planning), `llama3.2-vision` (vision)<br/>**Recommended:** `gpt-oss:120b` (planning) + `qwen3-vl` (vision) |
| OpenAI | `https://api.openai.com/v1` | Requires API key | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo` |
| Together AI | `https://api.together.xyz/v1` | Requires API key | `meta-llama/Llama-3.3-70B-Instruct-Turbo`, `Qwen/Qwen2.5-Coder-32B-Instruct` |
| Groq | `https://api.groq.com/openai/v1` | Requires API key | `llama-3.3-70b-versatile`, `mixtral-8x7b-32768` |
| X.AI (Grok) | `https://api.x.ai/v1` | Requires API key | `grok-2-vision-1212`, `grok-2-1212` |
| Custom | Any OpenAI-compatible endpoint | Configure as needed | Varies by provider |

**Dual-Model Setup:**
- **Planning Model**: Used for code generation (e.g., `qwen2.5-coder:14b`, `gpt-4o`)
- **Vision Model**: Used for image analysis (e.g., `llama3.2-vision`, `grok-2-vision-1212`)
- Both models can be the same if your provider supports vision in a single model

## AZAI Fabrication Profile

The default code includes your fabrication constants:

- **Print Volume**: 220 × 220 × 220mm (Adventurer 5M Pro)
- **Laser Bed**: 400 × 400mm
- **Tolerances**: clearance_loose (0.4mm), clearance_press (0.15mm)
- **Fasteners**: M3 clearance (3.4mm), heat-set insert (4.0mm)

## OpenSCAD Engine

Uses the **real OpenSCAD WASM engine** for accurate rendering:
- **Full OpenSCAD language support** - All CSG operations, modules, functions
- **Accurate 3D geometry generation** - Real OpenSCAD rendering, not approximations
- **STL export functionality** - Export designs for 3D printing
- **File import support** - Import STL, OBJ, DXF, SVG, and image files
- **Real-time compilation** - Compile on edit with debouncing
- **Error reporting** - Detailed error messages with line numbers
- **Compilation cancellation** - Cancel long-running renders
- **Font support** - Liberation font family bundled for text operations
- **Persistent file storage** - Imported files persist across sessions

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` / `Cmd+Enter` | Force compile/render |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Y` / `Cmd+Y` | Redo |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo (alternative) |
| `Esc` | Cancel compilation |

## Key Files

```
src/
├── App.tsx              # Main app layout
├── App.css              # Cyberpunk-industrial styling
├── store/
│   └── forgeStore.ts    # Zustand state management
├── services/
│   └── llm.ts           # LLM service (OpenAI-compatible API)
├── engine/
│   └── openscad.ts      # Engine abstraction + WASM implementation
├── components/
│   ├── CodeEditor.tsx   # Monaco editor
│   ├── Viewer.tsx       # Three.js 3D viewer
│   ├── ChatPanel.tsx    # LLM chat interface
│   ├── MutationPanel.tsx # LLM mutation acceptance
│   ├── HistoryPanel.tsx  # Git-like version history
│   └── VLMPanel.tsx     # Capture + VLM prompt interface
├── utils/
│   └── diff.ts          # Diff/patch utilities
└── types/
    └── index.ts         # TypeScript definitions
```

## Future Enhancements

- [x] ~~Real OpenSCAD WASM integration~~ → Fully integrated
- [x] ~~STL export~~ → Available via engine
- [x] ~~File import support~~ → STL, OBJ, DXF, SVG, images supported
- [x] ~~Direct Claude API integration~~ → Now supports any OpenAI-compatible API
- [x] ~~LLM Chat interface~~ → Interactive chat with streaming
- [x] ~~Dual-model architecture~~ → Separate planning and vision models
- [x] ~~Auto-fix feature~~ → Automatic error fixing with LLM
- [x] ~~Theme system~~ → 15+ themes with theme-aware components
- [x] ~~System console~~ → Error/warning tracking and display
- [x] ~~Auto-apply/auto-render~~ → Configurable automation options
- [ ] Multi-file project support
- [ ] Parameter sliders for variables
- [ ] Collaborative editing
- [ ] Export mutation history as git repo
- [ ] Voice input for chat commands
- [ ] Multi-turn conversation memory optimization
- [ ] Custom theme editor
- [ ] Export to other formats (OBJ, PLY, etc.)

---

Built for the AI-assisted CAD workflow. Break the wall between design and physical product.
