# WIGSS PRD (Style Shaper)

> **Version**: 5.1
> **Created**: 2026-03-26
> **Updated**: 2026-03-28 (fabric.js Canvas, Playwright, WebSocket 에이전트, 하이브리드 AI, 채팅)
> **Status**: Final
> **Hackathon**: 2026-03-28 (Trae.ai 주관, 주제: "에이전트")
> **Team**: Team WIGSS (WIGTN Crew)

---

## 1. Overview

### 1.1 한 줄 피치

> **"코딩 에이전트로 대충 짠 화면을, 웹 꾸미기처럼 직접 만지고, 저장하면 소스코드가 알아서 바뀐다."**

### 1.2 Problem Statement

요즘 코딩 에이전트(Cursor, Claude Code, Trae 등)로 화면을 대충 만들어내는 건 잘 된다. 근데 거기서 **디자인을 다듬는 건 여전히 고통**이다.

**기존 방식의 문제:**
- "이 카드를 좀 더 크게" — 코딩 에이전트한테 말로 설명하기 애매함
- CSS를 직접 수정 → 새로고침 → 확인 → 반복 = 비효율
- 디자이너/퍼블리셔 없이 개발자 혼자 다듬어야 하는 상황이 늘어남
- Figma에서 만들어도 → 코드로 옮기는 건 또 다른 작업

**핵심 인사이트:**
> 말로 설명하기 어려운 디자인 튜닝은, **직접 만지는 게 가장 빠르다.**
> 그리고 만진 결과가 **코드에 바로 반영**되면 완벽하다.
> 아이디어가 고갈되면, **에이전트에게 물어보면** 된다.

### 1.3 Solution — WIGSS

```
npx wigss --port 3000     ← 이 한 줄이면 끝
```

1. 개발자가 코딩 에이전트로 화면을 대충 만든다
2. 프로젝트 루트에서 `npx wigss --port 3000` 실행
3. **항시 떠있는 AI 에이전트가 화면을 분석하여 컴포넌트를 자동 인식** → 드래그/리사이즈 가능하게 변환
4. **에이전트가 능동적으로 "간격 불균일" 같은 개선안을 제안**
5. 개발자가 웹 꾸미기처럼 직접 만진다 (또는 제안 수락)
6. 편집할 때마다 에이전트가 **실시간 피드백** ("8px 어긋남", "너무 작음" 등)
7. **아이디어가 막히면 채팅으로 에이전트에게 물어본다** ("푸터는 어떻게 하지?")
8. **저장하면 Claude가 기존 소스코드를 자동 리팩토링**
9. **Claude가 결과를 스스로 검증, 안 맞으면 스스로 재수정** (최대 3회)

> 별도 앱을 여는 게 아니라, **내 페이지에 편집 기능이 씌워진 느낌.**

### 1.4 Goals

- `npx wigss` 원커맨드로 실행 (프로젝트에 아무것도 설치 안 됨)
- cwd에서 소스 경로 자동 감지, dev 서버 포트 자동/수동 설정
- **항시 떠있는 에이전트** (WebSocket, 이벤트 기반)
- AI가 DOM 분석하여 **컴포넌트 단위로 자동 인식/분리**
- 편집할 때마다 **실시간 피드백** (크기/간격/정렬 검토)
- **채팅 인터페이스**로 에이전트와 대화 (의견 요청, 위임, 지시)
- 저장하면 **기존 소스코드를 Claude가 자동 리팩토링**
- 리팩토링 후 **자기 검증 + 자동 재수정** 루프

### 1.5 Non-Goals (Out of Scope)

- 새로운 컴포넌트 추가/생성 (기존 화면의 재배치에 집중)
- 백엔드 로직/API 자동 생성
- Figma/Sketch 수준의 그래픽 편집
- 프로덕션 배포 자동화
- 실시간 협업 편집

### 1.6 Scope

| 포함 | 제외 |
|------|------|
| CLI 진입점 (`npx wigss`) | GUI 설치 프로그램 |
| WebSocket 기반 항시 에이전트 | 5초마다 폴링 방식 |
| iframe + fabric.js Canvas 시각적 편집기 | 3D/애니메이션 편집 |
| 채팅 인터페이스 (의견 요청/위임/지시) | 음성 인터페이스 |
| OpenAI (관찰/제안) + Claude (리팩토링) | 단일 모델 |
| 기존 소스코드 리팩토링 | 새 프로젝트 생성 |
| React/Next.js + Tailwind 지원 | Vue/Angular (향후) |
| npm 패키지 배포 (`npx`) | 유료 결제 |
| demo-target (내장 샘플) | 외부 프로덕션 사이트 |

---

## 2. 해커톤 심사 기준 매핑

| 심사 기준 | WIGSS 대응 | 데모 증거 |
|-----------|------------|-----------|
| **목표를 이해하고** | 소스코드 + 렌더링 화면 분석, 채팅으로 의도 파악 | "푸터 어떻게 하지?" → 분석 + 제안 |
| **필요한 정보를 모으고** | DOM 분석으로 컴포넌트/스타일 자동 수집 | Navbar, Card Grid 등 자동 인식 |
| **적절한 도구를 활용하고** | 편집기 + 실시간 피드백 + 코드 리팩토링 | 드래그 → "8px 어긋남" 피드백 |
| **여러 단계를 거쳐** | 스캔→인식→제안→편집→피드백→리팩토링→검증 | 멀티스텝 자율 파이프라인 |
| **실제 결과를 만들어내는** | 기존 소스코드가 실제로 수정됨 | 빌드 → 편집한 대로 화면 |

