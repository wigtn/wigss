# WIGSS v2.1 PRD — Responsive Breakpoint Editor + VS Code Extension

> **Version**: 1.1 (Quality Gate fixes applied)
> **Created**: 2026-03-30
> **Status**: Draft
> **Depends on**: WIGSS v0.1.2 (current codebase)

---

## 1. Overview

### 1.1 Problem Statement

WIGSS v0.1.2는 단일 viewport에서만 스타일을 수정할 수 있다. 사용자가 `h-[200px]`로 리사이즈하면 **모든 화면 크기에서 200px**로 고정된다. 실제 웹 개발에서는 breakpoint별 반응형 스타일(`sm:h-[100px] md:h-[200px]`)이 필수이며, 이 기능 없이는 프로덕션 코드에 적용하기 어렵다.

또한 현재 `npx wigss` CLI 실행 방식은 발견성(discoverability)이 극도로 낮아, VS Code Marketplace(MAU 3,400만)를 통한 배포가 필요하다.

### 1.2 Goals

- **G1**: 사용자가 viewport 크기를 조절하며 breakpoint별 스타일을 비주얼로 편집할 수 있다
- **G2**: Tailwind responsive prefix(`sm:`, `md:`, `lg:`, `xl:`, `2xl:`)를 자동 생성/수정한다
- **G3**: CSS Module / Plain CSS에서 `@media` 쿼리를 자동 생성/수정한다
- **G4**: VS Code Extension으로 전환하여 설치 장벽을 90% 낮춘다
- **G5**: Extension에서 사용자 dev server를 자동 감지/실행한다

### 1.3 Non-Goals (Out of Scope)

- Figma 연동 (v3 이후)
- 비주얼 리그레션 (별도 PRD)
- inline style 반응형 (기술적으로 불가능 — CSS 미디어 쿼리가 inline에서 동작하지 않음)
- React Native / Flutter 지원
- 실시간 협업 (CRDT 복잡도)

### 1.4 Scope

| 포함 | 제외 |
|------|------|
| Tailwind 반응형 prefix 생성/수정 | styled-components 반응형 |
| CSS Module @media 생성/수정 | Sass nested @media |
| Plain CSS @media 생성/수정 | CSS-in-JS (emotion, etc.) |
| VS Code Webview Panel | VS Code Sidebar view |
| localhost iframe (CSP 허용) | 외부 URL iframe |
| 자동 dev server 실행 | Docker 환경 감지 |

---

## 2. User Stories

### 2.1 반응형 Breakpoint 편집

**US-001**: As a 프론트엔드 개발자, I want to viewport 크기를 변경하면서 breakpoint별 스타일을 드래그로 조절하고 싶다, so that 반응형 CSS를 코드 작성 없이 비주얼로 완성할 수 있다.

**US-002**: As a Tailwind 사용자, I want to md breakpoint에서 카드 높이를 드래그로 조절하면 `md:h-[200px]`가 자동 생성되길 원한다, so that base class(`h-[100px]`)는 유지되면서 breakpoint 스타일만 추가된다.

**US-003**: As a CSS Module 사용자, I want to 768px viewport에서 높이를 변경하면 `@media (min-width: 768px)` 블록 안에 스타일이 생성되길 원한다, so that 반응형 스타일시트를 수동으로 작성하지 않아도 된다.

### 2.2 VS Code Extension

**US-004**: As a VS Code 사용자, I want to Cmd+Shift+P → "WIGSS: Open"만으로 비주얼 에디터를 열고 싶다, so that 터미널에서 `npx wigss`를 실행하는 번거로움이 없다.

**US-005**: As a 개발자, I want to Extension이 내 dev server를 자동으로 감지/실행해주길 원한다, so that 별도의 설정 없이 바로 사용할 수 있다.

### 2.3 Acceptance Criteria (Gherkin)

```gherkin
Scenario: Tailwind breakpoint class 생성
  Given 사용자가 breakpoint 모드를 활성화했다
  And 현재 viewport 폭이 768px이다 (md breakpoint)
  And 대상 컴포넌트의 className이 "flex h-20 bg-white"이다
  When 사용자가 컴포넌트 높이를 200px로 리사이즈한다
  Then className이 "flex h-20 md:h-[200px] bg-white"로 변경된다
  And base class "h-20"은 그대로 유지된다

Scenario: 기존 Tailwind breakpoint class 교체
  Given 대상 컴포넌트의 className이 "h-20 md:h-48 bg-white"이다
  And 현재 viewport가 md breakpoint이다
  When 사용자가 높이를 200px로 리사이즈한다
  Then "md:h-48"이 "md:h-[200px]"로 교체된다
  And "h-20"과 "bg-white"는 그대로 유지된다

Scenario: CSS Module @media 블록 생성
  Given CSS 전략이 "css-module"이다
  And 현재 viewport가 md breakpoint (768px)이다
  And .card.module.css에 @media (min-width: 768px) 블록이 없다
  When 사용자가 .card 컴포넌트 높이를 300px로 리사이즈한다
  Then .card.module.css에 @media (min-width: 768px) { .card { height: 300px; } } 블록이 생성된다

Scenario: VS Code Extension 최초 실행
  Given VS Code에서 프로젝트가 열려있다
  And package.json에 "dev": "next dev --port 3000" 스크립트가 있다
  And localhost:3000이 실행되고 있지 않다
  When 사용자가 "WIGSS: Open Visual Editor" 명령을 실행한다
  Then VS Code 터미널이 열리고 "npm run dev"가 자동 실행된다
  And 서버가 준비되면 Webview 패널에 에디터가 로드된다
  And iframe에 localhost:3000 페이지가 표시된다

Scenario: VS Code Extension — dev server 이미 실행 중
  Given localhost:3000이 이미 실행 중이다
  When 사용자가 "WIGSS: Open Visual Editor" 명령을 실행한다
  Then 터미널을 열지 않고 바로 Webview가 열린다
  And iframe에 localhost:3000이 즉시 로드된다
```

