# WIGSS v2.2 PRD — Language-Agnostic Fidelity Pipeline

> **Version**: 1.0
> **Created**: 2026-04-11
> **Status**: Draft
> **Depends on**: WIGSS v0.1.4 (post bug-fix: merge-loss / line-count reject / AST-span diff)
> **Scope type**: Internal architectural refactor (no DAU/SLA impact — library)

---

## 1. Overview

### 1.1 Problem Statement

WIGSS 현재 파이프라인은 "픽셀 델타 → 프레임워크별 추측 변환"으로 동작한다:

- `ComponentChange`가 bounding box의 `x/y/width/height` 델타만 담는다. 컬러·폰트·테두리·그림자·정렬 등 대부분의 CSS 속성은 애초에 표현할 데이터 모델이 없다.
- 전략(tailwind/inline/css-module/plain-css) 각각이 "델타 → 소스 변형"을 처음부터 재구현한다. 특히 `tailwind-strategy`는 `h/w/mt/py` 같은 유틸 클래스를 **추측으로** 교체하는데, 부모 레이아웃(flex/grid/absolute)을 모른 채 margin을 추가해 레이아웃이 깨지는 일이 흔하다.
- `pxToTw`는 ±2px 내에만 프리셋을 쓰고 그 외엔 `[24px]` arbitrary value를 사용해 round-trip fidelity가 보장되지 않는다.
- 언어 하나를 추가하려면 전략 파일을 처음부터 작성해야 한다. Vue `<style scoped>`, Svelte `class:`, Astro, 외부 Coding Agent가 만든 미지의 코드 등 **WIGSS의 핵심 타겟인 "낯선 소스 구조"**에 대응 비용이 너무 크다.

결과적으로 사용자가 에디터에서 본 모양과 저장된 코드의 렌더 결과가 달라질 수 있고, **"저장한 대로 저장된다"는 신뢰**가 깨진다. 이 신뢰는 바이브 코더 타겟 오픈소스 도구의 생사 기준이다.

### 1.2 Goals

- **G1**: 사용자가 에디터에서 만든 시각 상태 = 저장 후 실제 렌더 결과. 이 fidelity를 **언어·프레임워크·CSS 전략과 무관하게** 보장한다.
- **G2**: 편집 모델을 "픽셀 델타"에서 "목표 computed style"로 전환하여 확장 가능한 데이터 모델을 갖춘다.
- **G3**: 언어 지원 추가 비용을 "Target Locator + Source Rewriter 2개 모듈 작성"으로 한정한다.
- **G4**: 기존 4개 전략(tailwind/inline/css-module/plain-css)을 새 구조 위에 이식하되, **겉보기 동작·테스트는 그대로 보존**한다.
- **G5**: HTML+CSS 전략을 추가하여 "언어 확장 비용이 실제로 싸다"는 것을 증명한다.

### 1.3 Non-Goals (Out of Scope)

- **AI 기반 기능 일체**. 사용자는 AI를 쓰지 않는다 (기존 memory 방침 준수). 이 리팩토링도 순수 deterministic 파이프라인이다.
- **Tailwind 예쁜 출력의 day-1 보존**. Cleanup pass가 준비되기 전까지 Tailwind 프로젝트의 결과물은 일시적으로 `style={{ height: '256px' }}` 같은 inline 형태가 우세해질 수 있다. 이 trade-off는 의도된 것이며 본 PRD의 NFR에서 "품질 회귀 허용 범위"를 정의한다.
- **Vue/Svelte/Astro 전면 지원**. 구조가 확장 가능함을 보이는 수준(HTML+CSS 한 개)까지만 본 릴리스 범위. 나머지는 follow-up PRD.
- **컬러/폰트/border 등 "새 편집 기능" 추가**. 본 PRD는 파이프라인 구조를 바꾸는 것이 핵심이다. 새 속성의 편집 UI는 Phase 외 follow-up.
- **VS Code Extension / Chrome Extension 전환**. 이미 사용자 결정으로 npm 유지.
- **반응형 Breakpoint 편집 (v2.1 범위)**과의 동시 리팩토링. 두 축이 겹치면 리스크가 크므로 breakpoint 기능은 기존 전략 내부에서 동작을 유지하도록 어댑터로 처리한다.

### 1.4 Scope

