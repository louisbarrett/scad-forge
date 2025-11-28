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
│                 OpenSCAD Engine (Abstracted)                 │
│   - Mock engine (current) - approximate geometry             │
│   - WASM engine (ready to integrate) - real OpenSCAD        │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Editor
- Monaco-based code editor with OpenSCAD syntax highlighting
- Custom "scad-forge" dark theme
- Auto-compile on edit (debounced)
- Ctrl+Enter to force compile

### 3D Viewer
- Three.js rendering with orbit controls
- Wireframe/Grid/Axes toggles
- Auto-rotate mode
- **📷 Capture button** - screenshots the view + code for VLM analysis

### 💬 LLM Chat Interface (NEW)
- **Conversational AI assistant** for modifying 3D models
- **OpenAI-compatible API** - works with Ollama (default), OpenAI, Together AI, or any compatible endpoint
- **Streaming responses** - see the LLM thinking in real-time
- **Context-aware** - automatically includes your current code
- **Vision support** - attach scene captures for visual analysis
- **Code extraction** - automatically detects OpenSCAD code blocks
- **One-click mutations** - propose LLM suggestions as code changes
- **Settings panel** with:
  - Quick presets (Ollama, OpenAI, Together AI)
  - Custom API endpoint configuration
  - Model selection
  - Temperature and max tokens control

### Mutation System (Git-Like)
- LLM can propose code mutations
- Each mutation shows:
  - Description
  - Diff preview (additions/deletions highlighted)
  - Confidence score
  - Reasoning
- Accept or reject mutations individually
- Full undo/redo history

### VLM Interface (Capture)
- Capture scene (image + code + camera position)
- Add prompt describing desired change
- Generates API payload for Anthropic Claude
- Receives mutations back into the mutation panel

## Workflow

### Chat-Based Workflow (Recommended)
1. **Open Chat** - Click the 💬 Chat tab
2. **Type your request** - e.g., "Add fillets to all edges" or "Make this design more compact"
3. **Include context** - Toggle "Include Code" (default on) and optionally "Include Image"
4. **Send** - Press Enter or click Send
5. **Review response** - LLM explains and provides modified code
6. **Apply changes** - Click "⚡ Propose as Mutation" to add to mutation queue
7. **Accept/Reject** - Review and apply in the Mutations panel

### Classic VLM Workflow
1. **Edit code** in the Monaco editor
2. **Preview** updates in 3D viewer (auto-compile or Ctrl+Enter)
3. **Capture** scene with camera button
4. **Send to VLM** with a prompt like "add mounting holes" or "make it more compact"
5. **Review mutation** in the Mutations panel
6. **Accept/Reject** - accepted changes go into history
7. **Undo/Redo** any point in history

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

SCAD Forge uses Ollama by default for local LLM inference.

```bash
# Install Ollama (macOS)
brew install ollama

# Start Ollama server
ollama serve

# Pull a vision-capable model (recommended)
ollama pull llama3.2-vision

# Or use llava for vision support
ollama pull llava
```

### Using Other Providers

Click the ⚙️ button in the Chat panel to configure:

| Provider | Base URL | Notes |
|----------|----------|-------|
| Ollama (Local) | `http://localhost:11434/v1` | Free, private, no API key |
| OpenAI | `https://api.openai.com/v1` | Requires API key |
| Together AI | `https://api.together.xyz/v1` | Requires API key |
| Custom | Any OpenAI-compatible endpoint | Configure as needed |

## AZAI Fabrication Profile

The default code includes your fabrication constants:

- **Print Volume**: 220 × 220 × 220mm (Adventurer 5M Pro)
- **Laser Bed**: 400 × 400mm
- **Tolerances**: clearance_loose (0.4mm), clearance_press (0.15mm)
- **Fasteners**: M3 clearance (3.4mm), heat-set insert (4.0mm)

## OpenSCAD Engine

Currently uses a **mock engine** that:
- Parses code for variable extraction
- Detects primitives (cube, sphere, cylinder)
- Generates approximate preview geometry

The WASM engine interface is ready - to enable real OpenSCAD:
1. Download openscad-wasm from releases
2. Implement `WASMOpenSCADEngine.compile()`
3. Replace `MockOpenSCADEngine` in `getEngine()`

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
│   └── openscad.ts      # Engine abstraction + mock impl
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

- [ ] Real OpenSCAD WASM integration
- [ ] STL export
- [x] ~~Direct Claude API integration~~ → Now supports any OpenAI-compatible API
- [x] ~~LLM Chat interface~~ → Interactive chat for code modifications
- [ ] Multi-file project support
- [ ] Parameter sliders for variables
- [ ] Collaborative editing
- [ ] Export mutation history as git repo
- [ ] Voice input for chat commands
- [ ] Multi-turn conversation memory optimization

---

Built for the AI-assisted CAD workflow. Break the wall between design and physical product.