### "에이전트다움" — 5가지 자율 행동 + 채팅

```
1. 컴포넌트 자동 인식   → DOM 분석 → "이건 Navbar" 스스로 판단
2. 디자인 개선 제안     → 능동적으로 "간격 불균일" 감지 → 제안
3. 실시간 편집 피드백   → 드래그 끝나면 "8px 어긋남, 카드가 너무 작음" 즉시 검토
4. 채팅 상담           → "푸터 어떻게 하지?" → 분석 + 제안 / "알아서 해줘" → 자율 수정
5. 코드 리팩토링 + 검증 → 저장 시 Claude가 소스 수정 → 자기 검증 → 자동 재수정
```

### 차별화 키워드

| 키워드 | 설명 |
|--------|------|
| **항시 떠있는 에이전트** | "WebSocket으로 항시 연결, 이벤트마다 즉시 반응" |
| **하이브리드 AI** | "OpenAI가 관찰/제안, Claude가 코드 수정. 각 AI의 강점 활용" |
| **실시간 피드백** | "드래그할 때마다 에이전트가 검토 의견을 줍니다" |
| **채팅 + 직접 조작** | "만지다가 막히면 물어보고, 위임도 가능" |
| **자기 검증** | "리팩토링 후 스스로 검증, 안 맞으면 스스로 재수정" |

---

## 3. User Stories

### 3.1 Primary User — 프론트엔드 개발자

**US-001**: As a 프론트엔드 개발자, I want to `npx wigss` 한 줄이면 내 페이지를 시각적으로 편집할 수 있는 상태가 되어 so that 별도 앱 설치 없이 바로 사용할 수 있다.

**US-002**: As a 프론트엔드 개발자, I want to 화면의 컴포넌트가 자동으로 분리되어 so that 드래그/리사이즈로 직접 배치할 수 있다.

**US-003**: As a 프론트엔드 개발자, I want to 드래그할 때마다 에이전트가 "8px 어긋남", "카드가 너무 작음" 같은 피드백을 줘서 so that 실수를 바로 알 수 있다.

**US-004**: As a 프론트엔드 개발자, I want to "푸터는 어떻게 수정하지?" 같은 질문을 채팅으로 할 수 있어 so that 아이디어가 막힐 때 에이전트의 도움을 받을 수 있다.

**US-005**: As a 프론트엔드 개발자, I want to "알아서 해줘"라고 하면 에이전트가 계획을 보여주고 확인 후 자동 수정해줘서 so that 반복적인 정리 작업을 위임할 수 있다.

**US-006**: As a 프론트엔드 개발자, I want to 저장하면 기존 소스코드가 자동 리팩토링되어 so that CSS를 직접 수정하지 않아도 된다.

### 3.2 Acceptance Criteria (Gherkin)

```gherkin
Scenario: CLI 실행 및 에이전트 시작
  Given 개발자가 프로젝트 루트에서 dev 서버를 localhost:3000에 실행 중이다
  When npx wigss --port 3000 을 실행한다
  Then WIGSS 서버가 localhost:4000에 기동된다
  And WebSocket으로 에이전트가 항시 연결된다
  And 브라우저가 자동으로 열린다

Scenario: 컴포넌트 자동 인식
  Given WIGSS 에디터가 열려있다
  When "스캔" 버튼을 클릭한다
  Then 에이전트가 DOM을 분석하여 컴포넌트를 자동 인식한다
  And 각 컴포넌트에 오버레이(fabric.js Canvas 객체 + 점선 테두리)가 표시된다
  And 실제 페이지는 iframe으로 뒤에 보인다

Scenario: 드래그 후 실시간 피드백
  Given 편집 모드에 있다
  When 사용자가 Card 1의 높이를 200px에서 140px로 리사이즈한다
  Then 오버레이가 줄어든다 (실제 페이지는 안 변함)
  And 에이전트가 1~2초 내에 피드백을 표시한다
  And "Card 1(140px)이 Card 2,3(200px)보다 60px 작습니다. 맞출까요?" [맞추기][무시]
  When [맞추기]를 클릭한다
  Then Card 1 오버레이가 200px로 조정된다 (AI 호출 없이 즉시)

Scenario: 채팅으로 의견 요청
  Given 편집 모드에 있다
  When 사용자가 채팅에 "밑에 푸터는 어떻게 수정하지?"라고 입력한다
  Then 에이전트가 Footer를 분석하여 개선안을 제시한다
  And "높이 축소, 링크 3열 grid 변경, copyright 간격 축소" 등을 제안한다
  And [전체 적용][하나씩][무시] 버튼이 표시된다

Scenario: 채팅으로 위임 ("알아서 해줘")
  Given 에이전트가 제안을 보여준 상태이다
  When 사용자가 "응 알아서 해줘"라고 입력한다
  Then 에이전트가 수정 계획을 먼저 보여준다
  And 사용자가 [진행]을 클릭하면 에이전트가 오버레이를 자동으로 수정한다
  And 수정 과정이 Agent Panel에 실시간 표시된다

Scenario: 소스코드 리팩토링 + 자기 검증
  Given 사용자가 편집을 완료했다
  When [저장]을 클릭한다
  Then Claude API가 변경 delta를 분석하여 소스코드 diff를 생성한다
  And diff 미리보기가 표시된다
  When [적용]을 클릭한다
  Then 소스 파일이 수정된다
  And 에이전트가 자동으로 재렌더링하여 검증한다
  And 불일치 시 자동 재수정한다 (최대 3회)

Scenario: 반응형 자동 변환
  Given 데스크톱 레이아웃이 편집 모드에 있다
  When [모바일 보기] 버튼을 클릭한다
  Then 에이전트가 375px 기준으로 오버레이를 자동 재배치한다
  And 사용자가 결과를 추가 조정할 수 있다
```