| 포함 | 제외 |
|------|------|
| `StyleIntent` 타입 신설 | 새 편집 속성 UI (컬러/폰트 등) |
| Editor의 computed style 캡처 확장 | 에디터 툴바/패널 재설계 |
| Target Locator 인터페이스 정의 | AI-assisted locator |
| Source Rewriter 인터페이스 정의 | 복잡한 선택자 생성 로직 |
| 4개 기존 전략의 내부 리팩토링 | 전략별 외부 동작 변경 |
| HTML+CSS 전략 신설 | Vue/Svelte/Astro |
| (선택) Tailwind cleanup pass v1 | Cleanup 커버리지 확장 |
| 회귀 테스트 252+ 유지 | 기존 테스트 재작성 |

---

## 2. User Stories

### 2.1 언어 무관 fidelity

**US-001** — As a **바이브 코더**, I want WIGSS로 수정한 모든 변경사항이 코드에 **정확히 반영**되길 원한다, so that 에디터에서 본 결과와 저장 후 렌더가 다를까봐 의심할 필요가 없다.

**US-002** — As a **Coding Agent 출력물의 후편집 사용자**, I want WIGSS가 낯선 프레임워크·CSS 전략의 코드에서도 작동하길 원한다, so that 내가 쓴 도구가 무엇이든 WIGSS로 시각 편집을 이어갈 수 있다.

### 2.2 확장성

**US-003** — As a **WIGSS 기여자**, I want 새로운 언어 지원을 추가할 때 "element 위치 찾기 + 스타일 쓰기" 두 가지만 구현하면 되길 원한다, so that 전략 파일 전체를 처음부터 작성하는 부담 없이 커뮤니티 기여가 가능하다.

### 2.3 기존 사용자 보호

**US-004** — As a **현재 Tailwind 프로젝트 사용자**, I want 리팩토링 이후에도 내 기존 편집 흐름(resize/move)이 동작하길 원한다, so that 업데이트 때문에 작업이 멈추지 않는다.

**US-005** — As a **Tailwind 스타일을 선호하는 사용자**, I want 저장된 inline style이 가능한 경우 Tailwind 클래스로 자동 환원되길 원한다, so that 코드베이스의 기존 스타일 컨벤션이 유지된다.

### 2.4 Acceptance Criteria

**Scenario: 크기 변경 후 저장 (React + Tailwind)**
```
Given 사용자가 <div className="flex h-48 w-64">를 편집 중이다
When 높이를 200px → 256px로 드래그하고 저장한다
Then 저장된 파일은 리로드 시 정확히 256px 높이로 렌더된다
And 원본의 "flex" 클래스는 보존된다
And className 이외의 JSX 구조는 변경되지 않는다
```

**Scenario: 크기+위치 동시 변경 (merge-loss 방지)**
```
Given 사용자가 컴포넌트 A를 편집 중이다
When 먼저 resize 후 move를 수행한다
Then 저장된 파일은 resize와 move 모두를 반영한다
```

**Scenario: 낯선 구조 — HTML+CSS**
```
Given 프로젝트가 index.html + styles.css 만으로 구성된다
When 사용자가 <div class="card">의 높이를 변경한다
Then styles.css의 .card 규칙이 업데이트되거나, 새 규칙이 생성되거나, style 속성이 추가된다
And 에디터에서 본 결과와 브라우저 렌더가 일치한다
```

**Scenario: Template literal className**
```
Given 소스가 className={`flex ${variant === 'lg' ? 'h-48' : 'h-32'}`} 이다
When 기존 tailwind 전략이 동작하지 않으면 자동으로 inline-style fallback이 쓰인다
Then 저장 결과는 렌더 단에서 fidelity를 유지한다
```

---

## 3. Functional Requirements

