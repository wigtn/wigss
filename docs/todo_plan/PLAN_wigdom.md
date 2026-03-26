# Task Plan: Wigdom

> **Generated from**: docs/prd/PRD_wigdom.md
> **Created**: 2026-03-26
> **Status**: pending

## Execution Config

| Option | Value | Description |
|--------|-------|-------------|
| `auto_commit` | true | 완료 시 자동 커밋 |
| `commit_per_phase` | true | Phase별 중간 커밋 |
| `quality_gate` | true | /auto-commit 품질 검사 |

## Phases

### Phase 1: MVP Core (환경 설정 + DOM 스캔 + Canvas)
- [ ] Next.js 14 프로젝트 초기 설정 (pnpm, TypeScript, Tailwind)
- [ ] 기본 UI 레이아웃 구성 (Toolbar + Canvas + Element Panel + Agent Panel)
- [ ] DOM 스캔 API 구현 (`/api/scan`) - Puppeteer headless → getBoundingClientRect + getComputedStyle
- [ ] URL 유효성 검사 (localhost 허용 목록, SSRF 방어)
- [ ] 요소 스마트 필터링 (invisible/trivial 제거, max 200개)
- [ ] DOM → 플랫 오브젝트 변환 로직
- [ ] Canvas 렌더링 (react-konva) - 색상 사각형 + 태그 라벨
- [ ] 드래그 이동 기능 구현
- [ ] Zustand 상태 관리 (elements, selectedIds, viewport, history)

### Phase 2: AI Agent Loop (핵심 차별화)
- [ ] Claude API 연동 (tool_use 활성화, SSE 스트리밍)
- [ ] Agent Loop 핵심 구현: OBSERVE→PLAN→EXECUTE→VERIFY 자율 반복
- [ ] Agent Tools 정의 (observe_canvas, create_plan, verify_layout, report_progress + Canvas 조작 도구)
- [ ] `/api/ai/agent` 엔드포인트 구현 (SSE 스트리밍 응답)
- [ ] `/api/ai/agent/control` 엔드포인트 구현 (일시정지/중단)
- [ ] Agent 실행 과정 시각화 UI (계획 표시, Step 진행률, 변경 로그)
- [ ] AI 응답 → Canvas 액션 실행 파이프라인
- [ ] 자동화 시나리오: 반응형 변환, 레이아웃 정리
- [ ] AI Agent Panel UI (목표 입력 + 실행 제어 버튼)

### Phase 3: Code Generation & Export
- [ ] Canvas → HTML/CSS 기본 역변환 (position: absolute)
- [ ] Auto 모드: Canvas 상태를 Claude AI에 전달 → flex/grid 레이아웃 자동 생성
- [ ] `/api/generate` 엔드포인트 구현
- [ ] 코드 미리보기 패널 UI
- [ ] 클립보드 복사 + 파일 다운로드 기능

### Phase 4: Polish & Demo
- [ ] Undo/Redo 구현 (히스토리 스택, max 50)
- [ ] 오브젝트 선택 시 정보 패널 (태그, class, id)
- [ ] 에러 핸들링 및 로딩 상태 UI (toast, skeleton)
- [ ] 전체 플로우 테스트 및 버그 수정
- [ ] 데모 시나리오 준비 (에이전트 자율 실행 데모 포함)

## Progress

| Metric | Value |
|--------|-------|
| Total Tasks | 0/28 |
| Current Phase | - |
| Status | pending |

## Execution Log

| Timestamp | Phase | Task | Status |
|-----------|-------|------|--------|
| - | - | - | - |