---

## 4. Functional Requirements

| ID | Requirement | Priority | Dependencies |
|----|------------|----------|--------------|
| **CLI & 실행 환경** |
| FR-001 | `npx wigss --port <port>` CLI 진입점. cwd에서 소스 경로 자동 감지 | P0 | - |
| FR-002 | WIGSS 서버 기동 (localhost:4000) + 브라우저 자동 오픈 | P0 | FR-001 |
| FR-003 | demo-target 내장 (해커톤 데모용, localhost:3001) | P0 | - |
| **에이전트 코어** |
| FR-010 | **WebSocket 기반 항시 연결 에이전트** (이벤트 기반, 폴링 아님) | P0 | FR-002 |
| FR-011 | 에이전트 이벤트 리스너: 사용자 액션 (WebSocket), 파일 변경 (chokidar), 내부 트리거 | P0 | FR-010 |
| FR-012 | 에이전트 히스토리 관리 (대화 맥락 유지) | P0 | FR-010 |
| **DOM 스캔 & 컴포넌트 인식** |
| FR-020 | Playwright headless DOM 스캔 + 스크린샷 | P0 | FR-010 |
| FR-021 | 스마트 필터링 (invisible/script/style 제외, max 200개) | P0 | FR-020 |
| FR-022 | **GPT-4o가 DOM → 컴포넌트 경계 자동 인식** (function calling) | P0 | FR-021 |
| FR-023 | 인식된 컴포넌트별 바운딩 박스 + 소스 파일 매핑 | P0 | FR-022 |
| FR-024 | 데모 모드 (사전 캐싱, Playwright 실패 시 fallback) | P0 | FR-020 |
| **시각적 편집 (오버레이)** |
| FR-030 | iframe (실제 페이지) + fabric.js Canvas (편집 레이어) | P0 | FR-023 |
| FR-031 | 오버레이 컴포넌트 드래그 이동 (실제 페이지는 안 움직임) | P0 | FR-030 |
| FR-032 | 오버레이 컴포넌트 리사이즈 (핸들 드래그) | P0 | FR-030 |
| FR-033 | 컴포넌트 선택 시 정보 표시 (이름, 위치, 크기, 소스 파일) | P1 | FR-030 |
| FR-034 | Undo/Redo | P1 | FR-031 |
| **실시간 피드백** |
| FR-040 | **드래그/리사이즈 끝난 후 GPT-4o가 레이아웃 검토 피드백** (1~2초 내) | P0 | FR-031 |
| FR-041 | 피드백 종류: 크기 일관성, 간격 균일성, 정렬, 최소 크기, 뷰포트 이탈, 겹침 | P0 | FR-040 |
| FR-042 | 피드백에 [적용] 버튼 → 프론트엔드에서 즉시 적용 (AI 재호출 없음) | P0 | FR-041 |
| FR-043 | 드래그 중에는 AI 호출 안 함 (60fps 유지) | P0 | FR-031 |
| **채팅 인터페이스** |
| FR-050 | Agent Panel에 채팅 입력창 | P0 | FR-010 |
| FR-051 | **의견 요청 모드**: "푸터 어떻게 하지?" → 분석 + 제안 (수정 안 함) | P0 | FR-050 |
| FR-052 | **위임 모드**: "알아서 해줘" → 계획 표시 → 사용자 확인 → 오버레이 자동 수정 | P0 | FR-050 |
| FR-053 | **지시 모드**: "카드를 2열로 바꿔" → 바로 오버레이 수정 | P1 | FR-050 |
| FR-054 | 위임 시 반드시 수정 계획을 먼저 보여주고 사용자 확인 후 진행 | P0 | FR-052 |
| **디자인 제안 (능동적)** |
| FR-060 | 스캔 후 **GPT-4o가 능동적으로 레이아웃 분석 → 개선안 제안** | P1 | FR-023 |
| FR-061 | 제안 카드: 설명 + confidence + [적용]/[무시] | P1 | FR-060 |
| **반응형 변환** |
| FR-070 | [모바일 보기] → **GPT-4o가 375px 기준 오버레이 자동 재배치** | P1 | FR-023 |
| FR-071 | 반응형 결과를 사용자가 추가 조정 가능 | P1 | FR-070 |
| **소스코드 리팩토링** |
| FR-080 | 소스 경로 자동 감지 (cwd 기반) | P0 | FR-001 |
| FR-081 | **[저장] → fabric.js toJSON() delta → Claude API가 소스코드 diff 생성** | P0 | FR-080 |
| FR-082 | diff 미리보기 (before/after + 설명) | P0 | FR-081 |
| FR-083 | [적용] → 소스 파일 수정 + 백업 | P0 | FR-082 |
| **자기 검증** |
| FR-090 | **적용 후 자동: Playwright 재렌더링 → 편집 의도와 비교** | P0 | FR-083 |
| FR-091 | 불일치 → Claude가 자동 재수정 (최대 3회 루프) | P0 | FR-090 |
| **에이전트 UX** |
| FR-100 | Agent Panel: 실시간 피드백 + 채팅 + 에이전트 로그 통합 | P0 | FR-010 |
| FR-101 | 에이전트 상태 표시 (관찰 중 / 분석 중 / 제안 중 / 리팩토링 중 / 검증 중) | P0 | FR-010 |
| FR-102 | 에이전트 reasoning 투명 표시 | P1 | FR-100 |