| ID | Requirement | Priority | Dependencies |
|----|------------|----------|--------------|
| FR-001 | `StyleIntent` 타입 정의: `{ componentId, targetStyles: Record<string, string>, sourceHint?: { file, elementPath } }` — 목표 computed style을 담는 단일 그릇 | P0 | - |
| FR-002 | Editor가 drag/resize 종료 시 bounding box 외에 영향받는 computed style 속성도 캡처하여 `StyleIntent`로 emit | P0 | FR-001 |
| FR-003 | `ComponentChange`에서 `StyleIntent`로의 변환 어댑터 제공 (기존 WS 메시지와 호환) | P0 | FR-001 |
| FR-004 | `TargetLocator` 인터페이스 정의: `locate(intent, sources) → { file, range, writeMode } \| null` | P0 | FR-001 |
| FR-005 | `SourceRewriter` 인터페이스 정의: `rewrite(target, styles) → CodeDiff \| null` | P0 | FR-004 |
| FR-006 | `dispatchRefactor`를 Locator→Rewriter 호출 구조로 교체 | P0 | FR-004, FR-005 |
| FR-007 | tailwind 전략을 Locator + Rewriter로 분할. Rewriter는 일단 기존 `pxToTw` 로직을 감싸되, **실패 시 inline-style Rewriter로 fallback** | P0 | FR-006 |
| FR-008 | inline-style 전략을 universal Rewriter로 승격 (모든 언어에서 fallback) | P0 | FR-006 |
| FR-009 | css-module 전략을 Locator + Rewriter로 분할 | P1 | FR-006 |
| FR-010 | plain-css 전략을 Locator + Rewriter로 분할 | P1 | FR-006 |
| FR-011 | HTML+CSS Locator: `.html` 파일에서 class/id를 인식하고 대응하는 `.css` 규칙을 찾거나, 없으면 동일 파일의 `<style>` 블록을 대상으로 지목 | P1 | FR-004 |
| FR-012 | HTML+CSS Rewriter: 기존 규칙 수정 / 새 규칙 추가 / 인라인 `style=""` 폴백 | P1 | FR-005, FR-011 |
| FR-013 | Cleanup pass v1: 저장된 inline style이 Tailwind preset에 맞으면 대응 유틸 클래스로 환원. 실패해도 원본 유지 | P1 | FR-007, FR-008 |
| FR-014 | Fidelity verification: 저장 직후 대상 파일을 리로드·재측정하여 의도한 computed style과 일치하는지 검증하고, 실패 시 경고 로그 + rollback 옵션 노출 | P2 | FR-006 |
| FR-015 | 기존 252 테스트가 모두 통과해야 한다. 필요한 경우 테스트는 변경 가능하지만 **커버리지는 감소하지 않는다** | P0 | 전체 |
| FR-016 | 새로운 테스트: HTML+CSS 시나리오, template-literal fallback, merge-loss 회귀, cleanup round-trip | P0 | FR-011, FR-013 |

---

## 4. Non-Functional Requirements

### 4.0 Scale Grade

**Internal architectural refactor — N/A**. 본 변경은 사용자 대면 서비스가 아닌 오픈소스 라이브러리의 내부 구조 교체이며, DAU/SLA/가용성 개념이 직접 적용되지 않는다. 대신 라이브러리 품질 메트릭(테스트 커버리지, 회귀 없음, 로컬 성능)으로 대체한다.

### 4.1 Performance

| 지표 | 현재 (v0.1.4) | 목표 (v2.2) |
|------|--------------|------------|
| 단일 편집 → 파일 저장 지연 (1 파일 기준) | < 200ms | < 300ms (회귀 허용) |
| `dispatchRefactor` 1회 호출 | < 10ms | < 20ms |
| 테스트 스위트 실행 시간 | ~0.5s | < 1.5s |
| Fidelity verification (FR-014, 옵션) | - | < 500ms 추가 |

> Locator + Rewriter 분할로 호출이 늘어나는 만큼 약간의 회귀를 허용하되, 유저 체감 범위 안에 둔다.

### 4.2 Fidelity SLO (본 릴리스의 핵심)

| 시나리오 | 목표 fidelity |
|---------|--------------|
| React + 기존 4개 전략 (회귀 테스트 범위) | 100% (기존 테스트 통과) |
| React + template literal className | Rewriter fallback 경로로 100% |
| HTML + CSS | 100% |
| 외부 Coding Agent 생성 코드 (best-effort 스냅샷 케이스) | ≥ 90% (이하 시 Phase 3 보완) |

### 4.3 Backward Compatibility

- `ComponentChange` 타입과 WS 메시지 스키마는 외부 호환성 유지. `StyleIntent`는 내부 중간 표현이며, 기존 메시지는 어댑터로 변환.
- `CodeDiff` 출력 포맷 불변. Apply route 인터페이스 변경 없음.
- 기존 252 테스트 통과가 Phase 2 완료의 필수 조건.

### 4.4 Security

