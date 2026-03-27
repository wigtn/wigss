# Task Plan: WIGSS

> **PRD**: docs/prd/PRD_wigss.md (v5.1)
> **Updated**: 2026-03-28
> **Status**: in_progress
> **Hackathon**: 2026-03-28
> **Team**: Team WIGSS (WIGTN Crew)

## Execution Config

| Option | Value |
|--------|-------|
| `auto_commit` | true |
| `commit_per_phase` | true |
| `quality_gate` | true |

---

## D-1 (3/27) — 사전 준비

### Phase 0: 환경 검증 + 스캐폴딩 (2h)

- [x] 0.1 Playwright 설치 + localhost 스캔 테스트 (DOM + 스크린샷)
- [x] 0.2 OpenAI API function calling 테스트
- [x] 0.3 Claude API tool use 테스트
- [x] 0.4 WebSocket (ws) 서버-클라이언트 연결 PoC
- [x] 0.5 iframe + fabric.js Canvas 드래그/리사이즈 PoC
- [x] 0.6 Next.js 14 프로젝트 생성 (pnpm, TypeScript, Tailwind)
- [x] 0.7 디렉토리 구조 생성 (PRD 6.5 기준)
- [x] 0.8 의존성 설치 (playwright, openai, @anthropic-ai/sdk, zustand, fabric, ws, chokidar, commander, open)
- [x] 0.9 .env.local (OPENAI_API_KEY + ANTHROPIC_API_KEY) + CLAUDE.md
- [x] 0.10 bin/cli.js 기본 구조 (commander --port, cwd 감지, open)

**판단**: 0.1~0.5 실패 시 PRD 9.1 Fallback 참조

### Phase 0.5: demo-target 생성 (1h)

- [x] 0.11 demo-target/ Next.js + Tailwind 프로젝트
- [x] 0.12 Navbar (h-16, 의도적 높이 비효율)
- [x] 0.13 CardGrid + Card 3개 (grid-cols-3, 간격 불균일 16px/24px)
- [x] 0.14 Sidebar (상단 정렬 8px 어긋남)
- [x] 0.15 Footer (높이 과도 200px)
- [x] 0.16 localhost:3001 서빙 확인
- [x] 0.17 사전 스캔 결과 캐싱 (데모 모드용)

### Phase 1: 에이전트 코어 + 컴포넌트 인식 (3h) ★핵심★

- [x] 1.1 WebSocket 서버 (ws/route.ts 또는 별도 ws-server.ts)
- [x] 1.2 에이전트 루프 (lib/agent/agent-loop.ts) — 이벤트 기반
- [x] 1.3 OpenAI 클라이언트 (lib/agent/openai-client.ts) — function calling
- [x] 1.4 Playwright DOM 스캔 + 스크린샷 + 소스 파일 목록
- [x] 1.5 GPT-4o 컴포넌트 자동 인식 (identify_component tool)
- [x] 1.6 GPT-4o 디자인 제안 (스캔 후 자동 연쇄)
- [x] 1.7 Zustand 스토어 (editor-store + agent-store)
- [x] 1.8 UI: 플로팅 툴바 + VisualEditor + AgentPanel
- [x] 1.9 AgentPanel: 상태 표시 + 인식 로그 + 제안 카드 [적용]/[무시]
- [x] 1.10 데모 모드 분기

**검증**: URL → 스캔 → WebSocket으로 컴포넌트 인식 → 제안 표시
**커밋**: `feat: WebSocket agent + component detection + design suggestions`

### D-1 저녁: E2E 검증

- [ ] demo-target → 에이전트 연결 → 스캔 → 인식 → 제안
- [ ] 에러 케이스 + 데모 모드 확인

---

## D-Day (3/28) — 해커톤

### Phase 2: 시각적 편집 + 실시간 피드백 + 채팅 (3h) ★핵심★

- [ ] 2.1 VisualEditor: iframe(localhost:3001) + fabric.js Canvas
- [ ] 2.2 ComponentOverlay: 컴포넌트별 점선 테두리 + 드래그/리사이즈 핸들
- [ ] 2.3 드래그 이동 (오버레이만, 실제 페이지 안 움직임)
- [ ] 2.4 리사이즈 (핸들 드래그)
- [ ] 2.5 변경 delta 추적 (Zustand editor-store)
- [ ] 2.6 드래그/리사이즈 끝 → WebSocket → GPT-4o 실시간 피드백
      - 크기 일관성, 간격 균일성, 정렬, 최소 크기, 겹침 검토
      - 피드백 카드 [적용]/[무시] (적용 시 AI 재호출 없이 즉시)
- [ ] 2.7 ChatInterface: 채팅 입력창 + 메시지 표시
- [ ] 2.8 의견 요청 모드: "푸터 어떻게 하지?" → 분석 + 제안
- [ ] 2.9 위임 모드: "알아서 해줘" → 계획 표시 → [진행] → 오버레이 자동 수정
- [ ] 2.10 [모바일 보기] → GPT-4o 반응형 자동 변환 (375px)