---

## 3. Functional Requirements

### Phase 1: Responsive Breakpoint Editor

| ID | Requirement | Priority | Dependencies |
|----|------------|----------|--------------|
| FR-101 | Breakpoint 모드 토글 (ON/OFF) — FloatingToolbar에 토글 버튼 추가 | P0 (Must) | - |
| FR-102 | Viewport 폭 조절 UI — 드래그로 연속 조절 또는 preset 클릭 (sm/md/lg/xl/2xl) | P0 (Must) | FR-101 |
| FR-103 | Breakpoint 감지 로직 — viewport 폭 → breakpoint name 매핑 | P0 (Must) | FR-102 |
| FR-104 | ComponentChange 타입에 `breakpoint?: string` 필드 추가 | P0 (Must) | FR-103 |
| FR-105 | Tailwind: breakpoint prefix class 생성 (`md:h-[200px]`) | P0 (Must) | FR-104 |
| FR-106 | Tailwind: 기존 breakpoint prefix class 교체 (`md:h-48` → `md:h-[200px]`) | P0 (Must) | FR-105 |
| FR-107 | Tailwind: base class 보존 — breakpoint 수정 시 prefix 없는 class 유지 | P0 (Must) | FR-105 |
| FR-108 | findTwClass() 확장 — `sm:h-*`, `md:w-*` 등 prefix 패턴 인식 | P0 (Must) | FR-106 |
| FR-109 | Breakpoint indicator UI — 현재 breakpoint 이름 + 픽셀 폭 표시 | P1 (Should) | FR-102 |
| FR-110 | CSS Module: `@media (min-width: Npx)` 블록 생성/수정 | P1 (Should) | FR-104 |
| FR-111 | Plain CSS: `@media (min-width: Npx)` 블록 생성/수정 | P1 (Should) | FR-110 |
| FR-112 | PostCSS: media query 내부 rule 탐색/수정 함수 추가 | P1 (Should) | FR-110 |
| FR-113 | Breakpoint preset 커스텀 — 사용자 프로젝트의 tailwind.config에서 breakpoint 읽기 | P2 (Could) | FR-103 |
| FR-114 | Viewport 전환 시 iframe 실제 리사이즈 + 컴포넌트 재스캔 | P0 (Must) | FR-102 |

### Phase 2: VS Code Extension

| ID | Requirement | Priority | Dependencies |
|----|------------|----------|--------------|
| FR-201 | Extension 진입점 (activate/deactivate) — VS Code 명령 등록 | P0 (Must) | - |
| FR-202 | Webview Panel 생성 — React UI를 webview에 로드 | P0 (Must) | FR-201 |
| FR-203 | CSP 설정 — `frame-src http://localhost:*` 허용 | P0 (Must) | FR-202 |
| FR-204 | Message Bridge — webview ↔ extension host 양방향 메시지 라우팅 | P0 (Must) | FR-202 |
| FR-205 | Agent Loop를 extension host에서 실행 | P0 (Must) | FR-204 |
| FR-206 | /api/refactor 대체 — message bridge에서 직접 generateRefactorDiffs() 호출 | P0 (Must) | FR-204 |
| FR-207 | /api/apply 대체 — message bridge에서 직접 applyDiff() + writeSourceFile() 호출 | P0 (Must) | FR-204 |
| FR-208 | Agent Store 수정 — WebSocket → acquireVsCodeApi().postMessage() | P0 (Must) | FR-204 |
| FR-209 | FloatingToolbar 수정 — fetch() → vscode.postMessage() | P0 (Must) | FR-204 |
| FR-210 | Dev server 자동 감지 — package.json scripts.dev에서 port 추출 | P0 (Must) | FR-201 |
| FR-211 | Dev server 자동 실행 — localhost:PORT 미응답 시 VS Code 터미널에서 `npm run dev` 실행 | P0 (Must) | FR-210 |
| FR-212 | Dev server 준비 대기 — port polling (최대 30초) + progress notification | P0 (Must) | FR-211 |
| FR-213 | OpenAI API 키 관리 — VS Code SecretStorage 또는 settings.json | P0 (Must) | FR-201 |
| FR-214 | Webview 빌드 파이프라인 — Vite로 React 앱 번들링 | P0 (Must) | FR-202 |
| FR-215 | Extension Host 빌드 — esbuild로 Node.js 번들 생성 | P0 (Must) | FR-201 |
| FR-216 | VS Code Marketplace 퍼블리시 설정 (.vscodeignore, publisher 등) | P1 (Should) | FR-215 |
| FR-217 | Extension 설정 UI — target port, API key 입력, breakpoint preset 등 | P1 (Should) | FR-213 |
| FR-218 | Extension 아이콘 및 메타데이터 | P2 (Could) | FR-216 |

