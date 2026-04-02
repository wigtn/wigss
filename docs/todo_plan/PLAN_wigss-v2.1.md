# Task Plan: WIGSS v2.1 — Responsive Breakpoint + VS Code Extension

> **Generated from**: docs/prd/PRD_wigss-v2.1.md
> **Created**: 2026-03-30
> **Status**: in_progress

## Execution Config

| Option | Value | Description |
|--------|-------|-------------|
| `auto_commit` | true | Phase 완료 시 자동 커밋 |
| `commit_per_phase` | true | Phase별 중간 커밋 |
| `quality_gate` | true | /auto-commit 품질 검사 |

---

## Phase 1: Responsive Breakpoint Editor — Tailwind (Week 1)

> P0 기능. 가장 높은 ROI.

### 1.1 타입 & Store 확장
- [x] `ComponentChange`에 `breakpoint?: string` 필드 추가 (`types/index.ts`)
- [x] `editor-store.ts`에 `breakpointMode: boolean`, `currentBreakpoint: string | null` state 추가
- [x] `resolveBreakpoint(viewportWidth)` 함수 구현 (`lib/breakpoint-utils.ts`)
- [x] 테스트: resolveBreakpoint 매핑 정확도

### 1.2 UI — Breakpoint 모드
- [x] FloatingToolbar에 Breakpoint 토글 버튼 추가
- [x] Breakpoint preset 버튼 바 (sm/md/lg/xl/2xl)
- [ ] Viewport 폭 드래그 핸들 (연속 조절)
- [x] Breakpoint indicator (현재 breakpoint 이름 + px 표시)
- [x] VisualEditor iframe 폭 동적 리사이즈
- [x] Viewport 전환 시 컴포넌트 재스캔 (postMessage wigss-scan-request)

### 1.3 Tailwind Breakpoint Refactoring
- [x] `findTwClass()` 확장 — `sm:h-*`, `md:w-*` prefix 인식
- [x] 기존 breakpoint class 교체 로직 (`md:h-48` → `md:h-[200px]`)
- [x] breakpoint class 추가 로직 (base 유지 + prefix 추가)
- [x] base class 보존 검증 (breakpoint 수정 시 prefix 없는 class 유지)
- [x] width + height 동시 breakpoint 수정
- [x] 테스트: 7개 시나리오 (PRD Section 5.10 참조)

**Deliverable**: Tailwind 프로젝트에서 breakpoint별 비주얼 편집 동작.

---

## Phase 2: Responsive — CSS Module & Plain CSS (Week 2)

> P1 기능. Tailwind 외 프로젝트 커버.

### 2.1 PostCSS @media 확장
- [x] `findOrCreateMediaRule()` 함수 구현 (`postcss-utils.ts`)
  - Case A: 기존 @media + 기존 rule → 속성 수정
  - Case B: 기존 @media + rule 없음 → rule 추가
  - Case C: @media 없음 → 블록 생성
- [x] 테스트: 3개 Case 각각 검증

### 2.2 CSS Module 반응형
- [x] `css-module-strategy.ts`에 breakpoint 분기 추가
- [x] `findOrCreateMediaRule()` 호출로 @media 블록 생성/수정
- [x] 테스트: .module.css에 @media 블록 생성 확인

### 2.3 Plain CSS 반응형
- [x] `plain-css-strategy.ts`에 breakpoint 분기 추가
- [x] 테스트: .css 파일에 @media 블록 생성 확인

### 2.4 Inline Style 경고
- [x] inline-style 전략 + breakpoint 모드 조합 시 경고 메시지 표시
- [ ] 경고 UI: "이 컴포넌트는 반응형 편집이 불가능합니다"

**Deliverable**: CSS Module / Plain CSS 프로젝트에서도 반응형 편집 가능.

---

## Phase 2.5: applyDiff 수정 + Monorepo 준비 (Week 2 마무리)

> C-1, C-2 Critical fix. Extension 작업 전 필수.

### 2.5.1 applyDiff() CSS line count 면제
- [x] `src/app/api/apply/route.ts` 수정 — CSS 파일 line count 검증 면제
- [x] 테스트: @media 블록 추가 diff가 applyDiff를 통과하는지 검증
- [x] 기존 201 테스트 회귀 확인 (243 테스트 전체 통과)

### 2.5.2 Monorepo 구조 전환
- [ ] `pnpm-workspace.yaml` 생성
- [ ] `packages/core/` — 공유 코드 추출 (agent, strategies, lib, types)
- [ ] `packages/cli/` — 기존 CLI + Next.js 코드 이동
- [ ] `packages/vscode/` — 빈 scaffold 생성 (Phase 3에서 구현)
- [ ] `pnpm -r build` 전체 빌드 검증
- [ ] `npx wigss` CLI 동작 검증 (기존 기능 회귀 없음)

**Deliverable**: Monorepo 구조. CLI 정상 동작. Extension scaffold 준비.

---

## Phase 3: VS Code Extension — Core (Week 3-4)

> P0 기능. 배포 채널 확보.

### 3.1 Extension Scaffold
- [ ] `packages/vscode/` 디렉토리에 Extension 코드 작성
- [ ] `extension.ts` — activate/deactivate, 명령어 등록
- [ ] `package.json` contributes 설정 (commands, configuration)
- [ ] `.vscodeignore` 작성