**검증**: 드래그 → 피드백 표시 + 채팅 대화 + 모바일 변환
**커밋**: `feat: Visual editor + realtime feedback + chat interface`

### Phase 3: 리팩토링 + 자기 검증 (2h) ★핵심★

- [ ] 3.1 Claude 클라이언트 (lib/agent/claude-client.ts)
- [ ] 3.2 [저장] → Claude API로 변경 delta → 소스코드 diff 생성
- [ ] 3.3 DiffPreview 패널 (before/after + 설명)
- [ ] 3.4 POST /api/apply → 소스 파일 수정 + 백업 (REST, 안전)
- [ ] 3.5 자기 검증 루프: Playwright 재렌더링 → 비교 → Claude 재수정 (최대 3회)
- [ ] 3.6 AgentPanel에 검증 상태 표시
- [ ] 3.7 chokidar 파일 변경 감지 → "다시 스캔?" 알림

**검증**: 편집 → 저장 → diff → 적용 → 검증 → (불일치 시) 재수정 → 통과
**커밋**: `feat: Claude refactoring + self-verification loop`

### Phase 4: Polish & Demo (2h)

- [ ] 4.1 Undo/Redo
- [ ] 4.2 에러 핸들링 (toast + 재시도 + WebSocket 재연결)
- [ ] 4.3 UI 폴리싱 (다크 모드, 오버레이 색상, 로고)
- [ ] 4.4 bin/cli.js 완성 (commander, open, 포트 감지)
- [ ] 4.5 데모 리허설 1회: 타이밍 (3분)
- [ ] 4.6 데모 리허설 2회: 에러 케이스
- [ ] 4.7 데모 리허설 3회: 발표 멘트
- [ ] 4.8 Fallback 영상 녹화
- [ ] 4.9 발표 자료 (1-2장)

**커밋**: `feat: Polish - CLI, undo/redo, demo prep`

---

## 시간별 타임라인

### D-1

| 시간 | 작업 |
|------|------|
| 오전 | Phase 0 (환경 검증 + 스캐폴딩) |
| 오후 전반 | Phase 0.5 (demo-target) |
| 오후 2~3.5h | 1.1~1.5 (WebSocket + 에이전트 + 인식) |
| 오후 3.5~5h | 1.6~1.10 (제안 + UI + AgentPanel) |
| 저녁 | E2E 검증 |

### D-Day

| 시간 | 작업 |
|------|------|
| 00~01h | 2.1~2.4 (iframe + fabric.js Canvas + 드래그/리사이즈) |
| 01~02h | 2.5~2.6 (변경 추적 + 실시간 피드백) |
| 02~03h | 2.7~2.10 (채팅 + 반응형) |
| 03~04h | 3.1~3.3 (Claude 리팩토링 + diff) |
| 04~05h | 3.4~3.7 (적용 + 검증 루프 + 파일 감시) |
| 05~05.5h | 4.1~4.4 (안정성 + CLI + UI) |
| 05.5~06.5h | 4.5~4.7 (데모 리허설 3회) |
| 06.5~07h | 4.8~4.9 (Fallback + 발표자료) |

## 시간 부족 시 절삭

| 남은 시간 | 절삭 | 보존 |
|-----------|------|------|
| 5h+ | 없음 | 전체 |
| 3h | 반응형, 검증 | 편집 + 피드백 + 채팅 + 리팩토링 |
| 2h | 리팩토링, 채팅 | 스캔 + 인식 + 편집 + 피드백 |
| 1h | 편집 이후 | 인식 + 피드백 데모 + Fallback 영상 |

**우선순위**: 인식 > 피드백 > 채팅 > 편집기 > 리팩토링 > 검증 > 반응형

---

## Progress

| Metric | Value |
|--------|-------|
| Total Tasks | 27/50 |
| Current Phase | Phase 1 completed |
| Status | in_progress |

## Execution Log

| Timestamp | Phase | Task | Status |
|-----------|-------|------|--------|
| 2026-03-28 | Phase 0 | Next.js 14 프로젝트 생성 + 의존성 | completed |
| 2026-03-28 | Phase 0 | 디렉토리 구조 + 타입 정의 + CLI | completed |
| 2026-03-28 | Phase 0 | Playwright Chromium 설치 | completed |
| 2026-03-28 | Phase 0.5 | demo-target 전체 (Navbar, CardGrid, Card, Sidebar, Footer) | completed |
| 2026-03-28 | Phase 0.5 | 사전 스캔 결과 캐싱 | completed |
| 2026-03-28 | Phase 1 | WebSocket 서버 + 에이전트 루프 | completed |
| 2026-03-28 | Phase 1 | OpenAI 클라이언트 + tools 정의 | completed |
| 2026-03-28 | Phase 1 | Playwright DOM 스캔 + 파일 유틸 | completed |
| 2026-03-28 | Phase 1 | Zustand 스토어 (editor + agent) | completed |
| 2026-03-28 | Phase 1 | UI: FloatingToolbar + VisualEditor + AgentPanel | completed |
| 2026-03-28 | Phase 1 | 빌드 검증 (main + demo-target) | passed |