---

## 5. Non-Functional Requirements

### 5.0 Scale Grade

**Hobby** (해커톤 프로젝트)

| 항목 | 값 |
|------|-----|
| DAU | < 100 |
| 동시접속 | < 10 |
| 데이터량 | < 100MB |

### 5.1 Performance SLA

| 지표 | 목표값 |
|------|--------|
| DOM 스캔 + 컴포넌트 인식 | < 10초 |
| 오버레이 렌더링 | < 2초 |
| 드래그/리사이즈 반응 | 60fps (드래그 중 AI 호출 안 함) |
| 실시간 피드백 (드래그 끝 후) | < 2초 |
| 채팅 응답 | < 3초 |
| 코드 리팩토링 | < 15초 |
| 자기 검증 (1회) | < 10초 |

### 5.2 Security

- SSRF 방어: localhost만 허용
- 경로 검증: `..` 포함 시 거부 (path traversal 방어), cwd 하위만 허용
- API Key: .env.local 서버사이드 전용 (OpenAI + Anthropic)
- 소스 수정 전 반드시 diff 미리보기 → 사용자 확인 → 백업 생성
- WebSocket: origin 검증

---

## 6. Technical Design

### 6.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  $ npx wigss --port 3000                                         │
│                                                                  │
│  bin/cli.js                                                      │
│  ├── cwd → 소스 경로 감지                                        │
│  ├── --port → dev 서버 위치                                      │
│  ├── WIGSS 서버 기동 (localhost:4000)                             │
│  └── 브라우저 자동 오픈                                           │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Browser (localhost:4000)                        │
│                                                                   │
│  ┌─ 플로팅 툴바 ───────────────────────────────────────────────┐ │
│  │ [Edit] [Mobile View] [Save] [Undo] ···          [Close]     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ iframe (localhost:3000) ─────┐  ┌─ Agent Panel ───────────┐ │
│  │  실제 페이지 (배경)            │  │                         │ │
│  │                               │  │ 실시간 피드백            │ │
│  │  ┌─ 오버레이 ───────────────┐ │  │  ⚠️ "8px 어긋남" [적용] │ │
│  │  │ fabric.js Canvas (객체 기반 드래그/리사이즈)│ │  │                         │ │
│  │  │ 점선 테두리로 컴포넌트 표시│ │  │ 채팅                    │ │
│  │  └──────────────────────────┘ │  │  🧑 "푸터 어떻게 하지?" │ │
│  └───────────────────────────────┘  │  🤖 "높이 축소 제안..."  │ │
│                                      │  [전체 적용] [무시]      │ │
│                                      │                         │ │
│                                      │ 에이전트 로그            │ │
│                                      │  ✓ 컴포넌트 8개 인식    │ │
│                                      │  ✓ 간격 불균일 감지     │ │
│                                      └─────────────────────────┘ │
│                                                                   │
│  Zustand: editor-store + agent-store                              │
└───────────────────────────────────────┬──────────────────────────┘
                                        │
                              WebSocket (항시 연결)
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                      WIGSS Agent (Node.js)                        │
│                                                                   │
│  ┌─ Event Loop ────────────────────────────────────────────────┐ │
│  │                                                              │ │
│  │  이벤트 리스너 (항시 활성, 비용 ZERO):                        │ │
│  │  ├── WebSocket: 스캔, 드래그끝, 리사이즈끝, 저장, 채팅 등     │ │
│  │  ├── chokidar: 소스 파일 변경 감지                            │ │
│  │  └── 내부 트리거: 스캔완료→인식, 적용완료→검증                 │ │
│  │                                                              │ │
│  │  이벤트 발생 시:                                              │ │
│  │  ├── 관찰/인식/제안/피드백/채팅 → OpenAI GPT-4o              │ │
│  │  └── 코드 리팩토링/검증 수정   → Claude API (Anthropic)       │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ 로컬 도구 ─────────────────────────────────────────────────┐ │
│  │  Playwright (DOM 스캔/검증)                                   │ │
│  │  Node.js fs (소스 파일 읽기/쓰기)                             │ │
│  │  chokidar (파일 변경 감지)                                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 이벤트 → AI 호출 매핑

| 이벤트 | 트리거 | AI 호출 | 모델 |
|--------|--------|---------|------|
| 스캔 클릭 | 사용자 | DOM 스캔 (Playwright) → 컴포넌트 인식 | GPT-4o |
| 인식 완료 | 내부 자동 | 디자인 개선 제안 | GPT-4o |
| 컴포넌트 선택 | 사용자 | 없음 (프론트엔드만) | - |
| 드래그/리사이즈 중 | 사용자 | **없음** (60fps 유지) | - |
| 드래그/리사이즈 끝 | 사용자 | 실시간 피드백 (크기/간격/정렬 검토) | GPT-4o |
| 채팅 입력 | 사용자 | 의견/위임/지시 처리 | GPT-4o |
| 제안 [적용] | 사용자 | **없음** (프론트엔드 즉시 적용) | - |
| 모바일 보기 | 사용자 | 반응형 변환 | GPT-4o |
| 저장 클릭 | 사용자 | 코드 리팩토링 | **Claude** |
| 적용 완료 | 내부 자동 | 자기 검증 | Playwright + **Claude** |
| 검증 실패 | 내부 자동 | 자동 재수정 (최대 3회) | **Claude** |
| 소스 파일 변경 | chokidar | 알림만 ("다시 스캔?" — AI 호출 안 함) | - |

