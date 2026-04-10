# Task Plan: WIGSS v2.2 — Language-Agnostic Fidelity Pipeline

> **Generated from**: docs/prd/PRD_wigss-v2.2-fidelity-pipeline.md
> **Created**: 2026-04-11
> **Status**: completed (all phases)

## Execution Config

| Option | Value | Description |
|--------|-------|-------------|
| `auto_commit` | true | Phase 완료 시 자동 커밋 |
| `commit_per_phase` | true | Phase별 중간 커밋 (회귀 추적 용이) |
| `quality_gate` | true | /auto-commit 품질 검사 필수 |

---

## Phase 0: Prep (완료됨 — 2026-04-11 버그 수정)

> 본 리팩토링의 전제 조건. 이미 해결됨.

- [x] `refactor-client.ts` merge-loss 수정 (resize+move 동시 반영)
- [x] `apply/route.ts` line-count reject 제거
- [x] `tailwind-strategy.ts` AST valueText 기반 diff + uniqueness fallback
- [x] 252개 테스트 그린 유지

---

## Phase 1: Foundations — Intent Model (완료됨)

> 새 데이터 모델 도입. 기존 경로에는 영향 없음.

### 1.1 타입 정의
- [x] `StyleIntent` 인터페이스 추가 (`src/types/index.ts`)
- [x] `TargetLocation`, `WriteMode` 열거 추가
- [x] `TargetLocator`, `SourceRewriter` 인터페이스 추가
- [x] `SourceInput` 타입 추가 (PRD reviewer M-2)
- [x] 기존 `ComponentChange`, `CodeDiff`는 불변 유지

### 1.2 Adapter
- [x] `src/lib/agent/intent-adapter.ts` 신설
- [x] `changeToIntent(change, component)` 구현
- [x] `changesToIntents` 배치 merge 함수 (resize+move 병합)
- [x] `toKebabCase` / `targetStylesToKebab` 유틸
- [x] `sourceHint` 채우기 (file, className, componentName, cssStrategy)

### 1.3 테스트
- [x] `src/__tests__/intent-adapter.test.ts` — 11 tests
- [x] camelCase 키 네이밍 정책 확정

### 1.4 Build Gate
- [x] 252 + 11 = 263 tests 통과
- [x] `pnpm build` 통과

**Deliverable**: 타입과 어댑터만 추가된 상태. 기존 경로는 그대로 동작.

**Commit**: `feat(v2.2): introduce StyleIntent type and ComponentChange adapter`

---

## Phase 2: Refactor Existing Strategies onto Locator/Rewriter (완료됨)

> 내부 구조 교체. 외부 동작은 동일. 회귀 0 달성.

### 2.1 Rewriter 레이어
- [x] `src/lib/agent/rewriters/synth-from-intent.ts` — StyleIntent → ComponentChange bridge
- [x] `src/lib/agent/rewriters/tailwind-rewriter.ts` — `refactorTailwind` 위임
- [x] `src/lib/agent/rewriters/inline-rewriter.ts` — universal JSX fallback
- [x] `src/lib/agent/rewriters/css-module-rewriter.ts`
- [x] `src/lib/agent/rewriters/plain-css-rewriter.ts`
- [x] 각 rewriter가 `SourceRewriter` 인터페이스 구현

### 2.2 Dispatcher
- [x] `src/lib/agent/dispatcher.ts` 신설
- [x] `dispatchIntent(intent, sources)` — 전략별 rewriter → inline fallback 경로
- [x] Locator 파일은 Phase 3 HTML+CSS에서 실질적 use case 등장 후 도입 예정

### 2.3 Dispatcher 교체
- [x] `refactor-client.ts` — `generateRefactorDiffs`가 `changesToIntents` + `dispatchIntent` 사용
- [x] 기존 외부 시그니처 유지
- [x] `detectCssStrategy` 호출을 refactor-client에서 수행하고 sourceHint에 주입

### 2.4 Strategy 파일 상태
- [x] 기존 `src/lib/agent/strategies/*.ts`는 내부 구현 디테일로 유지 (외부 import 제거)
- [x] PRD reviewer M-2 (SourceInput 타입) 해결