- 본 변경은 파일 쓰기 경로를 건드리지 않는다. 기존 `isPathSafe` / `apply/route.ts`의 JS 토큰 parity 가드 유지.
- 새로운 HTML+CSS Rewriter가 `<script>` 블록을 건드리지 않도록 가드 필요 (FR-012 수용 기준 포함).

### 4.5 Observability

- `console.log("[Refactor] ...")` 계열 로그를 Locator/Rewriter 단계별로 분리하여 디버깅 용이성 유지.
- Fidelity verification(FR-014)이 실패하면 에디터 UI에 경고 배지 표시 (기존 feedback 채널 재사용).

---

## 5. Technical Design

### 5.1 Architecture

```
┌────────────┐
│  Editor    │  drag / resize / future: color picker 등
│ (browser)  │
└─────┬──────┘
      │ emits
      ▼
┌──────────────────────────────────────────────────┐
│  StyleIntent (언어 무관)                          │
│  { componentId, targetStyles, sourceHint? }      │
└─────┬────────────────────────────────────────────┘
      │ dispatchRefactor()
      ▼
┌──────────────────────────────────────────────────┐
│  Target Locator (언어별, 얇음)                    │
│  - JSX:  findClassNameAttribute + AST span       │
│  - CSS Module: stylesheetPath + className        │
│  - HTML: class/id → css rule or <style> block    │
│  - Svelte/Vue/… (추후)                            │
│  returns: { file, range, writeMode }             │
└─────┬────────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────────────┐
│  Source Rewriter (언어별, 얇음)                   │
│  - 기존 규칙 수정                                 │
│  - 새 규칙/속성 추가                              │
│  - 실패 시 universal inline fallback 호출        │
│  returns: CodeDiff                               │
└─────┬────────────────────────────────────────────┘
      │
      ▼
┌──────────────────────────────────────────────────┐
│  /api/apply (unchanged)                          │
└──────────────────────────────────────────────────┘

Optional parallel pass:
┌──────────────────────────────────────────────────┐
│  Cleanup Pass (Tailwind reduce)                  │
│  inline style → utility class (best-effort)      │
└──────────────────────────────────────────────────┘
```

### 5.2 Key Type Definitions

```ts
// src/types/index.ts (additions)

export interface StyleIntent {
  componentId: string;
  // computed style 속성 → 최종 값 (camelCase for JSX, kebab for CSS 양쪽 쉽게 변환)
  targetStyles: Record<string, string>;
  // Editor가 제공 가능하면 locator에 힌트로 전달
  sourceHint?: {
    file?: string;
    elementPath?: string[];  // DOM breadcrumb
    className?: string;
  };
}

export type WriteMode =
  | 'replace-attribute'     // JSX className / HTML class attr
  | 'replace-css-rule'      // .css rule block
  | 'add-css-rule'          // append new rule to stylesheet
  | 'add-inline-style'      // inject style= attribute
  | 'add-style-block';      // inject new <style> tag (HTML only)

export interface TargetLocation {
  file: string;
  range: { start: number; end: number };
  writeMode: WriteMode;
  // Locator가 rewriter에 전달하고 싶은 부가 정보
  metadata?: Record<string, unknown>;
}

export interface TargetLocator {
  readonly id: string;        // 'jsx-className' | 'css-module' | ...
  locate(intent: StyleIntent, sources: SourceInput[]): TargetLocation | null;
}

export interface SourceRewriter {
  readonly id: string;
  rewrite(
    target: TargetLocation,
    intent: StyleIntent,
    source: SourceInput,
  ): CodeDiff | null;
}
```

### 5.3 Dispatcher Rewrite

```ts
// src/lib/agent/refactor-client.ts (new core)

const LOCATORS: TargetLocator[] = [
  jsxClassNameLocator,
  cssModuleLocator,
  plainCssLocator,
  htmlCssLocator,      // new
];

const REWRITERS = new Map<string, SourceRewriter>([
  ['jsx-className:tailwind', tailwindRewriter],
  ['jsx-className:inline',   inlineRewriter],       // universal fallback
  ['css-module',             cssModuleRewriter],
  ['plain-css',              plainCssRewriter],
  ['html-css',               htmlCssRewriter],
]);

function dispatchIntent(intent: StyleIntent, sources: SourceInput[]): CodeDiff | null {
  for (const locator of LOCATORS) {
    const target = locator.locate(intent, sources);
    if (!target) continue;

    // 전략별 우선 rewriter 시도
    const preferred = REWRITERS.get(`${locator.id}:tailwind`)
                   ?? REWRITERS.get(locator.id);
    if (preferred) {
      const diff = preferred.rewrite(target, intent, sourceOf(target, sources));
      if (diff) return diff;
    }

    // Universal fallback: inline style
    const fallback = REWRITERS.get('jsx-className:inline');
    if (fallback) {
      const diff = fallback.rewrite(target, intent, sourceOf(target, sources));
      if (diff) return diff;
    }
  }
  return null;
}
```