**핵심**: AI를 안 부르는 순간이 더 많다. 이벤트 발생 시에만 호출.

### 6.3 WebSocket 메시지 프로토콜

```typescript
// Frontend → Agent
{ type: 'scan', payload: { url, projectPath } }
{ type: 'drag_end', payload: { componentId, from, to } }
{ type: 'resize_end', payload: { componentId, from, to } }
{ type: 'save', payload: { changes: ComponentChange[] } }
{ type: 'chat', payload: { message: string } }
{ type: 'mobile_view', payload: { targetWidth: 375 } }
{ type: 'accept_suggestion', payload: { suggestionId, changes } }
{ type: 'accept_feedback', payload: { feedbackId, changes } }

// Agent → Frontend
{ type: 'status', payload: { status: 'detecting...' } }
{ type: 'components_detected', payload: { components: DetectedComponent[] } }
{ type: 'suggestion', payload: { id, title, description, changes, confidence } }
{ type: 'feedback', payload: { id, type, message, changes, severity } }
{ type: 'chat_response', payload: { message, suggestions?, plan? } }
{ type: 'plan_confirm', payload: { planId, steps[], message: "진행할까요?" } }
{ type: 'auto_modify', payload: { componentId, change } }
{ type: 'diff_preview', payload: { diffs: CodeDiff[] } }
{ type: 'refactoring_progress', payload: { step, detail } }
{ type: 'verification_result', payload: { passed, attempts, summary } }
{ type: 'file_changed', payload: { file } }
```

### 6.4 Tech Stack

| Layer | Technology | 역할 |
|-------|-----------|------|
| CLI | bin/cli.js + commander | npx 진입점, --port 파싱, cwd 감지 |
| Frontend | Next.js 14 (App Router) | UI + WebSocket 클라이언트 |
| Visual Editor | iframe + fabric.js Canvas | 객체 모델 — 드래그/리사이즈/선택 내장 + toJSON() |
| Canvas Editor | fabric.js | 객체 기반 Canvas — 드래그/리사이즈/선택 내장, toJSON() 직렬화 |
| State | Zustand | editor-store + agent-store |
| Styling | Tailwind CSS | UI 스타일링 |
| WebSocket | ws (npm) | 서버측 WebSocket |
| AI (관찰/제안/채팅) | OpenAI GPT-4o | Chat Completions + function calling |
| AI (리팩토링/검증) | Claude API (Anthropic) | Messages API + tool use |
| DOM Scan/Verify | Playwright | locator 기반, 자동 대기, 동적 페이지 안정적 |
| File Watch | chokidar | 소스 파일 변경 감지 |
| File I/O | Node.js fs | 소스 읽기/쓰기 |
| Browser Open | open (npm) | CLI에서 브라우저 오픈 |

### 6.5 Directory Structure

```
wigss/
├── bin/
│   └── cli.js                          # CLI (npx wigss)
├── demo-target/                        # 데모용 샘플 웹 페이지
│   ├── src/
│   │   ├── app/page.tsx
│   │   └── components/
│   │       ├── Navbar.tsx
│   │       ├── CardGrid.tsx
│   │       ├── Card.tsx
│   │       ├── Sidebar.tsx
│   │       └── Footer.tsx
│   └── package.json
├── src/                                # WIGSS 에디터
│   ├── app/
│   │   ├── page.tsx                    # 메인 에디터
│   │   └── api/
│   │       ├── ws/route.ts             # WebSocket 엔드포인트
│   │       └── apply/route.ts          # 소스 파일 수정 (REST, 안전 위해)
│   ├── components/
│   │   ├── editor/
│   │   │   ├── VisualEditor.tsx        # iframe + fabric.js Canvas
│   │   │   ├── CanvasObjects.tsx       # fabric 객체 (Rect/Image) 관리
│   │   │   └── FloatingToolbar.tsx     # 플로팅 툴바
│   │   ├── panels/
│   │   │   ├── AgentPanel.tsx          # 피드백 + 채팅 + 로그 통합
│   │   │   ├── ChatInterface.tsx       # 채팅 입출력
│   │   │   ├── FeedbackCards.tsx       # 실시간 피드백 카드
│   │   │   ├── DiffPreview.tsx         # 코드 diff
│   │   │   └── ComponentInfo.tsx       # 선택 컴포넌트 정보
│   │   └── common/
│   ├── stores/
│   │   ├── editor-store.ts             # 컴포넌트, 변경, 히스토리
│   │   └── agent-store.ts              # 상태, 로그, 제안, 피드백, 채팅
│   ├── lib/
│   │   ├── agent/
│   │   │   ├── agent-loop.ts           # 에이전트 메인 루프 (이벤트 기반)
│   │   │   ├── openai-client.ts        # OpenAI GPT-4o (관찰/제안/채팅)
│   │   │   ├── claude-client.ts        # Claude API (리팩토링/검증)
│   │   │   └── tools.ts               # function calling 도구 정의
│   │   ├── playwright.ts
│   │   ├── file-utils.ts
│   │   └── ws-server.ts               # WebSocket 서버
│   ├── types/
│   │   └── index.ts
│   └── data/
│       └── demo-scan-result.json
├── package.json                        # bin 필드 포함
└── docs/
```

