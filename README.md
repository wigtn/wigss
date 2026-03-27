<div align="center">

# WIGSS

### Style Shaper — Visual Code Refactoring with AI Agents

**Drag your components. Your code follows.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Claude API](https://img.shields.io/badge/Claude_API-Tool_Use-D97757?style=for-the-badge&logo=anthropic&logoColor=white)](https://docs.anthropic.com/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-Headless-40B5A4?style=for-the-badge&logo=puppeteer&logoColor=white)](https://pptr.dev/)
[![Zustand](https://img.shields.io/badge/Zustand-State-433E38?style=for-the-badge&logo=react&logoColor=white)](https://zustand-demo.pmnd.rs/)

[Korean (한국어)](README.ko.md) | **English**

</div>

---

## The Problem

In the age of AI, frontend developers increasingly build UIs without dedicated designers or publishers. You can throw together a layout in code, but **polishing it visually** is still painful:

- Edit CSS &rarr; refresh &rarr; check &rarr; edit again &rarr; repeat forever
- Adjusting spacing, sizing, and alignment across components in code is tedious
- There's no way to just *grab* a component and move it, then have your code update

## The Solution

WIGSS lets you **visually rearrange your live web page**, then **automatically rewrites your source code** to match.

No new code generated from scratch. Your existing codebase is refactored.

---

## How It Works

```
  Code it rough          AI detects            Drag & drop           Code updates
 ┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │  Developer   │────>│  Component   │────>│  Visual      │────>│  Source Code  │
 │  writes code │     │  Auto-detect │     │  Editor      │     │  Refactored   │
 └─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                        AI Agent #1                               AI Agent #4
                                            You drag stuff.
                                            Like a web builder.
```

## 5 Autonomous AI Agent Actions

| # | Agent Action | What It Does | AI Model |
|---|-------------|-------------|----------|
| **1** | **Component Auto-Detection** | Analyzes DOM, autonomously identifies Navbar, Card Grid, Sidebar etc. | GPT-4o |
| **2** | **Real-time Edit Feedback** | After each drag/resize: "8px misaligned", "card too small" — instant review | GPT-4o |
| **3** | **Chat Consultation** | "How should I fix the footer?" — analysis + suggestions. "Do it for me" — auto-modify with confirmation | GPT-4o |
| **4** | **Source Code Refactoring** | Maps visual changes to actual source files, generates precise diffs | Claude |
| **5** | **Self-Verification Loop** | Re-renders after refactoring, auto-fixes mismatches (up to 3 retries) | Claude |

> The agent doesn't just respond to commands. It **observes, suggests, acts, and verifies on its own.**

---

## Architecture

```
Browser (localhost:4000)
├── Floating Toolbar
├── Visual Editor (iframe + overlay)
│   └── Drag/resize overlays (actual page doesn't move)
├── Agent Panel
│   ├── Real-time Feedback [Apply] [Dismiss]
│   ├── Chat (ask / delegate / instruct)
│   └── Agent Log
│
│   WebSocket (always connected)
│   ▼
WIGSS Agent (Node.js, event-driven)
├── OpenAI GPT-4o — observe, detect, suggest, feedback, chat, responsive
├── Claude API — code refactoring, self-verification
├── Puppeteer — DOM scan, verification re-render
├── chokidar — file change detection
└── fs — source code read/write
```

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Framework** | Next.js 14 (App Router) | Full-stack, API Routes |
| **Language** | TypeScript | Type safety |
| **Styling** | Tailwind CSS | Rapid UI development |
| **Visual Editor** | iframe + overlay divs | Live page with draggable components |
| **Drag/Resize** | interact.js | Component manipulation |
| **State** | Zustand | Component state + change tracking |
| **AI** | Claude API (Tool Use) | Component detection + refactoring |
| **DOM Scan** | Puppeteer | Headless Chrome rendering |
| **File I/O** | Node.js fs | Source code read/write |

## Communication

| Channel | Purpose |
|---------|---------|
| `WebSocket /ws` | Always-on agent connection (scan, detect, suggest, feedback, chat, responsive, refactor, verify) |
| `POST /api/apply` | Apply diffs to source files (REST for safety — requires explicit user confirmation) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- A running dev server to scan (e.g., `localhost:3000`)

### Installation

```bash
git clone https://github.com/your-username/wigss.git
cd wigss
pnpm install
```

### Environment

```bash
cp .env.example .env.local
# Add your Anthropic API key
# ANTHROPIC_API_KEY=sk-ant-...
```

### Run

**Development mode:**
```bash
pnpm dev
```
Opens WIGSS editor on `localhost:3000` with demo-target on `localhost:3001`.

**Production usage (after npm publish):**
```bash
cd your-project
npx wigss --port 3000
```

---

## Demo Flow (3 minutes)

```
0:00  Problem intro
0:15  Scan → AI auto-detects components               ← Agent #1
0:40  AI suggests "card spacing is uneven" → Apply     ← Agent #2
1:00  Drag components + Mobile View auto-conversion    ← Agent #3
1:30  Save → AI generates source code diffs            ← Agent #4
2:15  Self-verification → auto-fix mismatch            ← Agent #5
2:40  "5 autonomous actions. You just drag."
```

---

## Why "Agent", Not "Tool"

| | Typical AI Tool | WIGSS Agent |
|--|----------------|--------------|
| **Initiative** | Waits for commands | Proactively suggests improvements |
| **Scope** | Single action per request | Multi-step autonomous pipeline |
| **Error handling** | User reports issues | Self-verifies and auto-corrects |
| **Result** | Generated text/code | Actual source files modified |
| **Communication** | Request-response | Always-on WebSocket, event-driven |

---

## Project Structure

```
docs/
├── prd/PRD_wigss.md           # Product Requirements (v5.0)
├── todo_plan/PLAN_wigss.md    # Execution Plan (D-1 / D-Day)
└── ARCHITECTURE.md            # System Architecture (v2.0)
```

## License

MIT

---

<div align="center">

**Built for the Trae.ai Hackathon 2026 by Team WIGSS (WIGTN Crew)**

*Theme: "Agent"*

</div>