### 3.2 빌드 파이프라인
- [ ] esbuild 설정 — extension host 번들 (Node.js)
- [ ] Vite 설정 — webview 번들 (Browser)
- [ ] 빌드 스크립트: `build:ext`, `build:webview`, `build`
- [ ] 빌드 검증: 두 번들 모두 성공적으로 생성

### 3.3 Webview Panel
- [ ] `getWebviewHtml()` — CSP, nonce, script/style URI
- [ ] `src/webview/index.tsx` — React 앱 진입점
- [ ] Webview에서 React UI 렌더링 확인

### 3.4 Message Bridge
- [ ] `message-bridge.ts` — 양방향 메시지 라우팅
- [ ] Agent 메시지 (scan, drag_end, resize_end, chat 등) → Agent Loop
- [ ] Refactor 요청 → generateRefactorDiffs() 직접 호출
- [ ] Apply 요청 → applyDiff() + writeSourceFile() 직접 호출
- [ ] Agent → Webview 응답 전달

### 3.5 Frontend 전환
- [ ] `agent-store.ts` — WebSocket/postMessage 분기 (`IS_VSCODE` 플래그)
- [ ] `FloatingToolbar.tsx` — fetch/postMessage 분기
- [ ] `page.tsx` → `webview/index.tsx` 연결 로직 조정

### 3.6 Dev Server Manager
- [ ] `dev-server-manager.ts` 구현
- [ ] package.json에서 dev script + port 감지
- [ ] package manager 감지 (npm/yarn/pnpm)
- [ ] localhost:PORT health check
- [ ] VS Code 터미널에서 자동 실행
- [ ] waitForPort() — 30초 timeout + progress notification
- [ ] 이미 실행 중이면 skip

### 3.7 설정 & 보안
- [ ] OpenAI API 키 — VS Code SecretStorage
- [ ] Extension 설정 UI (targetPort, apiKey)
- [ ] 파일 쓰기 경로 검증 (isPathSafe)

**Deliverable**: VS Code에서 WIGSS 에디터 실행 가능.

---

## Phase 4: Extension — 안정화 & 퍼블리시 (Week 5)

### 4.1 크로스 플랫폼 테스트
- [ ] macOS 테스트
- [ ] Windows 테스트
- [ ] Linux 테스트

### 4.2 프레임워크 호환성
- [ ] Next.js 프로젝트 테스트
- [ ] Vite 프로젝트 테스트
- [ ] CRA 프로젝트 테스트

### 4.3 에러 핸들링
- [ ] Dev server 시작 실패 시 사용자 안내
- [ ] iframe 로드 실패 시 재시도 + 수동 설정 안내
- [ ] OpenAI API 키 미설정 시 안내
- [ ] Webview ↔ Extension 메시지 timeout 처리

### 4.4 퍼블리시
- [ ] Extension 아이콘 + 메타데이터
- [ ] Marketplace README 작성
- [ ] `vsce package` 빌드 검증
- [ ] Marketplace 퍼블리시

**Deliverable**: VS Code Marketplace에 WIGSS v2.1 퍼블리시.

---

## Phase 5: 테스트 보강 (Week 6)

- [x] Breakpoint 관련 테스트 추가 (목표 30개+) → 42개 작성
- [ ] Message Bridge 단위 테스트
- [ ] Dev Server Manager 단위 테스트
- [ ] 전체 커버리지 50%+ 달성
- [x] 기존 201 테스트 회귀 확인 → 243 테스트 전체 통과

**Deliverable**: 안정적인 테스트 스위트.

---

## Progress

| Metric | Value |
|--------|-------|
| Total Tasks | 27/52 |
| Current Phase | Phase 1-2 완료, Phase 2.5.2+ 대기 |
| Status | in_progress |

## Execution Log

| Timestamp | Phase | Task | Status |
|-----------|-------|------|--------|
| 2026-03-30 | Phase 1.1 | breakpoint-utils.ts 생성 | completed |
| 2026-03-30 | Phase 1.1 | ComponentChange breakpoint 필드 추가 | completed |
| 2026-03-30 | Phase 1.1 | editor-store breakpointMode 추가 | completed |
| 2026-03-30 | Phase 1.2 | FloatingToolbar Breakpoint UI 추가 | completed |
| 2026-03-30 | Phase 1.2 | VisualEditor breakpoint viewport 업데이트 | completed |
| 2026-03-30 | Phase 1.3 | tailwind-strategy breakpoint prefix 지원 | completed |
| 2026-03-30 | Phase 2.1 | findOrCreateMediaRule 구현 | completed |
| 2026-03-30 | Phase 2.2 | css-module-strategy breakpoint 분기 | completed |
| 2026-03-30 | Phase 2.3 | plain-css-strategy breakpoint 분기 | completed |
| 2026-03-30 | Phase 2.4 | inline-style breakpoint 경고 (refactor-client) | completed |
| 2026-03-30 | Phase 2.5.1 | applyDiff CSS line count 면제 | completed |
| 2026-03-30 | Phase 5 | breakpoint 테스트 42개 작성 | completed |
| 2026-03-30 | - | 전체 테스트 243개 통과 | verified |
| 2026-03-30 | - | 빌드 성공 확인 | verified |