### 6.6 Agent Panel 구조

```
┌─ Agent Panel ───────────────────────────────┐
│                                              │
│  ┌─ 상태 ──────────────────────────────────┐│
│  │ 🟢 관찰 중 (항시 연결)                   ││
│  └──────────────────────────────────────────┘│
│                                              │
│  ┌─ 실시간 피드백 (드래그/리사이즈 후) ─────┐│
│  │ ⚠️ Card 1(140px)이 Card 2,3(200px)보다  ││
│  │    60px 작습니다. 맞출까요?              ││
│  │                         [맞추기] [무시]  ││
│  │                                          ││
│  │ ⚠️ 카드 간격 16/24px 불균일.             ││
│  │    16px로 통일할까요?    [통일] [무시]    ││
│  └──────────────────────────────────────────┘│
│                                              │
│  ┌─ 채팅 ──────────────────────────────────┐│
│  │ 🧑 밑에 푸터는 어떻게 수정하지?          ││
│  │                                          ││
│  │ 🤖 Footer를 분석해보면:                   ││
│  │    - 높이 200px (콘텐츠 대비 과도)        ││
│  │    - 링크 3그룹 1열 (비효율)              ││
│  │    제안: 높이 120px, 3열 grid             ││
│  │              [전체 적용] [하나씩] [무시]   ││
│  │                                          ││
│  │ 🧑 응 알아서 해줘                         ││
│  │                                          ││
│  │ 🤖 수정 계획:                             ││
│  │    1. 높이 200→120px                      ││
│  │    2. 1열→3열 grid                        ││
│  │    3. copyright 간격 16→8px               ││
│  │                          [진행] [취소]    ││
│  └──────────────────────────────────────────┘│
│  ┌────────────────────────────────┐ ┌──────┐    │
│  │ 메시지 입력...              │ │ 전송 │    │
│  └────────────────────────────────┘ └──────┘    │
│                                              │
│  ┌─ 에이전트 로그 (접기/펼치기) ────────────┐│
│  │ 12:01 컴포넌트 8개 인식                  ││
│  │ 12:01 간격 불균일 감지                   ││
│  │ 12:03 Card 1 리사이즈 피드백             ││
│  │ 12:05 채팅: 푸터 분석 완료               ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

### 6.7 채팅 인터페이스 — 3가지 모드

| 모드 | 사용자 예시 | 에이전트 행동 | 오버레이 수정 |
|------|-----------|-------------|-------------|
| **의견 요청** | "푸터 어떻게 하지?" | 분석 + 제안 표시 | 안 함 (사용자가 결정) |
| **위임** | "알아서 해줘", "아래쪽 정리해줘" | 계획 먼저 표시 → 사용자 [진행] → 자동 수정 | 확인 후 자동 |
| **지시** | "카드를 2열로 바꿔" | 바로 수정 | 즉시 |

**안전 장치**: 위임 모드에서는 반드시 수정 계획을 먼저 보여주고, 사용자가 [진행]을 눌러야 실행.

### 6.8 실시간 피드백 — 검토 항목

| 카테고리 | 예시 피드백 | 심각도 |
|---------|-----------|--------|
| 크기 일관성 | "Card 1이 Card 2,3보다 60px 작습니다" | ⚠️ warning |
| 간격 균일성 | "카드 간격 16/24px 불균일. 통일할까요?" | ⚠️ warning |
| 정렬 | "Sidebar 상단이 Card Grid보다 8px 아래" | ⚠️ warning |
| 최소 크기 | "폰트 14px 기준 이 박스는 너무 작습니다" | 🔴 error |
| 뷰포트 이탈 | "컴포넌트가 화면 밖으로 나갑니다" | 🔴 error |
| 겹침 | "Card 2와 Sidebar가 12px 겹칩니다" | 🔴 error |

피드백 타이밍: **드래그 중에는 AI 안 부름. 끝난 후 1~2초 내 피드백.**

### 6.9 Data Model

```typescript
// Types
interface DetectedComponent {
  id: string;
  name: string;
  type: 'navbar' | 'header' | 'hero' | 'grid' | 'card' | 'sidebar' | 'footer' | 'section' | 'form' | 'modal';
  elementIds: string[];
  boundingBox: { x: number; y: number; width: number; height: number };
  sourceFile: string;
  reasoning: string;
  children?: DetectedComponent[];
}

interface ComponentChange {
  componentId: string;
  type: 'move' | 'resize';
  from: { x?: number; y?: number; width?: number; height?: number };
  to: { x?: number; y?: number; width?: number; height?: number };
}

interface CodeDiff {
  file: string;
  original: string;
  modified: string;
  lineNumber: number;
  explanation: string;
}

interface AgentFeedback {
  id: string;
  type: 'sizing' | 'spacing' | 'alignment' | 'min_size' | 'viewport' | 'overlap';
  severity: 'warning' | 'error';
  message: string;
  affectedComponents: string[];
  suggestedChanges: ComponentChange[];
}

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  suggestions?: { id: string; title: string; changes: ComponentChange[] }[];
  plan?: { planId: string; steps: string[]; awaiting_confirm: boolean };
  timestamp: number;
}

// Zustand Stores
interface EditorStore {
  scanResult: ScanResult | null;
  components: DetectedComponent[];
  selectedComponentId: string | null;
  changes: ComponentChange[];
  viewportMode: 'desktop' | 'mobile';
  mobileComponents: DetectedComponent[] | null;
  diffs: CodeDiff[];
  canvasSnapshots: object[];       // fabric.js canvas.toJSON() 스냅샷 (history/undo용)
  canvasSnapshotIndex: number;
  history: ComponentChange[][];
  historyIndex: number;
}