---

## 4. Non-Functional Requirements

### 4.0 Scale Grade

**Startup** — 2-5명 팀, DAU 수천 명 수준의 오픈소스 개발자 도구.

> 단, WIGSS는 로컬 실행 도구이므로 서버 인프라 NFR 대부분이 해당 없음.
> Extension은 사용자 머신에서 실행되며, 서버 비용 = 0.

### 4.1 Performance

| 지표 | 목표값 | 근거 |
|------|--------|------|
| Breakpoint 전환 시 iframe 리사이즈 | < 200ms | 사용자 조작에 즉각 반응 |
| Breakpoint 전환 후 재스캔 | < 2s | iframe 리렌더 + postMessage scan |
| Tailwind prefix class 생성 (refactor) | < 50ms | 기존 refactor 속도와 동일 |
| @media 블록 생성 (PostCSS) | < 100ms | PostCSS parse + modify |
| Extension 활성화 → Webview 표시 | < 3s | Webview 로드 + bridge 연결 |
| Dev server 자동 실행 → 준비 완료 | < 30s | Next.js/Vite cold start 기준 |

### 4.2 Availability

해당 없음 (로컬 실행 도구).

### 4.3 Compatibility

| 환경 | 지원 범위 |
|------|-----------|
| VS Code | ^1.85.0 (Webview API, SecretStorage) |
| Node.js | ^18.0.0 (Extension Host) |
| OS | Windows, macOS, Linux |
| 대상 프레임워크 | Next.js, Vite, CRA, Remix (dev server가 localhost를 serve하는 모든 프레임워크) |
| CSS 전략 | Tailwind (P0), CSS Module (P1), Plain CSS (P1) |
| Breakpoints | Tailwind 기본값: sm(640), md(768), lg(1024), xl(1280), 2xl(1536) |

### 4.4 Security

| 항목 | 정책 |
|------|------|
| CSP frame-src | `http://localhost:*` 만 허용 (외부 URL 차단) |
| OpenAI API 키 | VS Code SecretStorage (암호화 저장) |
| 파일 쓰기 | `isPathSafe()` 유지 — workspace 외부 경로 차단 |
| Webview 스크립트 | nonce 기반 CSP (`script-src 'nonce-xxx'`) |

---

## 5. Technical Design

### 5.1 Breakpoint System Architecture

```
┌─ FloatingToolbar ──────────────────────────────────────────┐
│ [Scan] [Save] [Undo] [Redo] [📱 Responsive: ON/OFF]       │
│                                                            │
│  Breakpoint Mode ON:                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [sm 640] [md 768] [lg 1024] [xl 1280] [2xl 1536]    │  │
│  │              ▲ active                                 │  │
│  │  ◄────── drag handle to resize ──────►               │  │
│  │  Current: 768px (md)                                  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ VisualEditor ─────────────────────────────────────────────┐
│  iframe (width: 768px) ← 실제 리사이즈                      │
│  ├─ 컴포넌트 오버레이 (좌표 재계산)                          │
│  └─ 리사이즈 → ComponentChange { breakpoint: 'md' }         │
│                                                            │
│  mouseup 시:                                               │
│  ├─ change.breakpoint = currentBreakpoint                  │
│  └─ sendMessage('resize_end', { ...change })               │
└────────────────────────────────────────────────────────────┘
         │
         ▼
┌─ Refactor Pipeline ────────────────────────────────────────┐
│  dispatchRefactor(change, component, sources)               │
│                                                            │
│  if (change.breakpoint) {                                  │
│    switch (strategy) {                                     │
│      case 'tailwind':                                      │
│        → addOrReplace breakpoint prefix class              │
│        → preserve base class                               │
│      case 'css-module':                                    │
│      case 'plain-css':                                     │
│        → findOrCreate @media block                         │
│        → modify rule inside @media                         │
│      case 'inline-style':                                  │
│        → skip (반응형 불가, 경고 메시지)                    │
│    }                                                       │
│  } else {                                                  │
│    → 기존 로직 (base class 수정)                            │
│  }                                                         │
└────────────────────────────────────────────────────────────┘
```

### 5.2 Breakpoint 매핑

```typescript
// 기본 Tailwind breakpoints (커스텀 오버라이드 가능)
const DEFAULT_BREAKPOINTS: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

// viewport 폭 → breakpoint 이름
function resolveBreakpoint(viewportWidth: number): string | null {
  // mobile-first: 가장 가까운 하한 breakpoint 반환
  // 640 미만 → null (base, no prefix)
  // 640-767 → 'sm'
  // 768-1023 → 'md'
  // 1024-1279 → 'lg'
  // 1280-1535 → 'xl'
  // 1536+ → '2xl'
  const entries = Object.entries(DEFAULT_BREAKPOINTS)
    .sort(([, a], [, b]) => b - a); // 내림차순
  for (const [name, minWidth] of entries) {
    if (viewportWidth >= minWidth) return name;
  }
  return null; // base (no breakpoint prefix)
}
```