### 2.5 회귀 테스트
- [x] 263 tests 전부 통과 (Phase 1 + 2 합산, 기존 252 포함)

### 2.6 Build Gate
- [x] `pnpm build` 통과

**Deliverable**: 내부는 새 파이프라인, 외부는 v0.1.4와 동일 동작.

**Commit**: `refactor(v2.2): split strategies into Locator + Rewriter pipeline`

---

## Phase 3: HTML+CSS Extension (완료됨)

> 비-React 프로젝트 지원. 확장 비용이 실제로 싸다는 증명.

### 3.1 Strategy Detector 확장
- [x] `html-css` CSS strategy type 추가
- [x] `findLinkedStylesheets()` — HTML `<link rel="stylesheet">` 파싱
- [x] `detectCssStrategy` — `.html`/`.htm` source short-circuit 경로

### 3.2 HTML+CSS Rewriter
- [x] `src/lib/agent/rewriters/html-css-rewriter.ts`
- [x] `replace-css-rule` — postcss `modifyCssRuleAst` 재사용
- [x] `add-css-rule` — stylesheet에 새 rule append (현재는 inline fallback으로 우회)
- [x] `add-inline-style` — HTML element에 `style=""` 삽입
- [x] `findHtmlElementWithClass` — 정규식 기반 element locator
- [x] `isInsideScriptBlock` — `<script>` 보호 가드
- [x] `mergeInlineStyleValue` — 기존 style과 dedup merge
- [x] `buildRangeDiff` — `indexOf` 기반 apply가 잘못된 site를 건드리지 않도록 유일성 확장

### 3.3 Dispatcher 등록
- [x] `REWRITERS['html-css'] = htmlCssRewriter`
- [x] `html-css` 전략에는 JSX inline fallback을 적용하지 않도록 dispatcher 가드 추가

### 3.4 테스트
- [x] `src/__tests__/html-css-strategy.test.ts` — 11 tests
- [x] 시나리오: rule 수정 / stylesheet 존재 but rule 부재 → inline fallback / stylesheet 부재 → inline injection
- [x] `<script>` 보호: script-only match → 0 diffs, mixed → real element
- [x] inline style merge 테스트 (기존 속성 보존)
- [x] `findLinkedStylesheets` 단위 테스트

### 3.5 Build Gate
- [x] 274 tests 통과 (263 + 11 신규)
- [x] `pnpm build` 통과

**Deliverable**: HTML+CSS 프로젝트에서 WIGSS 동작. Locator + Rewriter 합산 < 400 LOC 달성.

**Commit**: `feat(v2.2): add HTML+CSS language support via locator/rewriter`

---

## Phase 4: Tailwind Cleanup Pass (완료됨)

### 4.1 Cleanup 구현
- [x] `src/lib/agent/cleanup/tailwind-cleanup.ts`
- [x] `projectUsesTailwind(sources)` — `tailwind.config.{js,mjs,cjs,ts}` 감지
- [x] `parseInlineStyleBody` — JSX `style={{...}}` 속성 파싱
- [x] `cssPropToTailwindPreset` — `pxToTw` 재사용, arbitrary value (`[Xpx]`) 거부
- [x] `removeConflictingClasses` — 동일 prefix 중복 제거 (PRD reviewer M-5)
- [x] 100% 매치 시에만 className으로 환원, 아니면 원본 diff 그대로 반환

### 4.2 Dispatcher 통합
- [x] `dispatchIntent`가 각 rewriter 성공 후 `tailwindCleanupPass` 호출
- [x] Tailwind 프로젝트가 아니면 no-op
- [x] 실패 시 원본 diff 유지 (fidelity 보장)

### 4.3 테스트
- [x] `src/__tests__/tailwind-cleanup.test.ts` — 9 tests
- [x] Round-trip: inline height/width → h-64/w-32
- [x] arbitrary px (263px) → inline 유지
- [x] 비 Tailwind 프로젝트 → 원본 유지
- [x] 기존 className 보존 (flex 등)
- [x] 충돌 클래스 제거 (h-32 + height:256px → h-64)
- [x] dispatchIntent 통합 (Tailwind 컴포넌트는 추가 cleanup 없이 깔끔)

