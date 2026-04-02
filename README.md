<div align="center">

# WIGSS

> Drag your UI components — the source code rewrites itself.

[![npm version](https://img.shields.io/npm/v/wigss?style=flat-square)](https://npmjs.com/package/wigss)
[![npm downloads](https://img.shields.io/npm/dm/wigss?style=flat-square)](https://npmjs.com/package/wigss)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](./LICENSE)

<!-- TODO: Add terminal demo GIF here (recommended: vhs or asciinema) -->

[한국어 (Korean)](README.ko.md) | **English**

</div>

---

## Quick Start

```bash
cd my-project
npm run dev                          # Your dev server on port 3000

# In another terminal:
npx wigss@latest --port <your-port-number>         # Prompts for API key, then opens browser
```

Or try the built-in demo (no existing project needed):

```bash
npx wigss@latest --demo
```

> If you've previously installed `wigss` globally, run `npm uninstall -g wigss` first to ensure npx always uses the latest version.

---

## What is WIGSS?

**WIGSS** (Style Shaper) is a visual code refactoring tool with an always-on AI agent. Frontend developers can visually **drag and resize UI components** on their live web page, and WIGSS **automatically rewrites the source code** to match.

No Figma-to-code. No CSS guessing. Just drag it — the code changes.

### The Problem

AI coding agents (Cursor, Claude Code, Trae) can scaffold UI fast. But **fine-tuning the design** is still painful:

- "Make this card a bit wider" — hard to describe precisely in words
- CSS tweaking → refresh → check → repeat — slow and tedious
- No designer available — developers do it alone

---

## How to Use

### 1. Scan

Hover the top arrow tab to reveal the toolbar. Click **Scan** — the AI detects all UI components on the page and labels them (Navbar, Card, Footer, etc.).

### 2. Browse & Select

Use the **Component Tag Bar** (top-left toggle) to browse all detected components. Each tag shows the component type, name, and a text preview so you know exactly what you're selecting. Hover a tag to highlight it on the canvas.

### 3. Edit

1. **Click** any component tag or overlay to select it
2. **Drag** to move, **handles** to resize (8-directional)
3. AI gives **real-time feedback** in the side panel ("8px misaligned — fix it?")
4. **Chat** with AI — "how should I fix the footer?" or just ask freely

### 4. Save

Click **Save** — WIGSS generates code diffs across 4 CSS strategies and applies them to source files. The iframe reloads automatically.

---

## CSS Strategy Support

WIGSS automatically detects which CSS approach your project uses and generates the right code:

| Strategy | Detection | Example |
|----------|-----------|---------|
| **Tailwind CSS** | Utility class patterns in className | `className="flex h-48 w-64"` |
| **CSS Modules** | `import styles from './X.module.css'` | `className={styles.card}` |
| **Plain CSS** | Class found in `.css`/`.scss` files | `.hero { height: 400px; }` |
| **Inline Styles** | Fallback for any React component | `style={{ height: '300px' }}` |

---

## CLI

```bash
npx wigss@latest [options]
```

| Flag                  | Default | Description                                      |
| --------------------- | ------- | ------------------------------------------------ |
| `-p, --port <port>`   | `3000`  | Target dev server port                           |
| `--wigss-port <port>` | `4000`  | WIGSS editor port                                |
| `--key <key>`         | —       | OpenAI API key (or set `OPENAI_API_KEY` env var) |
| `--demo`              | —       | Run with built-in demo page (no project needed)  |
| `-V, --version`       | —       | Show version                                     |

If no `--key` is provided and `OPENAI_API_KEY` is not set, WIGSS will **prompt interactively**.

---

## How It Works

1. Runs a Next.js editor on port 4000 that wraps your dev server in an iframe (full viewport width)
2. Software-based DOM scan detects components via postMessage and maps them to source files
3. An overlay renders draggable/resizable boxes aligned to each component (60fps via requestAnimationFrame)
4. Drag/resize events stream over WebSocket to the AI agent
5. On Save, multi-strategy CSS refactoring (Tailwind/CSS Module/Plain CSS/Inline) generates targeted diffs

---

## AI Agent: 5 Autonomous Actions

| #   | Action                  | Model   | Trigger                                  |
| --- | ----------------------- | ------- | ---------------------------------------- |
| 1   | **Component Detection** | GPT-4o  | After Scan                               |
| 2   | **Design Suggestions**  | GPT-4o  | After detection (with confidence scores) |
| 3   | **Real-time Feedback**  | GPT-4o  | After drag/resize                        |
| 4   | **Chat Consultation**   | GPT-4o  | User question or delegation              |
| 5   | **Code Refactoring**    | Direct multi-strategy CSS mapping | On Save              |

### Why "Agent" Not "Tool"

|               | Typical AI Tool           | WIGSS Agent                       |
| ------------- | ------------------------- | --------------------------------- |
| Initiative    | Waits for commands        | Proactively suggests improvements |
| Scope         | Single action per request | Multi-step autonomous pipeline    |
| Communication | Request → Response        | Always-on WebSocket               |
| Result        | Generated text            | Source files actually modified    |

---

## Requirements

- Node.js 18+
- OpenAI API key (for GPT-4o analysis and suggestions)
- A running dev server (React/Next.js recommended)

---

## Architecture

```
Browser (localhost:4000)
├── Floating Toolbar (hover-reveal, hidden by default)
│   └── [Scan] [Save] [Mobile] [Undo/Redo]
├── Component Tag Bar (toggle, top-left)
│   └── Clickable tags with type colors + text hints
├── Visual Editor (full viewport)
│   ├── iframe (your live page — full width, read-only)
│   └── Overlay (draggable/resizable boxes, 60fps)
└── Agent Panel (hover-reveal, right edge)
    ├── Real-time Feedback  → [Apply]
    ├── AI Suggestions      → [Apply] [Dismiss]
    └── Chat

    WebSocket (always connected, event-driven)
    ▼
WIGSS Agent (Node.js)
├── OpenAI GPT-4o  — suggestions, feedback, chat
├── Multi-strategy CSS refactoring
│   ├── Tailwind class mapping (TW_MAP)
│   ├── CSS Module via PostCSS AST
│   ├── Plain CSS via PostCSS AST
│   └── Inline style via Babel AST
└── fs             — source file read/write
```

### Data Flow

```
[1] Scan
    Toolbar → ws.send('scan')
                      │
                ws-server.ts (origin check + rate limit)
                      │
                agent-loop.ts (queued via mutex)
                  └─ ws.send('components_detected')
                      │
                AgentStore → iframe.postMessage('wigss-scan-request')
                      │
                iframe (your dev server)
                  └─ DOM traversal → RawScanElement[]
                  └─ postMessage('wigss-scan-result')
                      │
[2] Detect
    VisualEditor.tsx
      └─ component-detector.ts (pure software — no AI)
          ├─ Semantic tagging (nav, header, footer)
          ├─ Flex/grid layout analysis
          ├─ Repeated sibling detection (card grids)
          ├─ fullClassName extraction
          └─ textHint extraction (for component identification)
                      │
                EditorStore.setComponents()
                ws.send('components_synced')
                      │
                openai-client.ts → suggestImprovements()
                  └─ GPT-4o (function calling)
                  └─ ws.send('suggestion')

[3] Edit (drag/resize)
    VisualEditor: handleMouseMove (requestAnimationFrame, 60fps)
      ├─ EditorStore.setState() → visual update
      └─ iframe.postMessage('wigss-live-style') → live preview (move only)
    handleMouseUp
      ├─ EditorStore.applyChange() → history (max 50)
      └─ ws.send('drag_end' | 'resize_end')
                      │
                openai-client.ts → provideFeedback()
                  └─ GPT-4o → ws.send('feedback')

[4] Save
    Toolbar
      ├─ POST /api/refactor {changes, components, projectPath}
      │     └─ refactor-client.ts → dispatchRefactor()
      │         ├─ css-strategy-detector.ts → detect strategy
      │         ├─ tailwind-strategy.ts (Tailwind class mapping)
      │         ├─ css-module-strategy.ts (PostCSS AST)
      │         ├─ plain-css-strategy.ts (PostCSS AST)
      │         ├─ inline-style-strategy.ts (Babel AST)
      │         └─ Returns CodeDiff[] with line numbers
      │
      └─ POST /api/apply {diffs, projectPath}
            ├─ Path traversal prevention
            ├─ Diff validation (className/style only, no JS changes)
            └─ fs.writeFile → source modified

[5] Reload
    iframe.reload() → auto re-scan after 3s
```

### Dependency Map

| Layer | Technology | Role |
|-------|-----------|------|
| Entry | `bin/cli.js` (commander) | CLI parsing, env setup, starts Next.js |
| Init | `instrumentation.ts` | Starts WS server + agent on boot |
| Realtime | `ws` (port 4001) | Bidirectional event streaming |
| AI | `openai` → GPT-4o | Suggestions, feedback, chat (function calling) |
| Refactor | `refactor-client.ts` | Multi-strategy CSS refactoring (no AI) |
| AST | `@babel/parser` + `postcss` | JSX/CSS parsing for precise code modification |
| State | `zustand` (2 stores) | editor-store + agent-store |
| Framework | `next` (App Router) | SSR + API routes + static pages |

---

## Limitations

- **React JSX only** — Vue, Svelte, Angular are not yet supported
- **Simple CSS selectors** — Compound selectors (`.card.active`) and pseudo-selectors (`:hover`) have basic support
- **WebSocket security** — Origin validation + rate limiting only (no token auth)
- **Single-user** — Designed for local development, not collaborative editing

---

## Contributing

Pull requests are welcome! Please open an issue first to discuss what you'd like to change.

---

## License

[Apache 2.0](./LICENSE) © Team WIGSS (WIGTN Crew)

---

<div align="center">

**Built for the Trae.ai Hackathon 2026 — Theme: "Agent"**

</div>