### 5.4 ComponentChange → StyleIntent Adapter

기존 `ComponentChange`를 버리지 않고, dispatcher 직전에 변환한다:

```ts
function changeToIntent(
  change: ComponentChange,
  component: DetectedComponent,
): StyleIntent {
  const styles: Record<string, string> = {};
  // 기존 bounding box delta 로직 재사용
  Object.assign(styles, changeToCssProperties(change));
  // 추후 editor가 computed style을 더 실어보내면 여기에 merge
  return {
    componentId: change.componentId,
    targetStyles: styles,
    sourceHint: {
      file: component.sourceFile,
      className: component.fullClassName,
    },
  };
}
```

### 5.5 HTML+CSS Strategy Detail

```
Input: <div class="card"> 높이 200 → 256
Sources: [index.html, styles.css]

Locator (html-css):
  1. index.html에서 target element의 class="card" 찾음
  2. styles.css에서 .card 규칙 탐색
     - 있으면 → writeMode: 'replace-css-rule', range: 해당 rule
     - 없으면 → writeMode: 'add-css-rule', file: styles.css
     - styles.css 자체가 없으면 → writeMode: 'add-style-block' or 'add-inline-style'
Rewriter:
  - replace-css-rule: postcss로 해당 rule 수정 (css-module-strategy 재사용)
  - add-css-rule: rule 신규 추가
  - add-inline-style: class 옆에 style= 속성 추가
```

Universal inline fallback은 어떤 element tag에도 `style=""`를 삽입할 수 있으므로, Locator가 element 위치만 찾으면 최후의 보루로 동작한다.

### 5.6 Cleanup Pass (Phase 4, 선택)

```
Post-apply step:
  1. 방금 쓴 inline style 속성 추출
  2. 각 속성을 Tailwind preset에 매핑 시도
     - height: 256px → h-64 (정확 매치)
     - margin-top: 18px → arbitrary → 건너뜀 (매치 실패)
  3. 100% 매치되면 inline → 클래스로 환원
  4. 부분 매치는 건너뛰고 inline 유지
```

Cleanup이 실패해도 원본(inline) fidelity는 유지되므로 안전하다.

---

## 6. Implementation Phases

### Phase 1 (Week 1): Foundations — Intent model + Adapter

- [ ] `StyleIntent`, `TargetLocation`, `WriteMode`, `TargetLocator`, `SourceRewriter` 타입 정의 (`src/types/index.ts`)
- [ ] `changeToIntent()` 어댑터 구현 (`src/lib/agent/intent-adapter.ts`)
- [ ] 단위 테스트: adapter가 기존 ComponentChange를 손실 없이 변환
- [ ] 타입만 추가된 상태에서 전체 빌드·테스트 녹색 유지

**Deliverable**: 중간 표현 타입과 어댑터. 기존 코드 경로는 아직 그대로.

### Phase 2 (Week 1-2): Refactor existing 4 strategies onto Locator/Rewriter

- [ ] `jsxClassNameLocator` 추출 (기존 `findClassNameAttribute` 래핑)
- [ ] `tailwindRewriter` 분리 (기존 `refactorTailwind` 내용 이식)
- [ ] `inlineRewriter`를 universal fallback으로 승격 (Rewriter 인터페이스 구현)
- [ ] `cssModuleLocator` + `cssModuleRewriter` 분리
- [ ] `plainCssLocator` + `plainCssRewriter` 분리
- [ ] `dispatchRefactor`를 `dispatchIntent`로 교체 + Rewriter 실패 시 inline fallback 경로 연결
- [ ] 기존 252개 테스트 전부 통과 확인 (회귀 0)

**Deliverable**: 내부 구조는 새 파이프라인, 외부 동작은 동일.