### 5.3 Tailwind Breakpoint Refactoring

#### findTwClass() 확장

```typescript
// 현재 (prefix 미지원):
//   regex: (?:^|\s)-?h-(?:\[\d+px\]|\d+\.?\d*)(?=\s|$)
//   매칭: "h-48", "h-[200px]"

// 변경 후 (prefix 지원):
//   regex: (?:^|\s)(?:sm:|md:|lg:|xl:|2xl:)?-?h-(?:\[\d+px\]|\d+\.?\d*)(?=\s|$)
//   매칭: "h-48", "md:h-48", "xl:h-[200px]"

function findTwClass(
  className: string,
  prefix: string,
  breakpoint?: string | null
): string | null {
  const escaped = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const bpPrefix = breakpoint ? `${breakpoint}:` : '';
  const regex = new RegExp(
    `(?:^|\\s)${bpPrefix}-?${escaped}-(?:\\[\\d+px\\]|\\d+\\.?\\d*)(?=\\s|$)`
  );
  const match = className.match(regex);
  return match ? match[0].trim() : null;
}
```

#### 리팩토링 로직

```typescript
function refactorTailwindResponsive(
  change: ComponentChange,
  component: DetectedComponent,
  sources: SourceInput[],
): CodeDiff | null {
  const bp = change.breakpoint; // 'md' | 'lg' | null
  const fullClassName = component.fullClassName || '';

  // 1. breakpoint prefix가 있는 기존 class 찾기
  const existingBpClass = bp ? findTwClass(fullClassName, 'h', bp) : null;
  // 예: "md:h-48" 또는 null

  // 2. base class 찾기
  const baseClass = findTwClass(fullClassName, 'h', null);
  // 예: "h-20"

  if (bp) {
    // Breakpoint 모드
    const newBpClass = `${bp}:${pxToTw(change.to.height!, 'h')}`;
    // 예: "md:h-[200px]"

    if (existingBpClass) {
      // Case A: 기존 breakpoint class 교체
      // "h-20 md:h-48 bg-white" → "h-20 md:h-[200px] bg-white"
      return makeDiff(fullClassName, existingBpClass, newBpClass, ...);
    } else {
      // Case B: breakpoint class 추가 (base 유지)
      // "h-20 bg-white" → "h-20 md:h-[200px] bg-white"
      return makeAddDiff(fullClassName, newBpClass, ...);
    }
  } else {
    // 기존 로직 (base class 수정)
    return refactorTailwind(change, component, sources);
  }
}
```

### 5.4 applyDiff() Safety Guard 수정 (C-1 Fix)

**문제**: 현재 `applyDiff()` (src/app/api/apply/route.ts:14-19)는 **모든 파일**에 대해 line count 변경을 거부한다. `@media` 블록 생성은 필연적으로 라인 수가 증가하므로, CSS Module/Plain CSS 반응형 refactor가 전부 실패한다.

```typescript
// 현재 코드 (line 14-19) — 모든 파일에 적용
const origLines = original.split('\n').length;
const modLines = modified.split('\n').length;
if (origLines !== modLines) {
  return { ok: false, reason: `Rejected: line count changed` };
}
```

**수정**: CSS 파일에 대해서는 line count 검증을 면제한다. CSS 파일은 이미 JS structure 검증을 skip하고 있으므로(line 33-43), line count 검증도 CSS 전용 경로로 이동한다.

```typescript
// 수정 후 — CSS 파일은 line count 변경 허용
const isCssFile = diff.file.endsWith('.css') || diff.file.endsWith('.scss');

if (!isCssFile) {
  const origLines = original.split('\n').length;
  const modLines = modified.split('\n').length;
  if (origLines !== modLines) {
    return { ok: false, reason: `Rejected: line count changed (${origLines}→${modLines})` };
  }
}
```

**@media 블록 생성 시 Diff 형식**: 새로운 @media 블록 추가 시, strategy는 CSS 파일의 마지막 rule을 original로 잡고, 해당 rule + 새 @media 블록을 modified로 반환한다.

```typescript
// 예시: @media 블록 추가 diff
{
  file: 'components/Card.module.css',
  original: '.card {\n  height: 200px;\n}',                    // 기존 마지막 rule
  modified: '.card {\n  height: 200px;\n}\n\n@media (min-width: 768px) {\n  .card {\n    height: 300px;\n  }\n}',
  lineNumber: 5,
  explanation: 'responsive: @media (min-width: 768px) height: 300px',
  strategy: 'css-module',
}
```

이렇게 하면 `applyDiff()`의 snippet find-and-replace가 정상 동작하며, CSS 파일이므로 line count 검증도 통과한다.

### 5.5 CSS Module / Plain CSS @media 생성

