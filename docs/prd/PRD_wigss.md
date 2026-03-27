---

# WIGSS PRD (Style Shaper)

> **Version**: 4.0
> **Created**: 2026-03-26
> **Updated**: 2026-03-27 (CLI 진입점, demo-target, npx 배포, E2E 확정)
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

### 1.3 Solution — WIGSS

```
npx wigss --port 3000     ← 이 한 줄이면 끝
```

1. 개발자가 코딩 에이전트로 화면을 대충 만든다
2. 프로젝트 루트에서 `npx wigss --port 3000` 실행
3. **AI 에이전트가 화면의 컴포넌트를 자동 인식** → 드래그/리사이즈 가능하게 변환
4. **AI가 능동적으로 "간격 불균일" 같은 개선안을 제안**
5. 개발자가 웹 꾸미기처럼 직접 만진다 (또는 제안 수락)
6. **저장하면 AI가 기존 소스코드를 자동 리팩토링**
7. **AI가 결과를 스스로 검증, 안 맞으면 스스로 재수정** (최대 3회)

> 별도 앱을 여는 게 아니라, **내 페이지에 편집 기능이 씌워진 느낌.**

### 1.4 Goals

- `npx wigss` 원커맨드로 실행 (프로젝트에 아무것도 설치 안 됨)
- cwd에서 소스 경로 자동 감지, dev 서버 포트 자동/수동 설정
- AI 에이전트가 DOM 분석하여 **컴포넌트 단위로 자동 인식/분리**
- 분리된 컴포넌트를 **드래그/리사이즈/재배치** 가능한 시각적 편집기 제공
- 편집 결과를 저장하면 **기존 소스코드를 AI가 자동 리팩토링**
- 리팩토링 후 **자기 검증 + 자동 재수정** 루프
- 능동적 **디자인 개선 제안** + **반응형 자동 변환**

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
| 개발서버 DOM 스캔 + 컴포넌트 자동 인식 | SSR 분석 |
| iframe + 오버레이 시각적 편집기 | 3D/애니메이션 편집 |
| AI 기반 컴포넌트 경계 판단 | 복잡한 인터랙션 편집 |
| 기존 소스코드 리팩토링 | 새 프로젝트 생성 |
| React/Next.js + Tailwind 프로젝트 지원 | Vue/Angular (향후) |
| npm 패키지 배포 (`npx` 실행) | 유료 결제 |
| demo-target (내장 샘플 페이지) | 외부 프로덕션 사이트 |

---

## 2. 해커톤 심사 기준 매핑

해커톤 주제 "에이전트" 5가지 핵심 기준:

| 심사 기준 | WIGSS 대응 | 데모 증거 |
|-----------|------------|-----------|
| **목표를 이해하고** | 소스코드 + 렌더링된 화면을 함께 분석 | URL 입력 → 화면 구조 파악 |
| **필요한 정보를 모으고** | DOM 분석으로 컴포넌트 경계/스타일 자동 수집 | Navbar, Card Grid 등 자동 인식 |
| **적절한 도구를 활용하고** | 컴포넌트 분리 + 편집기 + diff 기반 코드 수정 | 드래그 UI + 코드 diff |
| **여러 단계를 거쳐** | 스캔→인식→제안→편집→리팩토링→검증 6단계 | 멀티스텝 자율 파이프라인 |
| **실제 결과를 만들어내는** | 기존 소스코드가 실제로 수정됨 | 빌드 → 편집한 대로 화면 표시 |

### "에이전트다움" — 5가지 자율 행동

```
1. 컴포넌트 자동 인식   → DOM을 분석해 "이건 Navbar, 이건 Card Grid" 스스로 판단
2. 디자인 개선 제안     → 능동적으로 "간격 불균일, 정렬 미스" 감지하고 제안
3. 반응형 자동 변환     → "모바일 보기" 한 번이면 375px 기준 자율 재배치
4. 코드 리팩토링        → 어떤 파일의 어떤 줄을 수정할지 자율 판단
5. 자기 검증 + 자동 수정 → 리팩토링 결과를 스스로 검증, 불일치 시 스스로 재수정
```

