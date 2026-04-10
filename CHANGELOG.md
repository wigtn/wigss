# Changelog

All notable changes to WIGSS are documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/),
and this project follows [Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-04-11

v2.2: language-agnostic fidelity pipeline. Major internal refactor of the
refactoring pipeline, plus first non-React language support and post-apply
fidelity verification.

### Added
- **StyleIntent / Dispatcher / Rewriter pipeline** — edits flow through
  `ComponentChange → StyleIntent → dispatcher → rewriter → CodeDiff`
  instead of the legacy per-strategy heuristic routing. Each language
  implements a single `SourceRewriter` object.
- **HTML + CSS support** — new `html-css` strategy handles `.html`/`.htm`
  sources, finds the linked stylesheet via `<link rel="stylesheet">`, and
  either updates an existing rule (postcss), appends a new rule, or
  injects/merges an inline `style=""` attribute. `<script>` blocks are
  protected and the diff range is expanded until uniqueness is guaranteed.
- **Tailwind cleanup pass** — optional post-dispatch pass that converts
  inline-style diffs back into Tailwind utility classes when every
  property maps to an exact preset, with conflicting-prefix dedup on the
  same element. Activates only when `tailwind.config.*` is present.
- **Fidelity verification core** — `intentToExpectation`,
  `verifyAgainstBoundingBox`, `verifyBatch`. 2px tolerance, delta
  validation for margins. Exposed via `generateRefactorResult()`.
- **Runtime verification loop (server)** —
  - `POST /api/apply` now returns `{ backupId }` alongside the diff result.
  - `POST /api/verify` accepts expectations + prior/actual bounding boxes
    and returns per-component fidelity reports.
  - `POST /api/rollback` restores originals by backup id; ids are
    one-shot.
  - `src/lib/apply-backup.ts` — in-memory, TTL-bounded backup store.
- **ComponentChange.targetStyles passthrough** — editor can attach
  captured computed styles to drag/resize events; the intent adapter
  merges them on top of the bbox-derived defaults so color/font/border
  edits flow through the same pipeline.
- **PRD + Task Plan** for v2.2:
  `docs/prd/PRD_wigss-v2.2-fidelity-pipeline.md`,
  `docs/todo_plan/PLAN_wigss-v2.2-fidelity-pipeline.md`.

### Changed
- `detectCssStrategy` is now AST-aware via `findClassNameAttribute`, so
  template literals (`className={\`flex h-24 ${variant}\`}`), single
  quoted attributes, and multi-line classNames route correctly to the
  tailwind strategy instead of falling through to inline-style. Literal
  substring matching is retained as a fallback for non-parseable
  fixtures.
- `src/lib/css-strategy-detector.ts` gained `findLinkedStylesheets` for
  HTML parsing.
- `refactor-client.ts` orchestrates detection once per component then
  hands enriched intents to the dispatcher. Exports `generateRefactorResult`
  for the verification loop.

### Fixed
- **merge-loss** (Phase 0): a resize followed by a move on the same
  component no longer drops the resize. All changes per component are
  merged before dispatch.
- **line-count reject** (Phase 0): the apply-route guard that rejected
  any diff whose replacement changed the line count is gone; other
  safety guards (className/style presence, JS token parity) remain.
- **template-literal diffs** (Phase 0): tailwind rewriter now emits
  diffs using the AST-captured attribute span, preserving quote style
  and falling back to full-attribute splice when the inner value alone
  is ambiguous.
- Pre-existing `component-detector*.test.ts` tsc errors (`null` vs
  `undefined`, removed `childIds` field) — unrelated to v2.2 but
  unblocked `tsc --noEmit` cleanliness.

### Removed
- Orphaned `TargetLocator` interface in `src/types/index.ts` — no
  implementation ever materialized; rewriters own their own target
  discovery. Comment retained on `SourceRewriter` for history.

### Tests
- 252 baseline → **319 green**. +67 tests across intent-adapter,
  html-css, tailwind-cleanup, fidelity-check, apply-backup,
  verify-api, rollback-api, and Phase 0 regression pinning.

## [0.1.4] — 2026-04-10
- WIGTN Crew SEO/GEO metadata, CITATION.cff, package.json enrichment.

## [0.1.3] — 2026-04
- N1–N8 bug fixes, dead-code removal, test suite expanded to 252.