interface AgentStore {
  connected: boolean;
  status: 'idle' | 'scanning' | 'detecting' | 'suggesting'
        | 'feedback' | 'chatting' | 'refactoring' | 'applying' | 'verifying';
  logs: { timestamp: number; step: string; detail: string }[];
  feedbacks: AgentFeedback[];
  chatMessages: ChatMessage[];
  verification: {
    passed: boolean;
    attempts: { mismatches: any[]; autoFix: any }[];
    totalAttempts: number;
  } | null;
}
```

### 6.10 demo-target 스펙

| 항목 | 내용 |
|------|------|
| 스택 | Next.js 14 + Tailwind CSS |
| 포트 | localhost:3001 |
| 컴포넌트 | Navbar, Hero, Card Grid (3개), Sidebar, Footer |
| 의도적 결함 | 카드 간격 불균일 (16px/24px), Sidebar 정렬 8px 어긋남, Footer 높이 과도, Navbar 비효율 |
| 소스 구조 | 컴포넌트별 파일 분리 |

---

## 7. AI Agent Design

### 7.1 하이브리드 AI 구조

| 역할 | 모델 | API | 이유 |
|------|------|-----|------|
| 관찰/인식/제안/피드백/채팅/반응형 | **GPT-4o** | OpenAI Chat Completions | 빠른 응답, function calling |
| 코드 리팩토링/검증 수정 | **Claude** | Anthropic Messages API | 코드 정밀도, 연쇄 영향 분석 |
| 구현 (우리가 코딩) | Claude Code | CLI | 개발 도구 |

### 7.2 에이전트 루프 (의사코드)

```typescript
class WIGSSAgent {
  private ws: WebSocket;
  private watcher: chokidar.FSWatcher;
  private history: Message[] = [];

  start() {
    // WebSocket 이벤트
    this.ws.on('message', async (event) => {
      switch (event.type) {
        case 'scan':
          const dom = await playwright.scan(event.url);
          const components = await this.openai('detect', dom);
          this.ws.send({ type: 'components_detected', components });
          // 자동 연쇄: 제안
          const suggestions = await this.openai('suggest', components);
          this.ws.send({ type: 'suggestion', suggestions });
          break;

        case 'drag_end':
        case 'resize_end':
          // 실시간 피드백 (GPT-4o)
          const feedback = await this.openai('feedback', event);
          if (feedback) this.ws.send({ type: 'feedback', feedback });
          break;

        case 'chat':
          const response = await this.openai('chat', event.message);
          this.ws.send({ type: 'chat_response', response });
          // 위임 모드면 계획 확인 요청
          if (response.plan) {
            this.ws.send({ type: 'plan_confirm', response.plan });
          }
          break;

        case 'plan_confirmed':
          // 에이전트가 오버레이 자동 수정
          for (const step of event.plan.steps) {
            this.ws.send({ type: 'auto_modify', step.change });
          }
          break;

        case 'save':
          // 리팩토링 (Claude)
          // fabric.js canvas.toJSON()으로 구조화된 JSON diff 생성
          const diffs = await this.claude('refactor', event.changes);
          this.ws.send({ type: 'diff_preview', diffs });
          break;

        case 'apply':
          await this.applyDiffs(event.diffs);
          // 자동 연쇄: 검증
          await this.verifyLoop(event.expectedLayout);
          break;
      }
    });

    // 파일 감시
    this.watcher = chokidar.watch(projectPath);
    this.watcher.on('change', (file) => {
      this.ws.send({ type: 'file_changed', file }); // AI 호출 안 함
    });
  }

