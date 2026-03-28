<div align="center">

# WIGSS

> Drag your UI components — the source code rewrites itself.

[![npm version](https://img.shields.io/npm/v/wigss?style=flat-square)](https://npmjs.com/package/wigss)
[![npm downloads](https://img.shields.io/npm/dm/wigss?style=flat-square)](https://npmjs.com/package/wigss)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

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

Click **Scan** — the AI detects all UI components on the page and labels them (Navbar, Card, Footer, etc.).

### 2. Edit

1. **Click** any component to select it
2. **Drag** to move, **handle** to resize
3. AI gives **real-time feedback** in the panel ("8px misaligned — fix it?")
4. **Chat** with AI — "how should I fix the footer?" or just "알아서 해줘"

### 3. Save

Click **Save** — AI generates Tailwind diffs → applies to source files → iframe reloads automatically.

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

1. Runs a Next.js editor on port 4000 that wraps your dev server in an iframe
2. Playwright scans the live DOM and maps components to their source files
3. A fabric.js overlay renders draggable/resizable boxes aligned to each component
4. Drag/resize events stream over WebSocket to the AI agent
5. On Save, GPT-5.4 generates a targeted Tailwind diff and `fs` applies it directly to source

---

## AI Agent: 5 Autonomous Actions

| #   | Action                  | Model   | Trigger                                  |
| --- | ----------------------- | ------- | ---------------------------------------- |
| 1   | **Component Detection** | GPT-4o  | After Scan                               |
| 2   | **Design Suggestions**  | GPT-4o  | After detection (with confidence scores) |
| 3   | **Real-time Feedback**  | GPT-4o  | After drag/resize                        |
| 4   | **Chat Consultation**   | GPT-4o  | User question or delegation              |
| 5   | **Code Refactoring**    | GPT-5.4 | On Save                                  |

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
- OpenAI API key (Tier 3+ recommended for GPT-5.4 access)
- A running dev server (React/Next.js + Tailwind recommended)

---

## Architecture

```
Browser (localhost:4000)
├── Floating Toolbar [Scan] [Save] [Mobile] [Undo/Redo]
├── Visual Editor
│   ├── iframe (your live page — read-only background)
│   └── Overlay (draggable/resizable component boxes)
└── Agent Panel
    ├── Real-time Feedback  → [Apply]
    ├── AI Suggestions      → [Apply] [Dismiss]
    └── Chat

    WebSocket (always connected, event-driven)
    ▼
WIGSS Agent (Node.js)
├── OpenAI GPT-4o  — detection, suggestions, feedback, chat
├── OpenAI GPT-5.4 — Tailwind code refactoring
├── Playwright     — DOM scanning (headless Chromium)
└── fs             — source file read/write (with .bak backup)
```

---

## Contributing

Pull requests are welcome! Please open an issue first to discuss what you'd like to change.

---

## License

[MIT](./LICENSE) © Team WIGSS (WIGTN Crew)

---

<div align="center">

**Built for the Trae.ai Hackathon 2026 — Theme: "Agent"**

</div>