### 차별화 키워드

| 키워드 | 설명 |
|--------|------|
| **npx 원커맨드** | "설치 없이, 프로젝트에서 한 줄이면 끝" |
| **컴포넌트 자동 분리** | "에이전트가 스스로 컴포넌트 경계를 판단" |
| **능동적 제안** | "에이전트가 먼저 문제를 찾아서 제안" |
| **소스코드 리팩토링** | "새 코드가 아니라 기존 소스를 수정" |
| **자기 검증** | "스스로 결과를 검증하고 스스로 재수정" |

---

## 3. User Stories

### 3.1 Primary User — 프론트엔드 개발자

**US-001**: As a 프론트엔드 개발자, I want to 프로젝트 루트에서 `npx wigss` 한 줄이면 내 페이지를 시각적으로 편집할 수 있는 상태가 되어 so that 별도 앱 설치 없이 바로 사용할 수 있다.

**US-002**: As a 프론트엔드 개발자, I want to 코딩 에이전트로 대충 만든 화면을 WIGSS에서 열면 각 컴포넌트가 자동으로 분리되어 so that 디자인 도구처럼 직접 드래그/리사이즈로 배치할 수 있다.

**US-003**: As a 프론트엔드 개발자, I want to 시각적으로 편집한 결과를 저장하면 기존 소스코드가 자동으로 리팩토링되어 so that CSS를 직접 수정하지 않아도 된다.

**US-004**: As a 프론트엔드 개발자, I want to 리팩토링된 코드가 자동으로 검증되어 so that 빌드 후 의도한 대로 나오는지 직접 확인하지 않아도 된다.

### 3.2 해커톤 심사위원

**US-005**: As a 심사위원, I want to 에이전트가 컴포넌트 인식 → 제안 → 리팩토링 → 검증까지 자율 수행하는 과정을 관찰 so that 에이전트다움을 평가할 수 있다.

### 3.3 Acceptance Criteria (Gherkin)

```gherkin
Scenario: CLI 실행 및 자동 환경 감지
  Given 개발자가 프로젝트 루트에서 dev 서버를 localhost:3000에 실행 중이다
  When npx wigss --port 3000 을 실행한다
  Then WIGSS가 cwd에서 소스 경로를 자동 감지한다
  And localhost:4000에 WIGSS 에디터가 기동된다
  And 브라우저가 자동으로 열린다

Scenario: DOM 스캔 및 컴포넌트 자동 분리
  Given WIGSS 에디터가 열려있다
  When 사용자가 "스캔" 버튼을 클릭한다
  Then AI 에이전트가 DOM을 분석하여 컴포넌트를 자동 인식한다
  And 각 컴포넌트(Navbar, Card Grid 등)에 드래그/리사이즈 핸들이 표시된다
  And 실제 렌더링된 화면 위에 편집 오버레이가 씌워진다

Scenario: 디자인 개선 제안 (능동적)
  Given 컴포넌트가 인식된 편집 모드에 있다
  When 에이전트가 현재 레이아웃을 분석한다
  Then "Card 간격이 불균일합니다" 같은 개선안을 능동적으로 제안한다
  And 사용자가 [적용] 클릭 시 에이전트가 자동으로 배치를 수정한다

Scenario: 시각적 편집 (웹 꾸미기)
  Given 편집 모드에 있다
  When 사용자가 컴포넌트를 드래그/리사이즈한다
  Then 해당 컴포넌트가 실시간으로 이동/크기 변경된다
  And 변경 delta가 추적된다

Scenario: 반응형 자동 변환
  Given 데스크톱(1280px) 레이아웃이 편집 모드에 있다
  When 사용자가 [모바일 보기] 버튼을 클릭한다
  Then 에이전트가 375px 기준으로 레이아웃을 자동 재배치한다
  And 사용자가 결과를 추가 조정할 수 있다

Scenario: 소스코드 자동 리팩토링
  Given 사용자가 편집을 완료했다
  When [저장] 버튼을 클릭한다
  Then AI 에이전트가 기존 소스코드의 해당 부분을 자동 수정한다
  And 수정된 코드 diff를 미리보기로 보여준다
  And [적용] 클릭 시 실제 소스 파일이 수정된다

Scenario: 자기 검증 + 자동 재수정
  Given 소스코드가 리팩토링되었다
  When 에이전트가 수정된 코드를 재렌더링하여 검증한다
  Then 편집 의도와 비교하여 불일치 시 자동 재수정한다 (최대 3회)
  And 검증 결과와 수정 이력이 Agent Panel에 표시된다
```