  async verifyLoop(expected, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      const actual = await playwright.scan(url);
      const mismatches = compare(expected, actual);
      if (mismatches.length === 0) {
        this.ws.send({ type: 'verification_result', passed: true });
        return;
      }
      // Claude로 재수정
      const fixes = await this.claude('fix', mismatches);
      await this.applyDiffs(fixes);
    }
    this.ws.send({ type: 'verification_result', passed: false });
  }
}
```

### 7.3 GPT-4o Function Calling 도구

```typescript
const openaiTools = [
  {
    type: "function",
    function: {
      name: "identify_component",
      description: "DOM 요소 그룹을 하나의 UI 컴포넌트로 인식",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["navbar","header","hero","grid","card","sidebar","footer","section","form","modal"] },
          elementIds: { type: "array", items: { type: "string" } },
          sourceFile: { type: "string" },
          reasoning: { type: "string" }
        },
        required: ["name", "type", "elementIds", "reasoning"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "provide_feedback",
      description: "레이아웃 변경에 대한 피드백 제공",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["sizing","spacing","alignment","min_size","viewport","overlap"] },
          severity: { type: "string", enum: ["warning","error"] },
          message: { type: "string" },
          affectedComponents: { type: "array", items: { type: "string" } },
          suggestedChanges: { type: "array", items: { type: "object" } }
        },
        required: ["type", "severity", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "modify_overlay",
      description: "오버레이 컴포넌트를 직접 수정 (채팅 위임/지시 모드)",
      parameters: {
        type: "object",
        properties: {
          componentId: { type: "string" },
          change: { type: "object", properties: { x: {type:"number"}, y: {type:"number"}, width: {type:"number"}, height: {type:"number"} } }
        },
        required: ["componentId", "change"]
      }
    }
  }
];
```

---

## 8. Trae.ai 활용 전략

| 시점 | Trae 기능 | 목적 |
|------|-----------|------|
| 스캐폴딩 | Builder Mode | Next.js + Tailwind 보일러플레이트 |
| UI 컴포넌트 | Chat Mode | 에디터 UI 빠른 프로토타이핑 |
| 디버깅 | Chat Mode | WebSocket/오버레이 이슈 |
| 핵심 로직 | Claude Code 병행 | 에이전트 루프, 리팩토링 로직 |
| 발표 | 캡처 | Trae 활용 증거 |

---

## 9. Fallback 전략

### 9.1 기술 Fallback

| 위험 | Plan A | Plan B | Plan C |
|------|--------|--------|--------|
| Playwright 불가 | Playwright (Chromium) | 캐싱 JSON | 데모 모드 |
| OpenAI 불안정 | GPT-4o | GPT-4o-mini | 사전 캐싱 |
| Claude 불안정 | Claude Sonnet | Claude Haiku | diff 텍스트 가이드 |
| WebSocket 불안정 | ws | polling fallback | REST API |
| iframe 이슈 | iframe + fabric.js Canvas | 스크린샷 + fabric.js Canvas | DOM overlay fallback |

### 9.2 시간 Fallback

| 남은 시간 | 절삭 | 보존 |
|-----------|------|------|
| 5h+ | 없음 | 전체 |
| 3h | 반응형, 검증 루프 | 스캔 + 인식 + 편집 + 피드백 + 채팅 + 리팩토링 |
| 2h | 리팩토링, 채팅 | 스캔 + 인식 + 편집 + 피드백 |
| 1h | 편집 이후 전부 | 스캔 + 인식 + 피드백 데모 + Fallback 영상 |

**우선순위**: 컴포넌트 인식 > 실시간 피드백 > 채팅 > 편집기 > 리팩토링 > 검증 > 반응형

---

## 10. 데모 시나리오 (3분)

```
[0:00 ~ 0:10] 문제
  "코딩 에이전트로 화면은 금방 만듭니다.
   근데 디자인 다듬는 건? 직접 만지면 됩니다."

[0:10 ~ 0:20] 실행
  $ npx wigss --port 3001
  → 브라우저 자동 오픈, 에이전트 연결됨

[0:20 ~ 0:40] 컴포넌트 인식 ★Agent
  "스캔" → 에이전트가 "Navbar, Card Grid, Sidebar" 자동 인식
  각 컴포넌트에 점선 오버레이 표시

[0:40 ~ 0:55] 제안 + 피드백 ★Agent
  에이전트: "카드 간격 불균일. 맞출까요?" → [적용]
  Card 1 리사이즈 → "Card 2,3보다 60px 작습니다" 실시간 피드백

[0:55 ~ 1:20] 채팅 ★Agent
  🧑 "밑에 푸터는 어떻게 수정하지?"
  🤖 "높이 축소 + 3열 grid 제안"
  🧑 "알아서 해줘"
  🤖 계획 표시 → [진행] → 오버레이 자동 수정

[1:20 ~ 1:35] 모바일 ★Agent
  [모바일 보기] → 375px 자동 재배치

[1:35 ~ 2:15] 리팩토링 ★Claude
  [저장] → Claude가 소스코드 diff → "h-16→h-12" → [적용]

[2:15 ~ 2:40] 자기 검증 ★Claude
  자동 재렌더링 → "4px 불일치" → 자동 재수정 → "통과"

[2:40 ~ 3:00]
  "OpenAI가 관찰하고, Claude가 코드를 고칩니다.
   항시 떠있는 에이전트. 설치 없이 npx 한 줄.
   개발자는 드래그하고, 채팅하면 됩니다."
```

---

## 11. 예상 질문 & 답변

| 질문 | 답변 |
|------|------|
| "설치 필요?" | "npx wigss 한 줄. 프로젝트에 아무것도 안 추가됩니다." |
| "에이전트가 항시 떠있으면 비용?" | "이벤트 기반이라 대기 중엔 비용 ZERO. 이벤트 발생 시에만 AI 호출." |
| "왜 AI 두 개?" | "OpenAI는 빠른 관찰/제안에 강하고, Claude는 코드 리팩토링에 정밀합니다." |
| "자연어도 되고 드래그도 되나?" | "네. 드래그가 기본이고, 막히면 채팅으로 물어보거나 위임합니다." |
| "알아서 해줘 하면 마음대로 바꾸나?" | "아닙니다. 반드시 수정 계획을 먼저 보여주고 확인 후 진행합니다." |
| "코드가 깨지면?" | "diff 미리보기 + 백업 + 자기 검증 3회로 안전합니다." |

---

## 12. 배포 모델

| 단계 | 방식 | 명령어 |
|------|------|--------|
| 개발/데모 | 소스에서 직접 | `pnpm dev` |
| 정식 배포 | npm publish (5분) | `npx wigss` |

---

## 13. Success Metrics

| Metric | Target |
|--------|--------|
| DOM 스캔 성공률 | > 90% |
| 컴포넌트 인식 정확도 | > 70% |
| 실시간 피드백 응답 | < 2초 |
| 채팅 응답 | < 3초 |
| 드래그 FPS | 60fps |
| 코드 리팩토링 빌드 성공률 | > 80% |
| 자기 검증 통과율 (3회 내) | > 90% |
| 데모 완료 시간 | < 3분 |