```typescript
// postcss-utils.ts에 추가

function findOrCreateMediaRule(
  cssContent: string,
  selector: string,        // '.card'
  minWidth: number,        // 768
  properties: Record<string, string>,  // { height: '300px' }
): { modified: string; ruleOriginal: string; ruleModified: string } | null {
  const root = postcss.parse(cssContent);
  const mediaQuery = `(min-width: ${minWidth}px)`;

  // 1. 기존 @media 블록 안에서 selector 찾기
  let targetRule: postcss.Rule | null = null;
  let targetMedia: postcss.AtRule | null = null;

  root.walkAtRules('media', (atRule) => {
    if (atRule.params.includes(`min-width: ${minWidth}px`) ||
        atRule.params.includes(`min-width:${minWidth}px`)) {
      targetMedia = atRule;
      atRule.walkRules((rule) => {
        if (rule.selector === `.${selector}`) {
          targetRule = rule;
        }
      });
    }
  });

  if (targetRule) {
    // Case A: 기존 @media + 기존 rule → 속성만 수정
    for (const [prop, value] of Object.entries(properties)) {
      let found = false;
      (targetRule as postcss.Rule).walkDecls(prop, (decl) => {
        decl.value = value;
        found = true;
      });
      if (!found) {
        (targetRule as postcss.Rule).append(postcss.decl({ prop, value }));
      }
    }
  } else if (targetMedia) {
    // Case B: 기존 @media 있지만 rule 없음 → rule 추가
    const newRule = postcss.rule({ selector: `.${selector}` });
    for (const [prop, value] of Object.entries(properties)) {
      newRule.append(postcss.decl({ prop, value }));
    }
    targetMedia.append(newRule);
  } else {
    // Case C: @media 블록 자체가 없음 → 새로 생성
    const newMedia = postcss.atRule({ name: 'media', params: mediaQuery });
    const newRule = postcss.rule({ selector: `.${selector}` });
    for (const [prop, value] of Object.entries(properties)) {
      newRule.append(postcss.decl({ prop, value }));
    }
    newMedia.append(newRule);
    root.append(newMedia);
  }

  const modified = root.toString();
  if (modified === cssContent) return null;

  return { modified, ruleOriginal: cssContent, ruleModified: modified };
}
```

### 5.5 VS Code Extension Architecture

```
┌─────────────────────────────────────────────────────────┐
│ VS Code Extension Host (Node.js)                        │
│                                                         │
│  extension.ts                                           │
│  ├─ activate()                                          │
│  │  ├─ 명령어 등록: wigss.open, wigss.scan, wigss.save │
│  │  ├─ 설정 로드: targetPort, apiKey                    │
│  │  └─ Webview 패널 생성                                │
│  │                                                      │
│  ├─ MessageBridge                                       │
│  │  ├─ webview.onDidReceiveMessage()                    │
│  │  │  ├─ scan/drag_end/resize_end/chat → Agent Loop   │
│  │  │  ├─ refactor → generateRefactorDiffs()            │
│  │  │  └─ apply → applyDiff() + writeSourceFile()       │
│  │  └─ agent.onMessage() → webview.postMessage()        │
│  │                                                      │
│  ├─ DevServerManager                                    │
│  │  ├─ detectPort(packageJson)                          │
│  │  ├─ checkPort(port) → boolean                        │
│  │  ├─ startDevServer(projectPath)                      │
│  │  └─ waitForPort(port, timeout)                       │
│  │                                                      │
│  └─ host/ (기존 코드 이동)                               │
│     ├─ agent-loop.ts                                    │
│     ├─ openai-client.ts                                 │
│     ├─ refactor-client.ts                               │
│     ├─ strategies/*                                     │
│     ├─ file-utils.ts                                    │
│     └─ *.ts (유틸리티)                                   │
│                                                         │
│            ↕ webview.postMessage / onDidReceiveMessage   │
│                                                         │
│  Webview (Browser sandbox)                              │
│  ├─ index.html (Vite 빌드 결과)                         │
│  ├─ React + Zustand                                     │
│  ├─ components/ (그대로)                                 │
│  ├─ stores/                                             │
│  │  ├─ editor-store.ts (그대로)                          │
│  │  └─ agent-store.ts (WebSocket → vscodeApi)           │
│  └─ iframe → http://localhost:{PORT}                    │
└─────────────────────────────────────────────────────────┘
```

### 5.6 Webview HTML 생성

```typescript
function getWebviewHtml(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  targetPort: number,
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'index.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', 'index.css')
  );
  const nonce = crypto.randomBytes(16).toString('hex');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             frame-src http://localhost:*;
             script-src 'nonce-${nonce}';
             style-src ${webview.cspSource} 'unsafe-inline';
             img-src ${webview.cspSource} data:;
             connect-src http://localhost:*;">
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.__WIGSS_CONFIG__ = { targetPort: ${targetPort} };
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
```

### 5.7 Dev Server Manager

