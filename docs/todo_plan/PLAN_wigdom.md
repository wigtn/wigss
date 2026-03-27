# Task Plan: WIGSS

> **PRD**: docs/prd/PRD_wigdom.md (v3.1)
> **Updated**: 2026-03-27
> **Status**: pending
> **Hackathon**: 2026-03-28

## Execution Config

| Option | Value |
|--------|-------|
| `auto_commit` | true |
| `commit_per_phase` | true |
| `quality_gate` | true |

---

## D-1 (3/27) — 사전 준비

### Phase 0: 환경 검증 + 스캐폴딩 (2h)

- [ ] 0.1 Puppeteer 설치 + localhost 스캔 테스트 (DOM 트리 + 스크린샷)
- [ ] 0.2 Claude API Tool Use 테스트 (identify_component 도구)
- [ ] 0.3 iframe + 오버레이 div 드래그/리사이즈 PoC
- [ ] 0.4 Next.js 14 프로젝트 생성 (pnpm, TypeScript, Tailwind, App Router)
- [ ] 0.5 디렉토리 구조 생성 (PRD 6.4)
- [ ] 0.6 의존성 설치 (puppeteer, @anthropic-ai/sdk, zustand, interact.js)
- [ ] 0.7 .env.local + CLAUDE.md 설정
- [ ] 0.8 데모 타겟 Next.js 프로젝트 (demo-target/ — Navbar + Card Grid + Sidebar + Footer)
- [ ] 0.9 사전 스캔 결과 캐싱 (DOM JSON + 스크린샷 + 컴포넌트 인식 + 제안 결과)

**판단**: 0.1~0.3 실패 시 PRD 9.1 Fallback 참조

### Phase 1: DOM 스캔 + 컴포넌트 인식 + 디자인 제안 (4h) ★에이전트 핵심★

- [ ] 1.1 POST /api/scan — Puppeteer DOM 추출 + 스크린샷 + 소스 파일 목록
- [ ] 1.2 URL 유효성 검사 (SSRF 방어)
- [ ] 1.3 요소 스마트 필터링 (max 200개)
- [ ] 1.4 데모 모드 분기 (DEMO_MODE → 캐싱 JSON)
- [ ] 1.5 POST /api/detect — Claude Tool Use로 컴포넌트 자동 인식
      - identify_component 도구 → 컴포넌트 목록
      - 시맨틱 태그 + CSS 패턴 + 반복 구조 분석
      - 소스 파일 매핑 + reasoning 기록
- [ ] 1.6 POST /api/suggest — 현재 레이아웃 분석 → 디자인 개선안 제안
      - 간격 불균일, 정렬 미스, 크기 불일치 감지
      - 제안별 confidence + 적용 시 변경 preview
- [ ] 1.7 Zustand 스토어 (scanResult, components, changes, suggestions, agentStatus, agentLog)
- [ ] 1.8 UI 레이아웃 — Toolbar + ComponentPanel(좌) + VisualEditor(중앙) + AgentPanel(우)
- [ ] 1.9 AgentPanel — 에이전트 상태 + 인식 로그 + 제안 카드 ([적용]/[무시])
- [ ] 1.10 ComponentPanel — 컴포넌트 목록 (이름, 타입, 소스 파일)
- [ ] 1.11 제안 "적용" 시 컴포넌트 자동 재배치

**검증**: URL → 스캔 → 컴포넌트 인식 → 개선 제안 표시 → 제안 적용
**커밋**: `feat: DOM scan + AI component detection + design suggestions`

### D-1 저녁: E2E 검증

- [ ] demo-target → 스캔 → 인식 → 제안 풀 플로우
- [ ] 에러 케이스 + DEMO_MODE 확인

---

## D-Day (3/28) — 해커톤

### Phase 2: 시각적 편집기 + 반응형 변환 (2.5h)

- [ ] 2.1 VisualEditor — iframe + 투명 오버레이
- [ ] 2.2 ComponentOverlay — 컴포넌트별 바운딩 박스 오버레이
- [ ] 2.3 컴포넌트 선택 (클릭 → 하이라이트 + ComponentPanel 연동)
- [ ] 2.4 컴포넌트 드래그 이동
- [ ] 2.5 컴포넌트 리사이즈 (핸들 드래그)
- [ ] 2.6 변경 delta 추적 (Zustand)
- [ ] 2.7 정보 표시 (컴포넌트명, 위치, 크기, 소스 파일)
- [ ] 2.8 POST /api/responsive — 에이전트가 375px 기준 자동 재배치
      - 다열→1열, 사이드바→하단, 크기 축소 등 자율 판단
      - reasoning 포함
