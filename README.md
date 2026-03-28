<div align="center">

# WIGSS

### Style Shaper — Visual Code Refactoring with AI Agents

**Drag your components. Your code follows.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o_+_5.4-412991?style=for-the-badge&logo=openai&logoColor=white)](https://platform.openai.com/)
[![Playwright](https://img.shields.io/badge/Playwright-Locator-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

[Korean (한국어)](README.ko.md) | **English**

</div>

---

## What is WIGSS?

WIGSS is a **visual code refactoring tool** powered by an always-on AI agent. Frontend developers can **visually drag and resize UI components** on their live web page, and WIGSS **automatically rewrites the source code** to match.

No Figma-to-code. No CSS guessing. Just drag it — the code changes.

## The Problem

AI coding agents (Cursor, Claude Code, Trae) can scaffold UI fast. But **fine-tuning the design** is still painful:

- "Make this card a bit wider" — hard to describe precisely in words
- CSS tweaking → refresh → check → repeat — slow and tedious
- No designer available — developers do it alone

## The Solution

```bash
npx wigss --port 3000
# That's it. One command.
```

WIGSS opens your live dev page with an **editing overlay**. Click a component, drag to resize, save — the AI rewrites your Tailwind classes automatically.

---

## Quick Start

### 1. Run

```bash
cd my-project
npm run dev                        # Your dev server on port 3000

# In another terminal:
npx wigss --port 3000              # WIGSS asks for OpenAI API key, then opens browser
```

Or with key inline:
```bash
npx wigss --port 3000 --key sk-proj-...
```

Or try the demo (no existing project needed):
```bash
npx wigss --demo
```

### 2. Edit

1. Click **Scan** — AI detects all UI components
2. **Click** any component to select it
3. **Drag** to move, **handle** to resize
4. AI gives **real-time feedback** ("8px misaligned", "too small")
5. **Chat** with AI — "how should I fix the footer?"

### 3. Save

Click **Save** — AI generates Tailwind diffs → applies to source → iframe reloads → done.

---

## Architecture

```
Browser (localhost:4000)
├── Floating Toolbar [Scan] [Save] [Mobile] [Undo/Redo]
├── Visual Editor
│   ├── iframe (your live page — read-only background)
│   └── Overlay (draggable/resizable component boxes)
├── Agent Panel
│   ├── Real-time Feedback ("카드 높이 60px 차이" → [바로 적용])
│   ├── AI Suggestions ("간격 불균일 90%" → [적용] [무시])
│   └── Chat ("푸터 어떻게 해?" → AI 분석 + 수정 계획)
│
│   WebSocket (always connected, event-driven)
│   ▼
WIGSS Agent (Node.js)
├── OpenAI GPT-4o — detection, suggestions, feedback, chat
├── OpenAI GPT-5.4 — Tailwind code refactoring
├── Playwright — DOM scanning (headless Chromium)
└── fs — source file read/write (with .bak backup)
```

## AI Agent: 5 Autonomous Actions

| # | Action | Model | Trigger |
|---|--------|-------|---------|
| 1 | **Component Detection** | GPT-4o | After Scan — "이건 Navbar, 이건 Card Grid" |
| 2 | **Design Suggestions** | GPT-4o | After detection — "카드 간격 16px/24px 불균일 (90%)" |
| 3 | **Real-time Feedback** | GPT-4o | After drag/resize — "60px 차이, 맞출까요?" |
| 4 | **Chat Consultation** | GPT-4o | User asks — "푸터 어떻게?" / "알아서 해줘" |
| 5 | **Code Refactoring** | GPT-5.4 | On Save — `h-16→h-12`, `mt-2→mt-0` in source files |

### Why "Agent" Not "Tool"

| | Typical AI Tool | WIGSS Agent |
|--|----------------|-------------|
| Initiative | Waits for commands | Proactively suggests improvements |
| Scope | Single action per request | Multi-step autonomous pipeline |
| Communication | Request → Response | Always-on WebSocket |
| Result | Generated text | Source files actually modified |

---

## Features

### Visual Editing
- Click to select → drag to move → handle to resize
- Background layers auto-detected → click passes through to smaller components
- Undo/Redo support
- 1280px fixed viewport (matches scan coordinates precisely)

### AI Agent (Always-On WebSocket)
- Event-driven (no polling — zero cost while idle)
- Component detection with `data-component` attribute → source file mapping
- Suggestions with confidence scores + hover highlight
- Korean language responses with specific px values

### Source Code Refactoring
- One-click Save (generate + apply in single step)
- Tailwind-aware — changes CSS classes, never JS logic
- Safe: rejects diffs that modify unrelated code (SVG, event handlers)
- Auto backup (`.bak` files) before modification
- Auto iframe reload + re-scan after save

### Chat
- Ask advice, delegate tasks, give instructions
- "알아서 해줘" → AI proposes plan → confirm → auto-modify overlays

---

## CLI

```bash
npx wigss [options]

  -p, --port <port>       Target dev server port (default: 3000)
  --wigss-port <port>     WIGSS editor port (default: 4000)
  --key <key>             OpenAI API key
  --demo                  Run with built-in demo page
  -V, --version           Show version
```

If no `--key` is provided and `OPENAI_API_KEY` env var is not set, WIGSS will **prompt interactively**.

---

## Requirements

- Node.js 18+
- OpenAI API key (Tier 3+ recommended for GPT-5.4)
- A running dev server (React/Next.js + Tailwind recommended)

## License

MIT

---

<div align="center">

**Built by Team WIGSS (WIGTN Crew) for the Trae.ai Hackathon 2026**

*Theme: "Agent"*

</div>
