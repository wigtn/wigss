# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**WIGSS** (Style Shaper) is a visual code refactoring tool with AI agents, built by Team WIGSS (WIGTN Crew) for the Trae.ai Hackathon 2026.

## Architecture

- **CLI entry**: `bin/cli.js` — `npx wigss --port <port>`, auto-detects cwd as source path
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Zustand
- **Visual Editor**: iframe (target page) + overlay divs (drag/resize handles)
- **AI**: Claude API with Tool Use (5 agents: detect, suggest, responsive, refactor, verify)
- **DOM Scan**: Puppeteer (headless Chrome)
- **File I/O**: Node.js fs for source code read/write

## Key Directories

- `bin/` — CLI entry point
- `demo-target/` — Sample web page for demo/testing
- `src/app/api/` — 7 API routes (scan, detect, suggest, responsive, refactor, apply, verify)
- `src/components/editor/` — Visual editor (iframe + overlay)
- `src/components/panels/` — AgentPanel, DiffPreview, ComponentInfo
- `src/stores/` — Zustand stores (editor-store, agent-store)
- `src/lib/` — Core logic (puppeteer, claude, component-detector, code-refactorer, file-utils)

## Conventions

- TypeScript strict mode
- Tailwind CSS for styling
- Zustand for state management (2 stores: editor + agent)
- API responses follow: `{ success: boolean, data: {...} }` or `{ success: false, error: { code, message } }`
- Component types: navbar, header, hero, grid, card, sidebar, footer, section, form, modal

## Commands

- `pnpm dev` — Start WIGSS editor (localhost:3000) + demo-target (localhost:3001)
- `pnpm build` — Production build
- `pnpm lint` — ESLint check