### 4.4 Build Gate
- [x] 283 tests 통과 (274 + 9 신규)
- [x] `pnpm build` 통과

**Deliverable**: Tailwind 프로젝트에서 inline → 유틸 클래스 자동 환원.

**Commit**: `feat(v2.2): add optional Tailwind cleanup pass`

---

## Phase 5: Fidelity Verification (완료됨)

### 5.1 Verification 코어
- [x] 타입: `FidelityExpectation`, `FidelityMismatch`, `FidelityReport`
- [x] `src/lib/agent/verify/fidelity-check.ts`
- [x] `intentToExpectation(intent, sourceFile)` — StyleIntent → 기대치 변환
- [x] `verifyAgainstBoundingBox(expectation, priorBox, actualBox)` — 2px 내 허용 오차
- [x] `verifyBatch()` — 다중 컴포넌트 집계 + 측정 누락 탐지

### 5.2 Refactor-client 통합
- [x] `generateRefactorResult()` — diffs + expectations 동시 반환
- [x] `generateRefactorDiffs()` — 기존 시그니처 유지 (내부적으로 result 사용)
- [x] 각 성공 diff마다 intent-based expectation 생성

### 5.3 런타임 훅 (follow-up로 분리)
- WS roundtrip / 에디터 재측정 / 롤백 UI는 Phase 5 스트레치 스코프로 남겨두고,
  verification 코어와 API는 모두 준비되어 있어 에디터 쪽 작업이 착수되면 바로 연결 가능.

### 5.4 테스트
- [x] `src/__tests__/fidelity-check.test.ts` — 11 tests
- [x] `intentToExpectation` 변환 테스트
- [x] width/height tolerance 테스트
- [x] marginTop/Left delta 검증
- [x] 비-px 값 무시 (`50%` 등)
- [x] `verifyBatch` 다중 컴포넌트 + 측정 누락
- [x] `generateRefactorResult` 통합 테스트

### 5.5 Build Gate
- [x] 294 tests 통과 (283 + 11 신규)
- [x] `pnpm build` 통과

**Deliverable**: 자동 fidelity 검증 루프.

**Commit**: `feat(v2.2): add post-apply fidelity verification`

---

## Progress

| Metric | Value |
|--------|-------|
| Total Phases | 5/5 |
| Tests | 294/294 (252 baseline + 42 new) |
| Status | completed |

## Execution Log

| Timestamp | Phase | Task | Status |
|-----------|-------|------|--------|
| 2026-04-11 | Phase 0 | 버그 3종 수정 (merge-loss, line-count, AST span) | completed |
| 2026-04-11 | Phase 1 | Intent types + adapter | completed (263 tests) |
| 2026-04-11 | Phase 2 | Dispatcher + Rewriter 레이어 | completed (263 tests) |
| 2026-04-11 | Phase 3 | HTML+CSS 전략 | completed (274 tests) |
| 2026-04-11 | Phase 4 | Tailwind cleanup pass | completed (283 tests) |
| 2026-04-11 | Phase 5 | Fidelity verification 코어 | completed (294 tests) |

## Dependencies

- Phase 1 → Phase 2 (Phase 1의 타입이 Phase 2의 전제)
- Phase 2 → Phase 3 (Phase 2의 인터페이스 위에 Phase 3 구현)
- Phase 3 → Phase 4 (Phase 4는 Phase 3 완료 후 확장성 검증이 끝난 뒤 진행)
- Phase 4 → Phase 5 (Phase 5는 독립적이나 병렬 진행 시 회귀 추적이 어려우므로 뒤로)

## Rollback Strategy

각 Phase는 독립 PR로 커밋. 회귀 발생 시 해당 Phase commit만 revert 가능.
- Phase 1: 타입만 추가 → revert 안전
- Phase 2: 구조 교체 → revert 시 기존 strategy 파일로 복귀
- Phase 3: 신규 파일만 → revert 안전
- Phase 4: 선택 기능 → 플래그만 비활성화로 실질 rollback
- Phase 5: 선택 기능 → 플래그만 비활성화