### Phase 3 (Week 2-3): HTML+CSS extension — 확장성 증명

- [ ] `htmlCssLocator` 구현 (HTML class/id → css rule 매핑)
- [ ] `htmlCssRewriter` 구현 (rule 수정 / rule 추가 / inline style 폴백)
- [ ] demo-target에 순수 HTML+CSS 페이지 샘플 추가
- [ ] E2E 테스트: HTML+CSS 편집 → 저장 → 리로드 시 fidelity 검증
- [ ] `<script>` 블록 보호 가드 테스트

**Deliverable**: 비-React 프로젝트에서 WIGSS가 동작한다. 언어 확장 비용이 Locator+Rewriter 2개 파일임을 실증.

### Phase 4 (Week 3): Tailwind cleanup pass v1 (선택, time-permitting)

- [ ] `tailwindCleanupPass` 구현: inline style → preset class 변환
- [ ] 100% 매치만 cleanup, 실패 시 원본 유지
- [ ] dispatcher 후 선택적 실행 (opt-in 플래그)
- [ ] 테스트: h-64, w-32, mt-4 등 기본 preset round-trip

**Deliverable**: Tailwind 프로젝트 사용자의 체감 품질 회복.

### Phase 5 (Week 3-4, stretch): Fidelity verification

- [ ] 저장 후 대상 파일 리로드 트리거
- [ ] 에디터에서 target component 재측정
- [ ] 불일치 시 warning 표시 + rollback 옵션
- [ ] FR-014 수용 기준 통과

**Deliverable**: "저장한 대로 저장됐는지" 자동 확인 루프.

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| 기존 테스트 통과 | 252/252 (100%) | `pnpm test` |
| 신규 테스트 추가 | ≥ 20건 (HTML+CSS, fallback, cleanup, merge) | `pnpm test` |
| Fidelity — React 경로 | 100% (회귀 테스트 범위) | E2E 스냅샷 비교 |
| Fidelity — HTML+CSS 경로 | 100% (신규 테스트 범위) | E2E 스냅샷 비교 |
| `dispatchIntent` 1회 호출 | < 20ms | 벤치 테스트 |
| 언어 추가 비용 (HTML 기준) | Locator + Rewriter 2개 파일, 합산 < 400 LOC | 실제 PR diff |
| Cleanup pass 매치율 (Tailwind 프로젝트, 기존 시나리오) | ≥ 80% | Round-trip 테스트 |

---

## 8. Risks & Mitigations

| 리스크 | 영향 | 완화 |
|-------|------|------|
| Phase 2 리팩토링 중 회귀 발생 | Tailwind 사용자 체감 품질 급락 | Phase 2 완료 조건을 "252 테스트 통과"로 묶음. 단계별 PR 분리. |
| Cleanup pass 커버리지 낮음 | Tailwind 출력이 계속 inline으로 남음 | Phase 4를 선택 단계로 두고, 미완성 시에도 fidelity는 보장되므로 릴리스 가능 |
| HTML+CSS locator가 실제 낯선 코드에서 실패 | 확장성 증명 실패 | Phase 3에 "best-effort ≥ 90%" SLO를 두고, 실패 케이스는 inline fallback으로 흡수 |
| Editor의 computed style 캡처 확장이 성능 저하 유발 | 드래그 지연 | Phase 1에서 캡처 범위는 "변경된 속성만"으로 제한. 전체 computed style 덤프 금지 |
| Breakpoint 기능(v2.1)과의 충돌 | 반응형 편집이 깨짐 | Locator/Rewriter가 `breakpoint` 필드를 intent metadata로 투과 전달. v2.1 테스트도 회귀 검사에 포함 |

---

## 9. Open Questions

1. `StyleIntent.targetStyles`의 키 네이밍을 camelCase로 통일할지, 아니면 CSS property 표준인 kebab으로 갈지? (현재 inline-style은 camel, CSS/plain은 kebab) → Phase 1에서 결정, 내부 변환 유틸 제공.
2. Editor의 computed style 캡처 범위: 변경된 속성만 vs 영향을 받을 가능성이 있는 속성군(예: resize 시 width/height/maxWidth/minHeight 모두)? → Phase 1 PoC에서 결정.
3. Cleanup pass를 Phase 4에 포함할지, 별도 v2.3으로 미룰지? → Phase 3 완료 시점의 일정 여유로 결정.
