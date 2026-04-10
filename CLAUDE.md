# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**WIGSS** (Style Shaper) is a visual code refactoring tool with an always-on AI agent, built by Team WIGSS (WIGTN Crew) for the Trae.ai Hackathon 2026.

## Architecture

- **CLI entry**: `bin/cli.js` — `npx wigss --port <port>`, auto-detects cwd as source path
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Zustand
- **Communication**: WebSocket (always connected, event-driven)
- **Visual Editor**: iframe (target page) + overlay (absolute-positioned component boxes with drag/resize)
- **AI (observe/suggest/chat)**: OpenAI GPT-4o (Chat Completions + function calling)
- **Refactor pipeline (v2.2)**: language-agnostic `ComponentChange → StyleIntent → dispatcher → rewriter → CodeDiff`. Deterministic, no LLM. Supports Tailwind / CSS Modules / Plain CSS / HTML+CSS / universal inline fallback.
- **Fidelity verification (v2.2)**: every `/api/apply` returns a `backupId` + `expectations`. Editor re-measures, POSTs `/api/verify`, and can POST `/api/rollback` to restore originals if the result drifts.
- **DOM Scan**: postMessage + component-detector.ts (software-based, no browser dependency)
- **File I/O**: Node.js fs for source code read/write

## Key Directories

- `bin/` — CLI entry point
- `demo-target/` — Sample web page for demo/testing (localhost:3001)
- `src/app/api/ws/` — WebSocket endpoint
- `src/app/api/apply/` — Source file modification (REST, backup-aware)
- `src/app/api/verify/` — Post-apply fidelity verification endpoint
- `src/app/api/rollback/` — Restore originals from a backup token
- `src/components/editor/` — VisualEditor, ComponentTagBar, FloatingToolbar
- `src/components/panels/` — AgentPanel, ChatInterface, FeedbackCards, DiffPreview
- `src/stores/` — Zustand (editor-store + agent-store)
- `src/lib/agent/` — Agent loop, OpenAI client, refactor-client, intent-adapter, dispatcher
- `src/lib/agent/rewriters/` — Per-language SourceRewriter implementations (tailwind/inline/css-module/plain-css/html-css)
- `src/lib/agent/cleanup/` — Optional post-dispatch passes (e.g. Tailwind class reduction)
- `src/lib/agent/verify/` — Fidelity check core (pure comparison utilities)
- `src/lib/` — component-detector, file-utils, ws-server, css-strategy-detector, postcss-utils, ast-utils, apply-backup

## Conventions

- TypeScript strict mode
- Tailwind CSS for styling
- Zustand for state (2 stores: editor + agent)
- WebSocket messages: `{ type: string, payload: any }`
- API responses (REST): `{ success: boolean, data: {...} }` or `{ success: false, error: { code, message } }`
- Component types: navbar, header, hero, grid, card, sidebar, footer, section, form, modal
- AI calls: OpenAI GPT-4o for observe/suggest/chat; refactoring is deterministic (no LLM)
- `StyleIntent.targetStyles` uses camelCase (JSX-native); CSS-file rewriters convert via `targetStylesToKebab`
- Rewriters must be all-or-nothing — never return a partial diff
- Canvas state tracked via component boundingBox snapshots

## Commands

- `pnpm dev` — Start WIGSS editor (localhost:3000) + demo-target (localhost:3001)
- `pnpm build` — Production build
- `pnpm lint` — ESLint check
