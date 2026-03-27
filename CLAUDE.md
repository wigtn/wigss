# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**WIGSS** (Style Shaper) is a visual code refactoring tool with an always-on AI agent, built by Team WIGSS (WIGTN Crew) for the Trae.ai Hackathon 2026.

## Architecture

- **CLI entry**: `bin/cli.js` — `npx wigss --port <port>`, auto-detects cwd as source path
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Zustand
- **Communication**: WebSocket (always connected, event-driven)
- **Visual Editor**: iframe (target page) + overlay divs (drag/resize handles)
- **AI (observe/suggest/chat)**: OpenAI GPT-4o (Chat Completions + function calling)
- **AI (refactor/verify)**: Claude API (Anthropic Messages + tool use)
- **DOM Scan**: Puppeteer (headless Chrome)
- **File Watch**: chokidar
- **File I/O**: Node.js fs for source code read/write

## Key Directories

- `bin/` — CLI entry point
- `demo-target/` — Sample web page for demo/testing (localhost:3001)
- `src/app/api/ws/` — WebSocket endpoint
- `src/app/api/apply/` — Source file modification (REST, for safety)
- `src/components/editor/` — VisualEditor, ComponentOverlay, FloatingToolbar
- `src/components/panels/` — AgentPanel, ChatInterface, FeedbackCards, DiffPreview
- `src/stores/` — Zustand (editor-store + agent-store)
- `src/lib/agent/` — Agent loop, OpenAI client, Claude client, tools
- `src/lib/` — puppeteer, file-utils, ws-server

## Conventions

- TypeScript strict mode
- Tailwind CSS for styling
- Zustand for state (2 stores: editor + agent)
- WebSocket messages: `{ type: string, payload: any }`
- API responses (REST): `{ success: boolean, data: {...} }` or `{ success: false, error: { code, message } }`
- Component types: navbar, header, hero, grid, card, sidebar, footer, section, form, modal
- AI calls: OpenAI for fast observe/suggest/chat, Claude for code refactoring/verification

## Commands

- `pnpm dev` — Start WIGSS editor (localhost:3000) + demo-target (localhost:3001)
- `pnpm build` — Production build
- `pnpm lint` — ESLint check