- [ ] 2.9 "모바일 보기" 버튼 → /api/responsive 호출 → 오버레이 업데이트
- [ ] 2.10 반응형 결과 추가 조정 가능 (드래그/리사이즈)

**검증**: 드래그/리사이즈 + "모바일 보기" → 에이전트 자동 재배치
**커밋**: `feat: Visual editor + responsive auto-conversion`

### Phase 3: 리팩토링 + 자기 검증 루프 (2.5h) ★에이전트 핵심★

- [ ] 3.1 POST /api/refactor — 변경 delta → 소스코드 diff 생성
      - Tailwind 클래스 / CSS 속성 변경
      - 연쇄 영향 분석 (부모/형제 요소)
      - explanation 포함
- [ ] 3.2 DiffPreview 패널 — before/after + 설명
- [ ] 3.3 POST /api/apply — diff → 소스 파일 적용 (백업 생성)
- [ ] 3.4 POST /api/verify — 자기 검증 루프
      - Puppeteer 재렌더링 → 편집 의도와 비교
      - 불일치 시 자동 재수정 (diff 재생성 → 재적용)
      - 최대 3회 루프
      - 검증 결과 + 수정 이력 반환
- [ ] 3.5 AgentPanel에 검증 상태 표시
      - "검증 중..." → "불일치 발견 (Navbar 4px)" → "자동 수정" → "재검증 통과"
- [ ] 3.6 전체 저장→리팩토링→검증 플로우 E2E

**검증**: 편집 → 저장 → diff → 적용 → 자기검증 → (불일치 시) 자동 재수정 → 통과
**커밋**: `feat: AI refactoring + self-verification loop (max 3 retries)`

### Phase 4: Polish & Demo (2h)

- [ ] 4.1 Undo/Redo (Cmd+Z / Cmd+Shift+Z)
- [ ] 4.2 에러 핸들링 (toast + 재시도)
- [ ] 4.3 UI 폴리싱 (다크 모드, 오버레이 색상, 로고)
- [ ] 4.4 데모 리허설 1회: 타이밍 (3분)
- [ ] 4.5 데모 리허설 2회: 에러 케이스
- [ ] 4.6 데모 리허설 3회: 발표 멘트 포함
- [ ] 4.7 Fallback 영상 녹화
- [ ] 4.8 발표 자료 (1-2장)

**커밋**: `feat: Polish - undo/redo, error handling, demo prep`

---

## 시간별 타임라인

### D-1

| 시간 | 작업 |
|------|------|
| 오전 | Phase 0 전체 |
| 오후 1~2.5h | 1.1~1.4 (DOM 스캔 API) |
| 오후 2.5~4h | 1.5~1.6 (AI 컴포넌트 인식 + 디자인 제안) |
| 오후 4~6h | 1.7~1.11 (UI + AgentPanel + 제안 적용) |
| 저녁 | E2E 검증 |

### D-Day

| 시간 | 작업 |
|------|------|
| 00~01h | 2.1~2.3 (iframe + 오버레이 + 선택) |
| 01~02h | 2.4~2.7 (드래그/리사이즈 + 변경 추적) |
| 02~02.5h | 2.8~2.10 (반응형 자동 변환) |
| 02.5~03.5h | 3.1~3.2 (AI 리팩토링 + diff 미리보기) |
| 03.5~04.5h | 3.3~3.5 (파일 적용 + 자기 검증 루프) |
| 04.5~05h | 3.6 (E2E 플로우 테스트) |
| 05~05.5h | 4.1~4.3 (안정성 + UI) |
| 05.5~06.5h | 4.4~4.6 (데모 리허설 3회) |
| 06.5~07h | 4.7~4.8 (Fallback + 발표자료) |

## 시간 부족 시 절삭 기준

| 남은 시간 | 절삭 | 보존 |
|-----------|------|------|
| 5h+ | 없음 | 전체 |
| 3h | Phase 4, 반응형(2.8~2.10) | 편집 + 리팩토링 + 자기검증 |
| 2h | Phase 3-4 (리팩토링 포기) | 스캔 + 인식 + 제안 + 편집 |
| 1h | Phase 2-4 | 컴포넌트 인식 + 제안 데모 + Fallback 영상 |

**우선순위**: 컴포넌트 인식 > 디자인 제안 > 편집기 > 리팩토링 > 자기검증 > 반응형

---

## Progress

| Metric | Value |
|--------|-------|
| Total Tasks | 0/44 |
| Current Phase | Phase 0 |
| Status | pending |

## Execution Log

| Timestamp | Phase | Task | Status |
|-----------|-------|------|--------|
| - | - | - | - |