```typescript
class DevServerManager {
  async detectPort(projectPath: string): Promise<number> {
    const pkgPath = path.join(projectPath, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    const devScript = pkg.scripts?.dev || '';

    // "next dev --port 3000" → 3000
    // "vite --port 5173" → 5173
    // "react-scripts start" → 3000 (CRA 기본값)
    const portMatch = devScript.match(/--port\s+(\d+)|-p\s+(\d+)/);
    if (portMatch) return parseInt(portMatch[1] || portMatch[2]);

    if (devScript.includes('vite')) return 5173;
    return 3000; // 기본값
  }

  async checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}`, () => resolve(true));
      req.on('error', () => resolve(false));
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    });
  }

  async startDevServer(projectPath: string): Promise<vscode.Terminal> {
    const terminal = vscode.window.createTerminal({
      name: 'WIGSS Dev Server',
      cwd: projectPath,
    });

    // package manager 감지
    const hasYarnLock = await this.fileExists(path.join(projectPath, 'yarn.lock'));
    const hasPnpmLock = await this.fileExists(path.join(projectPath, 'pnpm-lock.yaml'));
    const cmd = hasPnpmLock ? 'pnpm dev' : hasYarnLock ? 'yarn dev' : 'npm run dev';

    terminal.sendText(cmd);
    terminal.show(true); // preserveFocus = true
    return terminal;
  }

  async waitForPort(port: number, timeoutMs: number = 30000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.checkPort(port)) return true;
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  }
}
```

### 5.8 Message Bridge Protocol

기존 3개 통신 채널을 1개로 통합:

| 기존 | Extension |
|------|-----------|
| `new WebSocket(url)` → `.send()` | `vscodeApi.postMessage()` |
| `ws.onmessage` | `window.addEventListener('message')` |
| `fetch('/api/refactor')` | `vscodeApi.postMessage({ type: 'refactor' })` |
| `fetch('/api/apply')` | `vscodeApi.postMessage({ type: 'apply' })` |

**Message format (동일 유지)**:

```typescript
// Webview → Extension Host
interface BridgeRequest {
  type: string;       // 'scan' | 'resize_end' | 'refactor' | 'apply' | ...
  payload: any;
  requestId?: string; // fetch 대체 시 응답 매칭용
}

// Extension Host → Webview
interface BridgeResponse {
  type: string;
  payload: any;
  requestId?: string; // 요청에 대한 응답일 경우
}
```

### 5.9 빌드 파이프라인

```
┌─ 빌드 ────────────────────────────────────────────────┐
│                                                        │
│  1. Extension Host (esbuild)                           │
│     src/extension.ts → dist/extension.js               │
│     --platform=node --external:vscode                  │
│     포함: agent-loop, openai, refactor, strategies,    │
│           ast-utils, postcss-utils, file-utils         │
│                                                        │
│  2. Webview (Vite)                                     │
│     src/webview/index.tsx → dist/webview/index.js      │
│     --target=es2020 (브라우저용)                        │
│     포함: React, Zustand, VisualEditor, AgentPanel,    │
│           FloatingToolbar, component-detector, stores   │
│                                                        │
│  3. Package (vsce)                                     │
│     vsce package → wigss-2.1.0.vsix                    │
│     .vscodeignore: node_modules, src/, tests/          │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 5.10 테스트 전략

| 모듈 | 테스트 유형 | 커버리지 목표 |
|------|------------|-------------|
| Breakpoint 매핑 (`resolveBreakpoint`) | Unit | >90% |
| `findTwClass` 확장 (prefix 매칭) | Unit | >90% |
| Tailwind 반응형 refactor | Unit + Integration | >80% |
| `findOrCreateMediaRule` (PostCSS) | Unit | >80% |
| CSS Module 반응형 refactor | Integration | >70% |
| Message Bridge 라우팅 | Unit (mock webview) | >70% |
| Dev Server Manager | Unit (mock http/fs) | >60% |

**추가 테스트 케이스 (Tailwind breakpoint)**:

```
1. base only: "h-20 bg-white" + md resize → "h-20 md:h-[200px] bg-white"
2. existing bp: "h-20 md:h-48 bg-white" + md resize → "h-20 md:h-[200px] bg-white"
3. multiple bp: "h-20 sm:h-32 md:h-48 lg:h-64" + md resize → sm/lg 유지, md만 변경
4. base change: "h-20 md:h-48" + no-bp resize → "h-[200px] md:h-48" (md 유지)
5. negative: "flex bg-white" + md resize → "flex md:h-[200px] bg-white" (class 추가)
6. width + height: 동시 변경 시 두 prefix class 모두 생성
7. custom bp: tailwind.config의 커스텀 breakpoint 읽기
```

---

## 6. Implementation Phases

### Phase 1: Responsive Breakpoint Editor (Week 1-2)

**목표**: Tailwind 프로젝트에서 breakpoint별 비주얼 편집이 동작한다.

- [ ] `ComponentChange` 타입에 `breakpoint` 필드 추가 (FR-104)
- [ ] `editor-store.ts`에 `currentBreakpoint` state 추가
- [ ] `resolveBreakpoint()` 함수 구현 (FR-103)
- [ ] FloatingToolbar에 Breakpoint 모드 토글 + preset 버튼 추가 (FR-101, FR-102)
- [ ] VisualEditor iframe 폭 동적 조절 + 컴포넌트 재스캔 (FR-114)
- [ ] `findTwClass()` 확장 — breakpoint prefix 인식 (FR-108)
- [ ] Tailwind 반응형 refactor 로직 (FR-105, FR-106, FR-107)
- [ ] Breakpoint indicator UI (FR-109)
- [ ] PostCSS `findOrCreateMediaRule()` 구현 (FR-112)
- [ ] CSS Module 반응형 refactor (FR-110)
- [ ] Plain CSS 반응형 refactor (FR-111)
- [ ] 테스트: breakpoint 매핑, Tailwind prefix, @media 생성