---

## 4. Functional Requirements

| ID | Requirement | Priority | Dependencies |
|----|------------|----------|--------------|
| **CLI & 실행 환경** |
| FR-001 | `npx wigss --port <port>` CLI 진입점. cwd에서 소스 경로 자동 감지 | P0 | - |
| FR-002 | WIGSS 서버 기동 (localhost:4000) + 브라우저 자동 오픈 | P0 | FR-001 |
| FR-003 | demo-target 내장 (해커톤 데모용, localhost:3001) | P0 | - |
| **DOM 스캔 & 컴포넌트 인식** |
| FR-010 | 개발서버 URL로 DOM 스캔 (Puppeteer headless) | P0 | FR-002 |
| FR-011 | getBoundingClientRect + getComputedStyle + 스크린샷 추출 | P0 | FR-010 |
| FR-012 | 요소 스마트 필터링 (invisible/script/style 제외, max 200개) | P0 | FR-011 |
| FR-013 | **AI 에이전트가 DOM → 컴포넌트 경계 자동 인식** (Agent #1) | P0 | FR-012 |
| FR-014 | 인식된 컴포넌트별 바운딩 박스 + 라벨 + 소스 파일 매핑 | P0 | FR-013 |
| FR-015 | 데모 모드 (사전 캐싱, Puppeteer 실패 시 fallback) | P0 | FR-010 |
| **디자인 개선 제안** |
| FR-020 | **AI가 레이아웃을 능동적으로 분석하여 개선안 제안** (Agent #2) | P1 | FR-014 |
| FR-021 | 제안 UI: 카드 목록 (설명 + confidence + [적용]/[무시]) | P1 | FR-020 |
| FR-022 | [적용] 시 에이전트가 컴포넌트 자동 재배치 | P1 | FR-021 |
| **시각적 편집** |
| FR-030 | iframe + 오버레이로 실제 화면 표시 + 컴포넌트별 선택 | P0 | FR-014 |
| FR-031 | 컴포넌트 드래그 이동 | P0 | FR-030 |
| FR-032 | 컴포넌트 리사이즈 (핸들 드래그) | P0 | FR-030 |
| FR-033 | 컴포넌트 선택 시 정보 표시 (이름, 위치, 크기, 소스 파일) | P1 | FR-030 |
| FR-034 | Undo/Redo | P1 | FR-031 |
| **반응형 자동 변환** |
| FR-040 | **[모바일 보기] → AI가 375px 기준 자동 재배치** (Agent #3) | P1 | FR-014 |
| FR-041 | 반응형 결과를 사용자가 추가 조정 가능 | P1 | FR-040 |
| **소스코드 리팩토링** |
| FR-050 | 프로젝트 소스 경로 자동 감지 (cwd 기반) | P0 | FR-001 |
| FR-051 | **AI가 변경 delta → 기존 소스코드 diff 생성** (Agent #4) | P0 | FR-050, FR-031 |
| FR-052 | diff 미리보기 (before/after + 설명) | P0 | FR-051 |
| FR-053 | [적용] 시 소스 파일 실제 수정 + 백업 생성 | P0 | FR-052 |
| **자기 검증** |
| FR-060 | **리팩토링 후 Puppeteer 재렌더링 → 편집 의도와 비교** (Agent #5) | P0 | FR-053 |
| FR-061 | 불일치 시 자동 재수정 (diff 재생성 → 재적용 → 재검증, 최대 3회) | P0 | FR-060 |
| **에이전트 UX** |
| FR-070 | 에이전트 실행 상태 실시간 표시 (스캔 → 인식 → 제안 → 리팩토링 → 검증) | P0 | FR-013 |
| FR-071 | 에이전트 판단 로그 (reasoning 투명 표시) | P1 | FR-013 |

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
| 편집기 렌더링 | < 2초 |
| 드래그/리사이즈 반응 | 60fps |
| 코드 리팩토링 | < 15초 |
| 자기 검증 (1회) | < 10초 |

### 5.2 Security

- SSRF 방어: localhost만 허용
- 소스코드 접근: 로컬 파일시스템만, cwd 하위만 허용
- 경로 검증: `..` 포함 시 거부 (path traversal 방어)
- API Key: .env.local 서버사이드 전용
- 소스 수정 전 반드시 diff 미리보기 → 사용자 확인 → 백업 생성

---

## 6. Technical Design

### 6.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  사용자 터미널                                                    │
│  $ cd my-project                                                 │
│  $ npx wigss --port 3000                                         │
│                                                                  │
│  ┌──── bin/cli.js ────────────────────────────────────────────┐  │
│  │  1. cwd → 소스 경로 감지                                    │  │
│  │  2. --port → dev 서버 포트 설정                              │  │
│  │  3. WIGSS 서버 기동 (localhost:4000)                         │  │
│  │  4. 브라우저 자동 오픈                                       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Browser (localhost:4000)                     │
│                                                                  │
│  ┌─ 플로팅 툴바 ──────────────────────────────────────────────┐ │
│  │ [Edit] [Mobile View] [Save] [Undo] ···          [Close]    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ iframe (localhost:3000 내 페이지) ────────────────────────┐ │
│  │  ┌── 오버레이 ─────────────────────────────────────────┐   │ │
│  │  │  각 컴포넌트에 드래그/리사이즈 핸들                    │   │ │
│  │  └─────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Agent Panel (접기/펼치기) ─────────────────────────────────┐│
│  │ 에이전트 상태 + 로그 + 제안 카드 + 검증 상태               ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─ Zustand ─────────────────────────────────────────────────┐  │
│  │ editor-store: components, changes, selectedId, history     │  │
│  │ agent-store: status, logs, suggestions, verification       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────┘
                                       │ HTTP
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Backend (Next.js API Routes)                     │
│                                                                  │
│  /api/scan       → Puppeteer       (AI 없음)                    │
│  /api/detect     → Claude API      (Agent #1)                   │
│  /api/suggest    → Claude API      (Agent #2)                   │
│  /api/responsive → Claude API      (Agent #3)                   │
│  /api/refactor   → Claude API + fs (Agent #4)                   │
│  /api/apply      → Node.js fs      (AI 없음)                    │
│  /api/verify     → Puppeteer + Claude (Agent #5)                │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Core Pipeline

```
[npx wigss --port 3000]
    │
    ├── cwd 감지 → /Users/dev/my-project (소스 경로)
    ├── --port 3000 → dev 서버 위치
    ├── WIGSS 서버 기동 → localhost:4000
    └── 브라우저 자동 오픈
            │
            ▼
[Step 1: DOM 스캔]
    Puppeteer → localhost:3000 렌더링 → DOM 트리 + 스크린샷
            │
[Step 2: 컴포넌트 인식] ★ Agent #1
    DOM 트리 + 스타일 → Claude AI → 컴포넌트 목록 + 바운딩 박스
            │
[Step 3: 디자인 제안] ★ Agent #2
    컴포넌트 배치 분석 → "간격 불균일, 정렬 미스" 제안
            │
[Step 4: 시각적 편집]
    사용자가 드래그/리사이즈 (또는 제안 수락)
    [모바일 보기] → ★ Agent #3 → 375px 자동 재배치
            │
[Step 5: 리팩토링] ★ Agent #4
    변경 delta + 소스코드 → diff 생성 → 미리보기 → 적용
            │
[Step 6: 자기 검증] ★ Agent #5
    Puppeteer 재렌더링 → 비교 → 불일치 시 자동 재수정 (최대 3회)
            │
          완료
```

### 6.3 Tech Stack

| Layer | Technology | 선택 이유 |
|-------|-----------|----------|
| CLI | bin/cli.js + commander | npx 진입점, 인자 파싱 |
| Frontend | Next.js 14 (App Router) | 풀스택, API Routes 통합 |
| Visual Editor | iframe + 오버레이 div | 실제 화면 그대로 + 편집 레이어 |
| Drag/Resize | interact.js | 검증된 드래그/리사이즈 라이브러리 |
| State | Zustand | 경량 상태 관리 |
| Styling | Tailwind CSS | 빠른 UI 구성 |
| AI | Claude API (Tool Use) | 컴포넌트 인식 + 리팩토링 |
| DOM Scan | Puppeteer | Headless Chrome |
| File I/O | Node.js fs | 소스 읽기/쓰기 |
| Browser Open | open (npm) | CLI에서 브라우저 자동 오픈 |
| Package | npm publish | npx 배포 |

### 6.4 Directory Structure

```
wigss/
├── bin/
│   └── cli.js                          # CLI 진입점 (npx wigss)
├── demo-target/                        # 데모용 샘플 웹 페이지
│   ├── src/
│   │   ├── app/page.tsx                # 메인 페이지
│   │   └── components/
│   │       ├── Navbar.tsx
│   │       ├── CardGrid.tsx
│   │       ├── Card.tsx
│   │       ├── Sidebar.tsx
│   │       └── Footer.tsx
│   ├── package.json
│   └── tailwind.config.ts
├── src/                                # WIGSS 에디터 본체
│   ├── app/
│   │   ├── page.tsx                    # 메인 에디터
│   │   └── api/
│   │       ├── scan/route.ts           # DOM 스캔
│   │       ├── detect/route.ts         # AI 컴포넌트 인식
│   │       ├── suggest/route.ts        # AI 디자인 제안
│   │       ├── responsive/route.ts     # AI 반응형 변환
│   │       ├── refactor/route.ts       # AI 소스 리팩토링
│   │       ├── apply/route.ts          # 소스 파일 수정
│   │       └── verify/route.ts         # 자기 검증 루프
│   ├── components/
│   │   ├── editor/
│   │   │   ├── VisualEditor.tsx        # iframe + 오버레이
│   │   │   ├── ComponentOverlay.tsx    # 드래그/리사이즈 핸들
│   │   │   └── FloatingToolbar.tsx     # 플로팅 툴바
│   │   ├── panels/
│   │   │   ├── AgentPanel.tsx          # 에이전트 상태/로그/제안
│   │   │   ├── DiffPreview.tsx         # 코드 diff
│   │   │   └── ComponentInfo.tsx       # 선택 컴포넌트 정보
│   │   └── common/
│   ├── stores/
│   │   ├── editor-store.ts             # 편집 상태
│   │   └── agent-store.ts              # 에이전트 상태
│   ├── lib/
│   │   ├── puppeteer.ts
│   │   ├── claude.ts
│   │   ├── component-detector.ts
│   │   ├── code-refactorer.ts
│   │   └── file-utils.ts
│   ├── types/
│   │   └── index.ts
│   └── data/
│       └── demo-scan-result.json       # 데모 모드용 캐싱
├── package.json                        # bin 필드 포함
├── CLAUDE.md
├── README.md
├── README.ko.md
└── docs/
    ├── prd/PRD_wigss.md
    ├── todo_plan/PLAN_wigss.md
    └── ARCHITECTURE.md
```

### 6.5 API Specification

#### `POST /api/scan` — DOM 스캔

- **역할**: Puppeteer로 페이지 렌더링, DOM 트리 + 스크린샷 + 소스 파일 목록 추출
- **AI Agent**: 없음
- **데모 모드**: `DEMO_MODE=true` → 캐싱 JSON 반환

**Request**: `{ url, projectPath, options: { viewport, maxElements } }`
**Response**: `{ screenshot, pageTitle, viewport, domTree[], sourceFiles[] }`
**Errors**: 400 INVALID_URL, 403 URL_NOT_ALLOWED, 408 SCAN_TIMEOUT, 502 FETCH_FAILED

---

#### `POST /api/detect` — 컴포넌트 자동 인식

- **역할**: AI가 DOM 트리 분석 → 컴포넌트 단위 분리
- **AI Agent**: #1 Component Detector (Claude Tool Use)
- **Tools**: `identify_component`, `analyze_layout_pattern`, `map_to_source`

**Request**: `{ domTree[], screenshot, sourceFiles[] }`
**Response**: `{ components[{ id, name, type, elementIds, boundingBox, sourceFile, reasoning, children[] }], agentLog[] }`

---

#### `POST /api/suggest` — 디자인 개선 제안

- **역할**: AI가 현재 레이아웃을 능동적으로 분석 → 개선안 제시
- **AI Agent**: #2 Design Advisor

**Request**: `{ components[], viewport }`
**Response**: `{ suggestions[{ id, type, title, description, affectedComponents, preview.changes[], confidence }], agentLog[] }`

---

#### `POST /api/responsive` — 반응형 자동 변환

- **역할**: AI가 데스크톱 → 모바일 레이아웃 자동 변환
- **AI Agent**: #3 Responsive Converter

**Request**: `{ components[], sourceViewport, targetViewport }`
**Response**: `{ mobileComponents[{ componentId, name, boundingBox, reasoning }], agentLog[] }`

---

#### `POST /api/refactor` — 소스코드 리팩토링

- **역할**: 시각적 변경 → 기존 소스코드 diff 생성
- **AI Agent**: #4 Code Refactorer

**Request**: `{ originalComponents[], modifiedComponents[], projectPath, changes[] }`
**Response**: `{ diffs[{ file, original, modified, lineNumber, explanation }], agentLog[] }`

---

#### `POST /api/apply` — 소스 파일 수정

- **역할**: diff를 실제 파일에 적용
- **AI Agent**: 없음

**Request**: `{ diffs[], projectPath }`
**Response**: `{ appliedFiles[], backupCreated }`

---

#### `POST /api/verify` — 자기 검증 루프

- **역할**: 재렌더링 → 편집 의도와 비교 → 불일치 시 자동 재수정
- **AI Agent**: #5 Self-Verifier (Puppeteer + Claude)

**Request**: `{ projectPath, url, expectedLayout[], maxRetries: 3 }`
**Response**: `{ passed, attempts[{ screenshot, mismatches[], autoFix }], finalPassed, totalAttempts, agentLog[] }`

---

### 6.6 demo-target 스펙

WIGSS가 편집할 내장 샘플 웹 페이지.

| 항목 | 내용 |
|------|------|
| 스택 | Next.js 14 + Tailwind CSS |
| 포트 | localhost:3001 |
| 컴포넌트 | Navbar, Hero, Card Grid (3개), Sidebar, Footer |
| 의도적 결함 | 카드 간격 불균일 (16px/24px 혼재), Sidebar 정렬 8px 어긋남, Navbar 높이 비효율적 |
| 소스 구조 | 컴포넌트별 파일 분리 (`Navbar.tsx`, `Card.tsx` 등) |
| 용도 | 해커톤 데모 + 개발 테스트 |

### 6.7 Data Model

```typescript
interface ScanResult {
  screenshot: string;
  pageTitle: string;
  viewport: { width: number; height: number };
  domTree: DOMElement[];
  sourceFiles: string[];
}

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

interface DesignSuggestion {
  id: string;
  type: 'spacing' | 'alignment' | 'sizing' | 'hierarchy' | 'overlap';
  title: string;
  description: string;
  affectedComponents: string[];
  preview: { changes: ComponentChange[] };
  confidence: number;
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
  history: ComponentChange[][];
  historyIndex: number;
}

interface AgentStore {
  status: 'idle' | 'scanning' | 'detecting' | 'suggesting'
        | 'converting' | 'refactoring' | 'applying' | 'verifying';
  logs: { step: string; detail: string }[];
  suggestions: DesignSuggestion[];
  verification: {
    passed: boolean;
    attempts: { screenshot: string; mismatches: any[]; autoFix: any }[];
    finalPassed: boolean;
    totalAttempts: number;
  } | null;
}
```

---

## 7. AI Agent Design

### 7.1 에이전트 전체 맵

| # | 에이전트 | API | 호출 시점 | Claude Tools |
|---|---------|-----|----------|-------------|
| 1 | Component Detector | `/api/detect` | 스캔 후 자동 | identify_component, analyze_layout_pattern, map_to_source |
| 2 | Design Advisor | `/api/suggest` | detect 후 자동 | 없음 (추론만) |
| 3 | Responsive Converter | `/api/responsive` | [모바일 보기] 클릭 | 없음 (추론만) |
| 4 | Code Refactorer | `/api/refactor` | [저장] 클릭 | 없음 (소스 읽기는 서버) |
| 5 | Self-Verifier | `/api/verify` | apply 후 자동 | 없음 (Puppeteer는 서버) |

### 7.2 에이전트가 하는 일 / 안 하는 일

**하는 일**: 컴포넌트 인식, 디자인 제안, 반응형 변환, 코드 리팩토링, 자기 검증
**안 하는 일**: 기본 레이아웃 조작 (사용자 드래그), 자연어 명령 처리

### 7.3 호출 타이밍

```
자동 ──── [#1 Detect] → [#2 Suggest] → ··· → [#5 Verify → #4 재수정 루프]
수동 ──── [사용자 편집] → [#3 모바일 보기] → [#4 저장]
```

---

## 8. Trae.ai 활용 전략

| 시점 | Trae 기능 | 목적 |
|------|-----------|------|
| 스캐폴딩 | Builder Mode | Next.js + Tailwind 보일러플레이트 |
| UI 컴포넌트 | Chat Mode | 에디터 UI 빠른 프로토타이핑 |
| 디버깅 | Chat Mode | Puppeteer/오버레이 이슈 |
| 핵심 로직 | Claude Code 병행 | Agent Tool Use, 리팩토링 |
| 발표 | 캡처 | Trae 활용 증거 |

---

## 9. Fallback 전략

### 9.1 기술 Fallback

| 위험 | Plan A | Plan B | Plan C |
|------|--------|--------|--------|
| Puppeteer 불가 | Headless Chrome | 캐싱 JSON + 스크린샷 | 데모 모드 |
| 컴포넌트 인식 부정확 | Claude 자동 | 사용자 수동 영역 지정 | 사전 캐싱 |
| 리팩토링 실패 | Claude diff | 텍스트 가이드 | 새 CSS 생성 |
| iframe 오버레이 | iframe + overlay | 스크린샷 + overlay | Canvas |
| CLI 실행 이슈 | npx wigss | 직접 pnpm dev | 데모용 스크립트 |

### 9.2 시간 Fallback

| 남은 시간 | 절삭 | 보존 |
|-----------|------|------|
| 5h+ | 없음 | 전체 |
| 3h | Phase 4, 반응형 | 편집 + 리팩토링 + 검증 |
| 2h | 리팩토링+검증 | 스캔 + 인식 + 제안 + 편집 |
| 1h | 편집+리팩토링 | 인식 + 제안 데모 + Fallback 영상 |

**우선순위**: 컴포넌트 인식 > 디자인 제안 > 편집기 > 리팩토링 > 자기검증 > 반응형

---

## 10. 데모 시나리오 (3분)

```
[0:00 ~ 0:15] 문제
  "코딩 에이전트로 화면은 금방 만듭니다.
   근데 디자인 다듬는 건? 말로 설명하기 어렵죠.
   직접 만지면 됩니다."

[0:15 ~ 0:25] CLI 실행
  $ npx wigss --port 3001
  → 브라우저 자동 오픈, 내 페이지가 편집 가능한 상태로

[0:25 ~ 0:45] 컴포넌트 인식 ★Agent #1
  "스캔" → AI가 "Navbar, Card Grid, Sidebar" 자동 인식
  각 컴포넌트에 드래그 핸들 표시

[0:45 ~ 1:05] 디자인 제안 ★Agent #2
  "카드 간격이 불균일합니다. 맞출까요?" → [적용]
  에이전트가 먼저 문제를 찾아서 제안

[1:05 ~ 1:35] 편집 + 모바일 ★Agent #3
  Navbar 높이 리사이즈 + [모바일 보기] → 자동 재배치

[1:35 ~ 2:15] 리팩토링 ★Agent #4
  [저장] → AI가 소스코드 diff → "h-16→h-12" → [적용]

[2:15 ~ 2:40] 자기 검증 ★Agent #5
  재렌더링 → "4px 불일치" → 자동 재수정 → "통과"

[2:40 ~ 3:00]
  "5가지 자율 행동. 설치 없이 npx 한 줄. 개발자는 드래그만."
```

---

## 11. 예상 질문 & 답변

| 질문 | 답변 |
|------|------|
| "설치가 필요한가요?" | "npx wigss 한 줄이면 됩니다. 프로젝트에 아무것도 추가되지 않습니다." |
| "Figma랑 뭐가 다르죠?" | "Figma는 디자인 도구, WIGSS는 코드와 연결됩니다. 만지면 소스코드가 바뀝니다." |
| "어떤 프로젝트에서 동작?" | "React/Next.js + Tailwind 최적화. CSS Module, inline style도 지원 가능." |
| "코드가 깨지면?" | "diff 미리보기 + 백업 생성 + 자기 검증 루프(3회)로 안전합니다." |
| "자연어 명령은?" | "드래그가 더 빠릅니다. 대신 에이전트가 능동적으로 개선을 제안합니다." |

---

## 12. 배포 모델

| 단계 | 방식 | 명령어 |
|------|------|--------|
| 개발/데모 | 소스에서 직접 | `pnpm dev` |
| 얼리 어답터 | GitHub install | `npm i -g github:wigtn/wigss` |
| 정식 배포 | npm publish (5분) | `npx wigss` |

`package.json`:
```json
{
  "name": "wigss",
  "bin": { "wigss": "./bin/cli.js" }
}
```

---

## 13. Success Metrics

| Metric | Target |
|--------|--------|
| DOM 스캔 성공률 | > 90% |
| 컴포넌트 인식 정확도 | > 70% |
| 드래그/리사이즈 FPS | 60fps |
| 코드 리팩토링 → 빌드 성공률 | > 80% |
| 자기 검증 통과율 (3회 이내) | > 90% |
| 디자인 제안 유효성 | > 70% |
| 반응형 변환 성공률 | > 70% |
| 데모 완료 시간 | < 3분 |