**Deliverable**: `npx wigss`에서 breakpoint 모드 활성화 가능. Tailwind/CSS 반응형 코드 자동 생성.

### Phase 2: VS Code Extension (Week 3-5)

**목표**: VS Code Marketplace에 퍼블리시 가능한 Extension.

- [ ] Extension scaffold 생성 (`yo code` 또는 수동) (FR-201)
- [ ] Webview Panel 생성 + CSP 설정 (FR-202, FR-203)
- [ ] Vite 기반 webview 빌드 파이프라인 (FR-214)
- [ ] esbuild 기반 extension host 빌드 (FR-215)
- [ ] Message Bridge 구현 (FR-204)
- [ ] Agent Store WebSocket → postMessage 전환 (FR-208)
- [ ] FloatingToolbar fetch → postMessage 전환 (FR-209)
- [ ] /api/refactor → bridge 직접 호출 (FR-206)
- [ ] /api/apply → bridge 직접 호출 (FR-207)
- [ ] Agent Loop extension host 실행 (FR-205)
- [ ] DevServerManager 구현 (FR-210, FR-211, FR-212)
- [ ] OpenAI API 키 SecretStorage (FR-213)
- [ ] Extension 설정 UI (FR-217)
- [ ] Marketplace 퍼블리시 설정 (FR-216)
- [ ] E2E 테스트: Extension 활성화 → Webview 로드 → 기본 동작

**Deliverable**: VS Code Marketplace에 `wigss` Extension 퍼블리시.

### Phase 3: 안정화 + 테스트 보강 (Week 6)

- [ ] Windows/Linux 환경 테스트
- [ ] 다양한 프레임워크 테스트 (Next.js, Vite, CRA, Remix)
- [ ] 에러 핸들링 강화 (dev server 실패, iframe 로드 실패 등)
- [ ] README + 문서 업데이트
- [ ] 사용자 피드백 반영

**Deliverable**: 안정적인 v2.1 릴리즈.

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Breakpoint refactor 정확도 | >95% | 테스트 통과율 (base class 보존 + prefix 생성) |
| Extension 설치 후 첫 사용 성공률 | >80% | dev server 자동 실행 성공률 |
| Extension 활성화 → 에디터 로드 | <5s | VS Code performance trace |
| Marketplace 설치 수 (첫 달) | >500 | VS Code Marketplace analytics |
| GitHub Stars (첫 달) | >200 | GitHub API |
| 코드 품질 점수 | 75+ | 가중평균 (현재 68.9) |
| 테스트 커버리지 | >50% | vitest --coverage |
| 새 critical 버그 | 0 | Issue tracker |

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| VS Code CSP가 iframe 차단 | Low (20%) | Critical | CSP `frame-src localhost:*`로 해결. 유사 Extension 다수 존재. |
| Tailwind breakpoint prefix 파싱 오류 | Medium (40%) | High | regex를 충분히 테스트. 기존 class 백업 후 수정. |
| Dev server 자동 감지 실패 (비표준 스크립트) | Medium (50%) | Medium | 수동 port 설정 UI 제공 (FR-217). fallback. |
| PostCSS @media 생성 시 기존 스타일 손상 | Low (15%) | High | PostCSS AST 사용 (문자열 조작 아님). 백업 파일 유지. |
| Webview ↔ Extension Host 메시지 유실 | Low (10%) | Medium | requestId 기반 ACK 패턴. timeout + retry. |
| Extension 번들 크기 과대 (>50MB) | Medium (30%) | Low | tree-shaking, external 설정, .vscodeignore 최적화. |

---

## 9. Migration Path — Monorepo 구조 (C-2 Fix)

CLI npm 패키지와 VS Code Extension은 **별도의 package.json**이 필수이다. CLI는 `"bin"` 필드가, Extension은 `"engines.vscode"` + `"contributes"` 필드가 필요하며 이 둘은 공존 불가.

**pnpm workspace monorepo** 구조를 채택한다:

```
wigss/
├─ pnpm-workspace.yaml
├─ packages/
│  ├─ core/                    ← 공유 코드 (비즈니스 로직)
│  │  ├─ package.json          ← name: "@wigss/core"
│  │  ├─ src/
│  │  │  ├─ agent/             ← agent-loop, openai-client, refactor-client
│  │  │  ├─ strategies/        ← tailwind, inline-style, css-module, plain-css
│  │  │  ├─ lib/               ← ast-utils, postcss-utils, css-property-utils
│  │  │  ├─ component-detector.ts
│  │  │  ├─ css-strategy-detector.ts
│  │  │  ├─ file-utils.ts
│  │  │  └─ types/index.ts
│  │  └─ tsconfig.json
│  │
│  ├─ cli/                     ← npm 패키지 (npx wigss)
│  │  ├─ package.json          ← name: "wigss", bin: "./bin/cli.js"
│  │  ├─ bin/cli.js
│  │  ├─ src/
│  │  │  ├─ app/               ← Next.js 앱 (API routes, React pages)
│  │  │  ├─ components/        ← VisualEditor, FloatingToolbar, AgentPanel
│  │  │  ├─ stores/            ← editor-store, agent-store
│  │  │  └─ instrumentation.ts
│  │  ├─ next.config.js
│  │  └─ tsconfig.json
│  │
│  └─ vscode/                  ← VS Code Extension
│     ├─ package.json          ← name: "wigss-vscode"
│     │                          engines: { vscode: "^1.85.0" }
│     │                          contributes: { commands: [...] }
│     │                          main: "./dist/extension.js"
│     ├─ src/
│     │  ├─ extension.ts
│     │  ├─ message-bridge.ts
│     │  ├─ dev-server-manager.ts
│     │  └─ webview/           ← React UI (cli/src/components 재사용 or 복사)
│     │     ├─ index.tsx
│     │     ├─ components/     ← 심볼릭 링크 또는 tsconfig paths로 참조
│     │     └─ stores/
│     ├─ esbuild.config.js
│     ├─ vite.webview.config.ts
│     ├─ .vscodeignore
│     └─ tsconfig.json
│
└─ demo-target/                ← 테스트용 데모 앱 (기존 유지)
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'demo-target'
```

**의존성 흐름**:
```
@wigss/core ← packages/cli (npm: "wigss")
@wigss/core ← packages/vscode (extension: "wigss-vscode")
```

**빌드 명령어**:
```bash
# CLI 개발
pnpm --filter cli dev

# Extension 빌드
pnpm --filter vscode build

# 전체 빌드
pnpm -r build

# Extension 패키징
cd packages/vscode && vsce package
```

**마이그레이션 순서**:
1. Phase 1 (Breakpoint)은 현재 단일 package.json 구조에서 구현 (monorepo 이전 전)
2. Phase 3 시작 시 monorepo로 구조 변환
3. `@wigss/core`에 공유 코드 추출
4. `packages/cli`에 기존 CLI/Next.js 코드 이동
5. `packages/vscode`에 Extension 코드 작성

기존 `npx wigss` 사용자에게 영향 없음. npm 패키지명(`wigss`)은 유지된다.

---

## Appendix A: 변경 대상 파일 목록

### 신규 파일

| 파일 | 라인(예상) | 용도 |
|------|-----------|------|
| `extension/extension.ts` | ~120 | Extension 진입점 |
| `extension/message-bridge.ts` | ~100 | 메시지 라우팅 |
| `extension/dev-server-manager.ts` | ~80 | Dev server 감지/실행 |
| `src/webview/index.tsx` | ~40 | Webview React 진입점 |
| `vite.webview.config.ts` | ~30 | Webview 빌드 설정 |
| `esbuild.config.js` | ~20 | Extension host 빌드 |

### 수정 파일

| 파일 | 변경량 | 내용 |
|------|--------|------|
| `src/types/index.ts` | +5 lines | `ComponentChange.breakpoint` 필드 |
| `src/stores/editor-store.ts` | +15 lines | `currentBreakpoint` state, breakpoint mode |
| `src/stores/agent-store.ts` | +30 lines | WebSocket/postMessage 분기 |
| `src/components/editor/FloatingToolbar.tsx` | +80 lines | Breakpoint UI, fetch→postMessage |
| `src/components/editor/VisualEditor.tsx` | +20 lines | viewport 폭 동적 조절 |
| `src/lib/agent/strategies/tailwind-strategy.ts` | +60 lines | breakpoint prefix 로직 |
| `src/lib/postcss-utils.ts` | +50 lines | `findOrCreateMediaRule()` |
| `src/lib/agent/strategies/css-module-strategy.ts` | +30 lines | @media 블록 생성 |
| `src/lib/agent/strategies/plain-css-strategy.ts` | +30 lines | @media 블록 생성 |

### 제거 파일 (Extension 전환 시)

없음. CLI와 Extension 동시 지원.

---

## Appendix B: Breakpoint ↔ CSS 전략 매트릭스

| | Tailwind | CSS Module | Plain CSS | Inline Style |
|---|---------|------------|-----------|-------------|
| **Base (no breakpoint)** | `h-[200px]` | `.card { height: 200px }` | `.card { height: 200px }` | `style={{ height: '200px' }}` |
| **sm (640px)** | `sm:h-[200px]` | `@media (min-width: 640px) { .card { height: 200px } }` | 동일 | **불가** |
| **md (768px)** | `md:h-[200px]` | `@media (min-width: 768px) { .card { height: 200px } }` | 동일 | **불가** |
| **lg (1024px)** | `lg:h-[200px]` | `@media (min-width: 1024px) { .card { height: 200px } }` | 동일 | **불가** |
| **xl (1280px)** | `xl:h-[200px]` | `@media (min-width: 1280px) { .card { height: 200px } }` | 동일 | **불가** |

> Inline style은 반응형 미지원. Breakpoint 모드에서 inline-style 전략 감지 시 "이 컴포넌트는 반응형 편집이 불가능합니다. Tailwind 또는 CSS file로 전환하세요." 경고 표시.
