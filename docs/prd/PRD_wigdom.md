# WIGSS PRD

> **Version**: 3.1
> **Created**: 2026-03-26
> **Updated**: 2026-03-27 (자기검증 루프, 디자인 제안, 반응형 변환 추가)
> **Status**: Final
> **Hackathon**: 2026-03-28 (Trae.ai 주관, 주제: "에이전트")

---

## 1. Overview

### 1.1 한 줄 피치

> **"코드로 대충 짜놓은 화면을, 웹 꾸미기처럼 직접 만지고, 저장하면 코드가 알아서 바뀐다."**

### 1.2 Problem Statement

AI 시대에 웹 디자이너나 퍼블리셔 없이 프론트엔드 개발자가 직접 화면을 만드는 경우가 늘고 있다. 개발자는 코드로 화면을 대충 구성할 수는 있지만, 이걸 "보기 좋게" 다듬는 건 여전히 고통이다.

**기존 방식의 문제:**
- CSS를 수정하고 → 새로고침하고 → 확인하고 → 다시 수정하는 반복
- 컴포넌트 간 간격, 크기, 배치를 코드로 조정하는 건 비효율적
- 디자인 도구(Figma 등)에서 만든 결과를 코드로 옮기는 건 또 다른 작업

**WIGSS이 해결하는 방식:**
1. 개발자가 코드로 화면을 간단히 구성한다
2. **AI 에이전트가 렌더링된 화면의 DOM을 분석하여, 각 컴포넌트를 자동으로 인식하고 개별 조작 가능한 단위로 분리한다** ← 핵심 에이전트 기능
3. **에이전트가 현재 레이아웃의 문제점(간격 불균일, 정렬 미스 등)을 분석하고 개선안을 제안한다** ← 능동적 에이전트
4. 개발자가 웹 꾸미기처럼 컴포넌트를 드래그/리사이즈/재배치한다 (또는 에이전트 제안을 수락)
5. **저장하면 AI 에이전트가 변경된 레이아웃에 맞춰 기존 소스코드를 자동 리팩토링한다** ← 핵심 에이전트 기능
6. **에이전트가 리팩토링 결과를 다시 렌더링하여 의도한 레이아웃과 비교 검증, 불일치 시 자동 재수정한다** ← 자기 검증 루프
7. **"모바일 보기" 시 에이전트가 현재 레이아웃을 375px 기준으로 자동 재배치한다** ← 반응형 자동 변환

> 자연어로 "이거 옮겨줘"가 아니라, **직접 클릭해서 드래그하면 된다.** 마치 웹 빌더처럼.
> 단, 에이전트는 **능동적으로 "이건 이렇게 하면 더 좋겠다"고 제안**한다.

### 1.3 Goals

- 개발서버 화면의 DOM을 스캔하여 **컴포넌트 단위로 자동 인식/분리**
- 분리된 컴포넌트를 **드래그/리사이즈/재배치** 가능한 시각적 편집기 제공
- 실제 렌더링된 화면 그대로 보여주되, 각 컴포넌트가 개별 조작 가능
- 편집 결과를 저장하면 **기존 소스코드를 AI가 자동 리팩토링**
- **리팩토링 후 자기 검증**: 수정된 코드를 다시 렌더링 → 편집 의도와 비교 → 불일치 시 자동 재수정 (최대 3회)
- **디자인 개선 제안**: 에이전트가 능동적으로 간격/정렬/크기 문제를 감지하고 개선안 제안
- **반응형 자동 변환**: "모바일 보기" 시 에이전트가 375px 기준으로 레이아웃 자동 재배치

### 1.4 Non-Goals (Out of Scope)

- 새로운 컴포넌트 추가/생성 (기존 화면의 재배치에 집중)
- 백엔드 로직/API 자동 생성
- Figma/Sketch 수준의 그래픽 편집
- 프로덕션 배포 자동화
- 실시간 협업 편집

### 1.5 Scope

| 포함 | 제외 |
|------|------|
| 개발서버 DOM 스캔 + 컴포넌트 자동 인식 | 서버 사이드 렌더링 분석 |
| 시각적 드래그/리사이즈 편집기 | 3D 변환/애니메이션 편집 |
| AI 기반 컴포넌트 경계 판단 | 복잡한 인터랙션 편집 |
| 기존 소스코드 리팩토링 | 새 프로젝트 생성 |
| React/Next.js 프로젝트 지원 | Vue/Angular 등 (향후 확장) |

---

## 2. 해커톤 심사 기준 매핑

해커톤 주제 "에이전트" 5가지 핵심 기준:

| 심사 기준 | WIGSS 대응 | 데모 증거 |
|-----------|------------|-----------|
| **목표를 이해하고** | 개발자의 소스코드 + 렌더링된 화면을 함께 분석 | URL + 프로젝트 경로 입력 → 화면 구조 파악 |
| **필요한 정보를 모으고** | DOM 분석으로 컴포넌트 경계, 중첩 관계, 스타일 자동 수집 | Navbar, Card Grid, Sidebar 등 자동 인식 |
| **적절한 도구를 활용하고** | 컴포넌트 분리 → 시각적 편집기 제공 → AST 기반 코드 수정 | 드래그/리사이즈 UI + 코드 diff 생성 |
| **여러 단계를 거쳐** | DOM 분석 → 컴포넌트 인식 → 편집 가능 변환 → 코드 리팩토링 | 멀티스텝 에이전트 파이프라인 |
| **실제 결과를 만들어내는** | 기존 소스코드가 실제로 수정됨 | 리팩토링된 코드로 다시 빌드 → 편집한 대로 화면 표시 |

### "에이전트다움" 핵심 — 5가지 자율 행동

```
1. 컴포넌트 자동 인식   → DOM + 스타일을 분석하여 "이건 Navbar, 이건 Card Grid"를 스스로 판단
2. 디자인 개선 제안     → 현재 레이아웃의 문제점을 능동적으로 감지하고 "이렇게 하면 더 좋겠다" 제안
3. 반응형 자동 변환     → "모바일 보기" 시 데스크톱 레이아웃을 375px 기준으로 자율 재배치
4. 코드 리팩토링        → 변경된 레이아웃을 분석하여 기존 소스의 어떤 파일/라인을 수정할지 자율 판단
5. 자기 검증 + 자동 수정 → 리팩토링 결과를 다시 렌더링 → 불일치 시 스스로 코드 재수정 (최대 3회)
```

### 차별화 키워드

| 키워드 | 설명 |
|--------|------|
| **컴포넌트 자동 분리** | "DOM을 보고 에이전트가 스스로 컴포넌트 경계를 판단합니다" |
| **능동적 제안** | "에이전트가 먼저 '이 간격이 불균일합니다' 같은 개선안을 제안합니다" |
| **반응형 원클릭** | "'모바일 보기' 한 번이면 에이전트가 알아서 레이아웃을 재배치합니다" |
| **소스코드 리팩토링** | "새 코드를 만드는 게 아니라, 기존 소스를 수정합니다" |
| **자기 검증** | "리팩토링 후 스스로 결과를 검증하고, 안 맞으면 스스로 재수정합니다" |

---

## 3. User Stories

### 3.1 Primary User - 프론트엔드 개발자

**US-001**: As a 프론트엔드 개발자, I want to 코드로 대충 짜놓은 화면을 WIGSS에 넣으면 각 컴포넌트가 자동으로 분리되어 so that 디자인 도구처럼 직접 드래그/리사이즈로 배치할 수 있다.

**US-002**: As a 프론트엔드 개발자, I want to 시각적으로 편집한 결과를 저장하면 기존 소스코드가 자동으로 리팩토링되어 so that CSS를 직접 수정하지 않아도 된다.

**US-003**: As a 프론트엔드 개발자, I want to 리팩토링된 코드를 바로 빌드하면 내가 편집한 대로 화면이 나와 so that 디자이너/퍼블리셔 없이도 화면을 다듬을 수 있다.

### 3.2 해커톤 심사위원

**US-004**: As a 심사위원, I want to 에이전트가 DOM을 분석하여 컴포넌트를 자동 인식하고, 편집 후 코드를 리팩토링하는 전 과정을 관찰 so that 에이전트다움을 평가할 수 있다.

### 3.3 Acceptance Criteria (Gherkin)

```gherkin
Scenario: DOM 스캔 및 컴포넌트 자동 분리
  Given 개발서버가 localhost:3000에서 실행 중이고 프로젝트 소스 경로가 제공되었다
  When 사용자가 URL을 입력하고 "스캔" 버튼을 클릭한다
  Then AI 에이전트가 DOM을 분석하여 컴포넌트 단위로 자동 인식한다
  And 각 컴포넌트(Navbar, Card, Sidebar 등)가 개별 선택/드래그/리사이즈 가능한 상태로 표시된다
  And 실제 렌더링된 화면의 모습 그대로 보인다

Scenario: 컴포넌트 시각적 편집 (웹 꾸미기)
  Given 컴포넌트가 분리된 편집 모드에 있다
  When 사용자가 Card 컴포넌트를 드래그하여 새 위치에 놓는다
  Then 해당 컴포넌트가 새 위치에 실시간으로 배치된다
  When 사용자가 Navbar의 높이를 리사이즈 핸들로 줄인다
  Then Navbar 높이가 줄어들고 하단 컴포넌트들이 자동 재배치된다

Scenario: 소스코드 자동 리팩토링
  Given 사용자가 컴포넌트들을 시각적으로 재배치 완료했다
  When "저장" 버튼을 클릭한다
  Then AI 에이전트가 변경된 레이아웃을 분석한다
  And 기존 소스코드의 해당 CSS/스타일 부분을 자동 수정한다
  And 수정된 코드 diff를 미리보기로 보여준다
  And 사용자가 "적용"을 누르면 실제 소스 파일이 수정된다

Scenario: 리팩토링 자기 검증 + 자동 재수정
  Given 소스코드가 리팩토링되었다
  When 에이전트가 수정된 코드를 다시 렌더링하여 검증한다
  Then 편집한 레이아웃과 비교하여 일치 여부를 판단한다
  And 불일치가 발견되면 자동으로 코드를 재수정한다 (최대 3회)
  And 검증 결과와 수정 이력이 AgentPanel에 표시된다

Scenario: 디자인 개선 제안
  Given 컴포넌트가 분리된 편집 모드에 있다
  When 에이전트가 현재 레이아웃을 분석한다
  Then "Card 간격이 불균일합니다. 균일하게 맞출까요?" 같은 개선안을 제안한다
  And 사용자가 "적용"을 누르면 에이전트가 자동으로 배치를 수정한다
  And 사용자가 "무시"를 누르면 현재 상태를 유지한다

Scenario: 반응형 자동 변환
  Given 데스크톱(1280px) 레이아웃이 편집 모드에 있다
  When 사용자가 "모바일 보기 (375px)" 버튼을 클릭한다
  Then 에이전트가 현재 레이아웃을 분석하여 375px 기준으로 자동 재배치한다
  And 3열 그리드 → 1열 스택, 사이드바 → 하단 이동 등이 자동 적용된다
  And 사용자가 결과를 추가 조정할 수 있다
  And 저장 시 반응형 media query를 포함한 코드로 리팩토링된다
```

---

## 4. Functional Requirements

| ID | Requirement | Priority | Dependencies |
|----|------------|----------|--------------|
| **DOM 스캔 & 컴포넌트 인식** |
| FR-001 | 개발서버 URL 입력으로 DOM 스캔 (Puppeteer headless) | P0 | - |
| FR-002 | getBoundingClientRect + getComputedStyle 추출 | P0 | FR-001 |
| FR-003 | **AI 에이전트가 DOM 트리를 분석하여 컴포넌트 경계를 자동 인식** (Navbar, Card, Sidebar, Footer 등) | P0 | FR-002 |
| FR-004 | 인식된 컴포넌트별 바운딩 박스 + 라벨 표시 | P0 | FR-003 |
| FR-005 | 요소 스마트 필터링 (invisible/script/style/meta 제외, 최대 200개) | P0 | FR-002 |
| FR-021 | 데모 모드 (사전 스캔 결과 캐싱, Puppeteer 실패 시 fallback) | P0 | FR-001 |
| **시각적 편집 (웹 꾸미기)** |
| FR-006 | 실제 렌더링된 화면을 그대로 표시하되, 컴포넌트별 선택 가능 | P0 | FR-004 |
| FR-007 | 컴포넌트 드래그 이동 (자유 배치) | P0 | FR-006 |
| FR-008 | 컴포넌트 리사이즈 (핸들 드래그로 늘리고/줄이고) | P0 | FR-006 |
| FR-009 | 컴포넌트 선택 시 정보 표시 (컴포넌트명, 원본 파일 경로, CSS 클래스) | P1 | FR-006 |
| FR-010 | Undo/Redo 지원 | P1 | FR-007 |
| FR-011 | 스냅/그리드 정렬 가이드 | P2 | FR-007 |
| **소스코드 리팩토링** |
| FR-012 | 프로젝트 소스 경로 입력 + 파일 구조 분석 | P0 | - |
| FR-013 | **AI 에이전트가 변경된 레이아웃 → 기존 소스코드 매핑 (어떤 파일의 어떤 라인을 수정할지 판단)** | P0 | FR-012, FR-007 |
| FR-014 | 수정된 코드 diff 미리보기 | P0 | FR-013 |
| FR-015 | "적용" 시 실제 소스 파일 수정 | P0 | FR-014 |
| FR-016 | 리팩토링 후 자기 검증: 수정된 코드 → Puppeteer 재렌더링 → 편집 의도와 비교 | P0 | FR-015 |
| FR-022 | **자기 검증 실패 시 자동 재수정 (diff 재생성 → 재적용 → 재검증, 최대 3회 루프)** | P0 | FR-016 |
| **디자인 개선 제안** |
| FR-023 | **편집 모드 진입 시 에이전트가 현재 레이아웃을 능동적으로 분석하여 개선안 제안** (간격 불균일, 정렬 미스, 크기 불일치 등) | P1 | FR-004 |
| FR-024 | 제안 UI: 제안 카드 목록 (설명 + 미리보기 + "적용"/"무시" 버튼) | P1 | FR-023 |
| FR-025 | "적용" 시 에이전트가 해당 컴포넌트를 자동 재배치 (사용자 드래그 없이) | P1 | FR-024 |
| **반응형 자동 변환** |
| FR-026 | **"모바일 보기" 버튼 → 에이전트가 현재 레이아웃을 375px 기준으로 자동 재배치** | P1 | FR-004 |
| FR-027 | 반응형 변환 시 에이전트 판단: 다열→1열, 사이드바→하단, 요소 크기 축소 등 | P1 | FR-026 |
| FR-028 | 반응형 결과를 사용자가 추가 조정 가능 | P1 | FR-026 |
| FR-029 | 저장 시 media query 포함 코드로 리팩토링 | P2 | FR-026, FR-013 |
| **에이전트 UX** |
| FR-017 | 에이전트 실행 과정 실시간 표시 (컴포넌트 인식 중... → 편집 모드 준비 → 리팩토링 중... → 검증 중... → 재수정 중...) | P0 | FR-003 |
| FR-018 | 에이전트 판단 로그 (왜 이걸 하나의 컴포넌트로 인식했는지, 왜 이 개선을 제안했는지 등) | P1 | FR-003 |

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
| 코드 리팩토링 생성 | < 15초 |

### 5.2 Security

- SSRF 방어: localhost만 허용
- 소스코드 접근: 로컬 파일시스템만 (서버사이드)
- API Key: .env.local 서버사이드 전용
- 소스 수정 전 반드시 diff 미리보기 → 사용자 확인

---

## 6. Technical Design

### 6.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │  URL + Path   │───>│  DOM Scanner      │───>│  Component   │  │
│  │  Input        │    │  (Puppeteer)      │    │  Detector    │  │
│  └──────────────┘    └──────────────────┘    │  (AI Agent)  │  │
│                                               └──────┬───────┘  │
│                                                      │          │
│                                                      ▼          │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │  Component    │    │  Visual Editor    │◄──│  Component   │  │
│  │  Info Panel   │◄──>│  (Drag/Resize)    │    │  Store       │  │
│  └──────────────┘    └────────┬─────────┘    │  (Zustand)   │  │
│                               │               └──────────────┘  │
│                               │ "저장"                           │
│                               ▼                                  │
│                      ┌──────────────────┐                       │
│                      │  Code Diff        │                       │
│                      │  Preview          │                       │
│                      └────────┬─────────┘                       │
│                               │ "적용"                           │
└───────────────────────────────┼──────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Next.js API Routes)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  /api/scan          → Puppeteer DOM 추출                         │
│  /api/detect        → AI 컴포넌트 인식 (Claude Tool Use)         │
│  /api/refactor      → AI 소스코드 리팩토링 (Claude)              │
│  /api/apply         → 소스 파일 실제 수정                        │
│  /api/verify        → 수정 후 재렌더링 비교                      │
│                                                                  │
│  File System Access → 프로젝트 소스코드 읽기/쓰기                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Claude API            │
                    │  (Tool Use + 추론)     │
                    └───────────────────────┘
```

### 6.2 Core Pipeline

```
[Step 1: DOM 스캔]
개발서버 URL → Puppeteer → 실제 페이지 렌더링 → 스크린샷 + DOM 트리 추출
                                                          │
[Step 2: 컴포넌트 자동 인식] ★ AI 에이전트 핵심 ★          ▼
DOM 트리 + 스타일 정보 → Claude AI 분석
  → "이 div.navbar는 Navigation 컴포넌트"
  → "이 section.cards는 Card Grid 컴포넌트 (자식 3개)"
  → "이 aside.sidebar는 Sidebar 컴포넌트"
  → 각 컴포넌트의 바운딩 박스 + 계층 관계 생성
                                                          │
[Step 3: 편집 모드 변환]                                    ▼
컴포넌트별 바운딩 박스 → 오버레이 UI 생성
  → 각 컴포넌트에 선택/드래그/리사이즈 핸들 부착
  → 실제 렌더링된 화면 위에 편집 레이어 겹침
                                                          │
[Step 4: 시각적 편집 (사용자)]                              ▼
사용자가 컴포넌트를 드래그/리사이즈/재배치
  → Zustand 상태에 변경사항 기록
  → 원본 대비 변경 delta 추적
                                                          │
[Step 5: 소스코드 리팩토링] ★ AI 에이전트 핵심 ★           ▼
변경 delta + 프로젝트 소스 → Claude AI 분석
  → "src/components/Navbar.tsx의 className에서 h-16 → h-12로"
  → "src/app/page.tsx의 grid-cols-3 → grid-cols-2로"
  → "src/components/Sidebar.tsx를 main 아래로 이동"
  → 코드 diff 생성 → 사용자 확인 → 소스 파일 수정
```

### 6.3 Tech Stack

| Layer | Technology | 선택 이유 |
|-------|-----------|----------|
| Frontend | Next.js 14 (App Router) | 풀스택, API Routes 통합 |
| Visual Editor | iframe + 오버레이 div | 실제 화면 그대로 표시 + 편집 레이어 |
| Drag/Resize | interact.js 또는 커스텀 | 컴포넌트 오버레이에 드래그/리사이즈 |
| State | Zustand | 컴포넌트 상태 + 변경 추적 |
| Styling | Tailwind CSS | 빠른 UI 구성 |
| AI | Claude API (Tool Use) | 컴포넌트 인식 + 코드 리팩토링 |
| DOM Scan | Puppeteer | Headless Chrome 렌더링 |
| File I/O | Node.js fs | 프로젝트 소스 읽기/쓰기 |
| Package Manager | pnpm | 빠른 설치 |

### 6.4 Directory Structure

```
src/
├── app/
│   ├── page.tsx                        # 메인 에디터
│   └── api/
│       ├── scan/route.ts               # DOM 스캔 + 스크린샷
│       ├── detect/route.ts             # AI 컴포넌트 인식
│       ├── refactor/route.ts           # AI 소스코드 리팩토링
│       ├── apply/route.ts              # 소스 파일 실제 수정
│       └── verify/route.ts             # 수정 후 재렌더링 비교
├── components/
│   ├── editor/
│   │   ├── VisualEditor.tsx            # iframe + 오버레이 편집기
│   │   ├── ComponentOverlay.tsx        # 컴포넌트별 드래그/리사이즈 핸들
│   │   └── SelectionBox.tsx            # 선택 상태 표시
│   ├── panels/
│   │   ├── Toolbar.tsx                 # URL 입력 + 스캔 + 저장
│   │   ├── ComponentPanel.tsx          # 인식된 컴포넌트 목록
│   │   ├── AgentPanel.tsx              # 에이전트 상태 + 로그
│   │   └── DiffPreview.tsx             # 코드 diff 미리보기
│   └── common/
├── stores/
│   ├── editor-store.ts                 # 편집 상태 (컴포넌트, 변경 delta)
│   └── agent-store.ts                  # 에이전트 실행 상태
├── lib/
│   ├── puppeteer.ts                    # DOM 스캔 + 스크린샷
│   ├── claude.ts                       # Claude API + Tool 정의
│   ├── component-detector.ts           # 컴포넌트 인식 로직
│   ├── code-refactorer.ts              # 소스코드 리팩토링 로직
│   └── file-utils.ts                   # 프로젝트 소스 파일 읽기/쓰기
├── types/
│   └── index.ts
└── data/
    └── demo-scan-result.json           # 데모 모드용
```

### 6.5 API Specification

#### `POST /api/scan`

DOM 스캔 + 스크린샷 캡처

**Request**:
```json
{
  "url": "http://localhost:3000",
  "projectPath": "/Users/dev/my-project/src",
  "options": {
    "viewport": { "width": 1280, "height": 720 },
    "maxElements": 200
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "screenshot": "string (base64 PNG)",
    "pageTitle": "string",
    "viewport": { "width": 1280, "height": 720 },
    "domTree": [
      {
        "id": "el_001",
        "tag": "nav",
        "className": "navbar flex items-center h-16 bg-white",
        "rect": { "x": 0, "y": 0, "width": 1280, "height": 64 },
        "computedStyles": { ... },
        "children": ["el_002", "el_003"],
        "depth": 1
      }
    ],
    "sourceFiles": ["src/app/page.tsx", "src/components/Navbar.tsx", ...]
  }
}
```

---

#### `POST /api/detect`

AI 에이전트가 DOM을 분석하여 컴포넌트 단위로 인식

**Request**:
```json
{
  "domTree": "DOMElement[] - /api/scan 결과",
  "screenshot": "string (base64) - 시각적 참고",
  "sourceFiles": "string[] - 프로젝트 소스 파일 목록"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "components": [
      {
        "id": "comp_001",
        "name": "Navigation Bar",
        "type": "navbar",
        "elementIds": ["el_001", "el_002", "el_003"],
        "boundingBox": { "x": 0, "y": 0, "width": 1280, "height": 64 },
        "sourceFile": "src/components/Navbar.tsx",
        "reasoning": "nav 태그 + flex 레이아웃 + 상단 고정 위치로 Navigation Bar로 판단"
      },
      {
        "id": "comp_002",
        "name": "Card Grid",
        "type": "grid",
        "elementIds": ["el_010", "el_011", "el_012"],
        "boundingBox": { "x": 0, "y": 64, "width": 960, "height": 400 },
        "sourceFile": "src/app/page.tsx",
        "children": [
          { "id": "comp_002_1", "name": "Card 1", ... },
          { "id": "comp_002_2", "name": "Card 2", ... },
          { "id": "comp_002_3", "name": "Card 3", ... }
        ],
        "reasoning": "grid-cols-3 레이아웃 + 반복되는 card 패턴으로 Card Grid로 판단"
      }
    ],
    "agentLog": [
      { "step": "DOM 트리 분석", "detail": "총 142개 요소, 최상위 6개 섹션 식별" },
      { "step": "컴포넌트 경계 판단", "detail": "시맨틱 태그 + CSS 레이아웃 패턴 기반 8개 컴포넌트 인식" },
      { "step": "소스 파일 매핑", "detail": "className 기반으로 6개 소스 파일과 매핑 완료" }
    ]
  }
}
```

---

#### `POST /api/refactor`

변경된 레이아웃 → 기존 소스코드 리팩토링 생성

**Request**:
```json
{
  "originalComponents": "Component[] - 원본 컴포넌트 상태",
  "modifiedComponents": "Component[] - 편집 후 컴포넌트 상태",
  "projectPath": "string - 프로젝트 소스 경로",
  "changes": [
    {
      "componentId": "comp_001",
      "type": "resize",
      "from": { "width": 1280, "height": 64 },
      "to": { "width": 1280, "height": 48 }
    },
    {
      "componentId": "comp_002",
      "type": "move",
      "from": { "x": 0, "y": 64 },
      "to": { "x": 0, "y": 48 }
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "diffs": [
      {
        "file": "src/components/Navbar.tsx",
        "original": "className=\"h-16 px-4\"",
        "modified": "className=\"h-12 px-4\"",
        "lineNumber": 8,
        "explanation": "Navbar 높이 64px → 48px 축소 반영"
      },
      {
        "file": "src/app/page.tsx",
        "original": "className=\"mt-16\"",
        "modified": "className=\"mt-12\"",
        "lineNumber": 15,
        "explanation": "Navbar 높이 변경에 따른 메인 콘텐츠 상단 여백 조정"
      }
    ],
    "agentLog": [
      { "step": "변경 분석", "detail": "2개 컴포넌트 변경 감지 (resize 1, move 1)" },
      { "step": "소스 매핑", "detail": "Navbar.tsx, page.tsx 수정 필요" },
      { "step": "코드 생성", "detail": "Tailwind 클래스 기반 수정 2건 생성" }
    ]
  }
}
```

---

#### `POST /api/apply`

Diff를 실제 소스 파일에 적용

**Request**:
```json
{
  "diffs": "Diff[] - /api/refactor 결과",
  "projectPath": "string"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "appliedFiles": ["src/components/Navbar.tsx", "src/app/page.tsx"],
    "backupCreated": true
  }
}
```

---

#### `POST /api/verify`

리팩토링 결과 검증 + 자동 재수정 루프

**Request**:
```json
{
  "projectPath": "string",
  "url": "string - 개발서버 URL",
  "expectedLayout": "Component[] - 사용자가 편집한 컴포넌트 상태",
  "maxRetries": 3
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "passed": true,
    "attempts": [
      {
        "attempt": 1,
        "screenshot": "string (base64)",
        "mismatches": [
          {
            "componentId": "comp_001",
            "expected": { "height": 48 },
            "actual": { "height": 52 },
            "deviation": "4px"
          }
        ],
        "autoFix": {
          "applied": true,
          "diffs": [{ "file": "...", "original": "...", "modified": "..." }]
        }
      },
      {
        "attempt": 2,
        "screenshot": "string (base64)",
        "mismatches": [],
        "autoFix": null
      }
    ],
    "finalPassed": true,
    "totalAttempts": 2,
    "agentLog": [
      { "step": "검증 1회차", "detail": "Navbar 높이 4px 불일치 발견" },
      { "step": "자동 수정", "detail": "h-12 → py-2.5로 재조정" },
      { "step": "검증 2회차", "detail": "모든 컴포넌트 위치/크기 일치. 통과." }
    ]
  }
}
```

---

#### `POST /api/suggest`

에이전트가 현재 레이아웃을 분석하여 디자인 개선안 제안

**Request**:
```json
{
  "components": "Component[] - 현재 컴포넌트 상태",
  "viewport": { "width": 1280, "height": 720 }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "id": "sug_001",
        "type": "spacing",
        "title": "카드 간격 균일화",
        "description": "Card 1-2 간격 16px, Card 2-3 간격 24px → 모두 16px로 균일화",
        "affectedComponents": ["comp_002_1", "comp_002_2", "comp_002_3"],
        "preview": {
          "changes": [
            { "componentId": "comp_002_2", "type": "move", "to": { "x": 340 } },
            { "componentId": "comp_002_3", "type": "move", "to": { "x": 660 } }
          ]
        },
        "confidence": 0.9
      },
      {
        "id": "sug_002",
        "type": "alignment",
        "title": "Sidebar 상단 정렬",
        "description": "Sidebar 상단이 Card Grid보다 8px 아래. 맞추면 깔끔해집니다.",
        "affectedComponents": ["comp_003"],
        "preview": {
          "changes": [
            { "componentId": "comp_003", "type": "move", "to": { "y": 64 } }
          ]
        },
        "confidence": 0.85
      }
    ],
    "agentLog": [
      { "step": "레이아웃 분석", "detail": "8개 컴포넌트, 간격/정렬/크기 검사" },
      { "step": "이슈 발견", "detail": "간격 불균일 1건, 정렬 미스 1건" }
    ]
  }
}
```

---

#### `POST /api/responsive`

에이전트가 현재 레이아웃을 모바일 뷰포트 기준으로 자동 재배치

**Request**:
```json
{
  "components": "Component[] - 현재 데스크톱 컴포넌트 상태",
  "sourceViewport": { "width": 1280, "height": 720 },
  "targetViewport": { "width": 375, "height": 812 }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "mobileComponents": [
      {
        "componentId": "comp_001",
        "name": "Navigation Bar",
        "boundingBox": { "x": 0, "y": 0, "width": 375, "height": 48 },
        "reasoning": "Navbar 너비를 375px에 맞추고, 높이를 48px로 축소 (모바일 비율)"
      },
      {
        "componentId": "comp_002",
        "name": "Card Grid",
        "boundingBox": { "x": 0, "y": 56, "width": 375, "height": 600 },
        "reasoning": "3열 grid → 1열 스택으로 변환, 각 카드를 전체 너비로 확장"
      },
      {
        "componentId": "comp_003",
        "name": "Sidebar",
        "boundingBox": { "x": 0, "y": 664, "width": 375, "height": 200 },
        "reasoning": "사이드바를 메인 콘텐츠 아래로 이동 (모바일에서는 우측 사이드바 비실용적)"
      }
    ],
    "agentLog": [
      { "step": "뷰포트 분석", "detail": "1280px → 375px, 비율 0.293" },
      { "step": "레이아웃 전략", "detail": "다열→1열 변환, 사이드바 하단 이동" },
      { "step": "크기 재계산", "detail": "8개 컴포넌트 재배치 완료" }
    ]
  }
}
```

---

### 6.6 Visual Editor 구현 방식

**핵심 아이디어**: 실제 렌더링된 화면을 iframe으로 보여주고, 그 위에 편집 오버레이를 겹친다.

```
┌─ Visual Editor ──────────────────────────────────────────┐
│                                                           │
│  ┌─ iframe (실제 렌더링 화면) ──────────────────────────┐ │
│  │                                                       │ │
│  │  ┌─────────── Navbar ──────────────┐  ← 오버레이     │ │
│  │  │  Logo    Home  About  Contact   │  (드래그 가능)  │ │
│  │  └─────────────────────────────────┘                  │ │
│  │                                                       │ │
│  │  ┌── Card 1 ──┐ ┌── Card 2 ──┐ ┌── Card 3 ──┐      │ │
│  │  │  [image]   │ │  [image]   │ │  [image]   │      │ │
│  │  │  Title     │ │  Title     │ │  Title     │      │ │
│  │  │  Desc...   │ │  Desc...   │ │  Desc...   │      │ │
│  │  └────────────┘ └────────────┘ └────────────┘      │ │
│  │       ↑ 리사이즈 핸들       ↑ 드래그 가능             │ │
│  │                                                       │ │
│  │  ┌─────────── Footer ─────────────┐                  │ │
│  │  │  © 2026 Company                │                  │ │
│  │  └────────────────────────────────┘                  │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                           │
│  [선택된 컴포넌트: Card Grid]                              │
│  위치: (0, 64)  크기: 960 x 400  소스: page.tsx:12        │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**구현 방식**:
1. `iframe`에 개발서버 URL을 로드 (실제 화면 그대로)
2. iframe 위에 투명한 오버레이 `div`를 겹침
3. 각 인식된 컴포넌트의 바운딩 박스 위치에 드래그/리사이즈 핸들을 배치
4. 오버레이에서 이벤트를 캡처 (iframe 내부 클릭 차단)
5. 드래그/리사이즈 시 오버레이 + 시각적 피드백 (가이드라인, 크기 표시)

### 6.7 Data Model

```typescript
interface ScanResult {
  screenshot: string;       // base64 PNG
  pageTitle: string;
  viewport: { width: number; height: number };
  domTree: DOMElement[];
  sourceFiles: string[];
}

interface DetectedComponent {
  id: string;
  name: string;             // "Navigation Bar", "Card Grid" 등
  type: string;             // "navbar", "grid", "sidebar", "footer" 등
  elementIds: string[];     // 포함하는 DOM 요소 ID
  boundingBox: { x: number; y: number; width: number; height: number };
  sourceFile: string;       // 매핑된 소스 파일 경로
  reasoning: string;        // AI가 왜 이걸 하나의 컴포넌트로 인식했는지
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

// Zustand Store
interface EditorStore {
  // 스캔 결과
  scanResult: ScanResult | null;

  // 컴포넌트
  components: DetectedComponent[];
  selectedComponentId: string | null;

  // 변경 추적
  changes: ComponentChange[];

  // 리팩토링 결과
  diffs: CodeDiff[];

  // 히스토리
  history: ComponentChange[][];
  historyIndex: number;

  // 에이전트 상태
  agentStatus: 'idle' | 'scanning' | 'detecting' | 'refactoring' | 'applying' | 'verifying';
  agentLog: { step: string; detail: string }[];
}
```

---

## 7. AI Agent Design

### 7.1 에이전트가 하는 일 (5가지)

| # | 기능 | 입력 | 출력 | 에이전트다움 |
|---|------|------|------|-------------|
| 1 | **컴포넌트 자동 인식** | DOM 트리 + 스타일 + 스크린샷 | 컴포넌트 목록 + 바운딩 박스 + 소스 매핑 | DOM을 보고 "이건 Navbar"라고 스스로 판단 |
| 2 | **디자인 개선 제안** | 현재 컴포넌트 배치 | 개선안 목록 (간격/정렬/크기) | 능동적으로 "이 간격이 불균일합니다" 제안 |
| 3 | **반응형 자동 변환** | 데스크톱 레이아웃 + 타겟 뷰포트 | 모바일 레이아웃 | 다열→1열, 사이드바→하단 등 자율 판단 |
| 4 | **소스코드 리팩토링** | 변경 delta + 프로젝트 소스 | 코드 diff | 어떤 파일의 어떤 줄을 고칠지 스스로 판단 |
| 5 | **자기 검증 + 자동 수정** | 수정된 코드 + 편집 의도 | 검증 결과 + 재수정 diff | 불일치 발견 → 스스로 코드 재수정 (최대 3회) |

### 7.2 에이전트가 하지 않는 일

- 기본 레이아웃 조작 → **사용자가 직접 드래그/리사이즈** (에이전트가 대신 하지 않음)
- 자연어 명령으로 "이거 옮겨줘" → 없음 (직접 만지는 게 더 빠름)
- 단, **제안 수락** 또는 **반응형 변환** 시에는 에이전트가 배치를 자동 수정

### 7.3 Agent 1: 컴포넌트 자동 인식

**System Prompt**:
```
당신은 웹 페이지의 DOM 구조를 분석하여 UI 컴포넌트를 자동으로 인식하는 전문 에이전트입니다.

## 입력
- DOM 트리 (태그, 클래스, 스타일, 위치/크기)
- 페이지 스크린샷 (시각적 참고)
- 프로젝트 소스 파일 목록

## 작업
1. DOM 트리를 순회하며 시맨틱 태그(nav, header, main, aside, footer)를 먼저 식별
2. CSS 레이아웃 패턴(flex, grid, 반복 구조)을 분석하여 논리적 컴포넌트 그룹 판단
3. 각 컴포넌트의 경계(바운딩 박스)를 결정
4. className을 기반으로 프로젝트 소스 파일과 매핑
5. 각 판단에 대한 reasoning을 기록

## 컴포넌트 인식 기준
- 시맨틱 태그: nav, header, main, section, aside, footer → 독립 컴포넌트
- 반복 패턴: 같은 클래스의 형제 요소 → 그리드/리스트 컴포넌트 (자식도 개별 조작 가능)
- 레이아웃 역할: flex/grid 컨테이너 → 레이아웃 컴포넌트
- 시각적 독립성: 배경색/테두리/그림자가 있는 블록 → 카드/패널 컴포넌트
- 깊이 기반: 최상위 레벨은 반드시 분리, 깊은 레벨은 의미 있는 단위만

## 출력
각 컴포넌트에 대해: id, name, type, elementIds, boundingBox, sourceFile, reasoning
```

**Tool 정의**:
```typescript
const detectorTools = [
  {
    name: "identify_component",
    description: "DOM 요소 그룹을 하나의 컴포넌트로 인식",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "컴포넌트 이름 (예: 'Navigation Bar')" },
        type: { type: "string", enum: ["navbar", "header", "hero", "grid", "card", "sidebar", "footer", "section", "form", "modal"] },
        elementIds: { type: "array", items: { type: "string" } },
        sourceFile: { type: "string", description: "매핑된 소스 파일 경로" },
        reasoning: { type: "string", description: "이 판단의 근거" }
      },
      required: ["name", "type", "elementIds", "reasoning"]
    }
  },
  {
    name: "analyze_layout_pattern",
    description: "DOM 영역의 레이아웃 패턴 분석 (flex, grid, stack 등)",
    input_schema: {
      type: "object",
      properties: {
        elementId: { type: "string" },
        focus: { type: "string", enum: ["children", "siblings", "parent"] }
      },
      required: ["elementId"]
    }
  },
  {
    name: "map_to_source",
    description: "DOM 요소의 className/id를 프로젝트 소스 파일과 매핑",
    input_schema: {
      type: "object",
      properties: {
        className: { type: "string" },
        sourceFiles: { type: "array", items: { type: "string" } }
      },
      required: ["className"]
    }
  }
];
```

### 7.4 Agent 2: 소스코드 리팩토링

**System Prompt**:
```
당신은 시각적 레이아웃 변경을 기존 소스코드에 반영하는 코드 리팩토링 전문 에이전트입니다.

## 입력
- 원본 컴포넌트 상태 (위치/크기)
- 수정된 컴포넌트 상태 (위치/크기)
- 프로젝트 소스코드 (관련 파일들)

## 작업
1. 각 컴포넌트의 변경 사항(이동, 크기 변경)을 분석
2. 변경에 해당하는 소스 파일과 라인을 찾음
3. CSS/Tailwind 클래스 또는 스타일 속성을 수정하는 diff를 생성
4. 연쇄 영향 분석 (예: Navbar 높이 변경 → 아래 컨텐츠의 margin-top 조정)
5. 각 수정에 대한 설명을 기록

## 수정 전략
- Tailwind 프로젝트: className의 유틸리티 클래스 변경 (h-16 → h-12 등)
- CSS Module 프로젝트: .module.css 파일의 속성 값 변경
- Inline Style 프로젝트: style 속성의 값 변경
- 연쇄 영향: 부모/형제 요소의 관련 속성도 함께 수정

## 출력
파일별 diff 목록: file, original, modified, lineNumber, explanation
```

### 7.5 에이전트 실행 흐름

```
사용자: URL + 프로젝트 경로 입력 → [스캔]
                │
                ▼
┌──────────────────────────────────┐
│  Step 1: DOM 스캔                │  Puppeteer → DOM 트리 + 스크린샷
│  AgentPanel: "화면 스캔 중..."    │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Step 2: 컴포넌트 인식 (AI)      │  Claude → 컴포넌트 경계 자동 판단
│  AgentPanel: "컴포넌트 인식 중..." │  → "Navbar 발견", "Card Grid 발견"
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Step 3: 디자인 개선 제안 (AI)   │  Claude → 레이아웃 분석 → 개선안 도출
│  AgentPanel: "레이아웃 분석 중..."│  → "카드 간격 불균일", "Sidebar 정렬 미스"
│  제안 카드 표시 [적용] [무시]     │  → 적용 시 에이전트가 자동 배치 수정
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Step 4: 편집 모드               │  컴포넌트별 오버레이 표시
│  → 사용자가 직접 드래그/리사이즈  │
│  → [모바일 보기] 버튼 제공        │
│     → 에이전트가 375px 자동 재배치│
└──────────┬───────────────────────┘
           │
           │  사용자: [저장]
           ▼
┌──────────────────────────────────┐
│  Step 5: 코드 리팩토링 (AI)      │  Claude → 소스코드 diff 생성
│  AgentPanel: "코드 분석 중..."    │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Step 6: Diff 미리보기           │  사용자가 수정 내용 확인
│  사용자: [적용] 또는 [취소]       │
└──────────┬───────────────────────┘
           │ 적용
           ▼
┌──────────────────────────────────┐
│  Step 7: 소스 파일 수정 + 백업    │  실제 파일 쓰기
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Step 8: 자기 검증 (AI)          │  Puppeteer 재렌더링 → 편집 의도와 비교
│  AgentPanel: "검증 중..."         │
│                                  │
│  ┌────────┐                      │
│  │ 일치?  │── YES → "검증 통과"  │
│  └───┬────┘                      │
│      │ NO                        │
│      ▼                           │
│  자동 재수정 (diff 재생성 + 적용) │
│  → 재검증 (최대 3회 루프)         │
│                                  │
│  AgentPanel: "불일치 발견 →       │
│   자동 수정 → 재검증 통과"        │
└──────────────────────────────────┘
```

---

## 8. Trae.ai 활용 전략

| 활용 시점 | Trae 기능 | 목적 |
|-----------|-----------|------|
| 스캐폴딩 | Builder Mode | Next.js + Tailwind 보일러플레이트 |
| UI 컴포넌트 | Chat Mode | 에디터 UI 빠른 프로토타이핑 |
| 디버깅 | Chat Mode | Puppeteer/오버레이 이슈 해결 |
| 핵심 로직 | Claude Code 병행 | Agent Tool Use, 소스 리팩토링 |
| 발표 | 캡처 | Trae 활용 증거 |

---

## 9. Fallback 전략

### 9.1 기술 Fallback

| 위험 | Plan A | Plan B | Plan C |
|------|--------|--------|--------|
| Puppeteer 불가 | Puppeteer headless | 사전 캐싱 JSON + 스크린샷 | 데모 모드 |
| 컴포넌트 인식 부정확 | Claude 자동 인식 | 사용자가 수동으로 영역 지정 | 사전 인식 결과 캐싱 |
| 소스코드 리팩토링 실패 | Claude diff 생성 | 수정 가이드만 텍스트로 제시 | 새 CSS 파일 생성 |
| iframe 오버레이 이슈 | iframe + div 오버레이 | 스크린샷 이미지 + 오버레이 | Canvas 기반 렌더링 |
| 소스 파일 쓰기 권한 | fs.writeFile | diff 클립보드 복사 | 콘솔 출력 |

### 9.2 데모 Fallback

| 상황 | 대응 |
|------|------|
| 인터넷 끊김 | 데모 모드 (캐싱 데이터) |
| Claude API 다운 | 사전 녹화 에이전트 실행 영상 |
| 전체 다운 | 풀 데모 녹화 영상 (3분) |

### 9.3 시간 Fallback

| 남은 시간 | 절삭 | 보존 |
|-----------|------|------|
| 5h+ | 없음 | 전체 |
| 3h | 검증(Step 6), 고급 편집 기능 | 스캔 + 컴포넌트 인식 + 기본 편집 + 리팩토링 |
| 2h | 리팩토링(Step 4-5) | 스캔 + 컴포넌트 인식 + 편집만 |
| 1h | 편집 + 리팩토링 | 스캔 + 컴포넌트 인식 데모만 |

**핵심**: 컴포넌트 자동 인식이 살아야 "에이전트"로 인정받는다.

---

## 10. 데모 시나리오 (3분)

```
[0:00 ~ 0:15] 문제 소개
  "AI 시대에 디자이너 없이 개발자가 직접 화면을 만듭니다.
   코드로 대충 구성은 하는데, 보기 좋게 다듬는 건 여전히 고통입니다."

[0:15 ~ 0:40] DOM 스캔 + 컴포넌트 자동 인식 ★에이전트 1★
  1. 개발서버 URL + 프로젝트 경로 입력 → "스캔"
  2. AI 에이전트가 컴포넌트 인식
     → "Navbar 발견", "Card Grid 발견", "Sidebar 발견"
  3. 각 컴포넌트에 선택/드래그 핸들 표시

  ★ "에이전트가 스스로 DOM을 분석하고 컴포넌트를 판단합니다."

[0:40 ~ 1:00] 디자인 개선 제안 ★에이전트 2★
  4. 에이전트가 능동적으로 제안 표시
     → "카드 간격이 불균일합니다. 균일하게 맞출까요?"
     → "Sidebar 상단이 Card Grid와 8px 어긋나 있습니다."
  5. "적용" 클릭 → 에이전트가 자동으로 배치 수정

  ★ "에이전트가 먼저 문제를 찾아서 제안합니다. 챗봇이 아니라 능동적 에이전트."

[1:00 ~ 1:30] 시각적 편집 + 반응형 변환 ★에이전트 3★
  6. 사용자가 직접 Navbar 높이 리사이즈
  7. "모바일 보기" 클릭 → 에이전트가 375px 기준 자동 재배치
     → 3열→1열, 사이드바→하단 이동
  8. 결과 확인 후 미세 조정

  ★ "모바일 변환도 에이전트가 알아서. 다열→1열, 사이드바 이동 등을 자율 판단."

[1:30 ~ 2:15] 코드 리팩토링 ★에이전트 4★
  9. "저장" → AI가 소스코드 diff 생성
     → "Navbar.tsx의 h-16 → h-12", "page.tsx의 grid-cols-3 수정"
  10. Diff 미리보기 확인 → "적용"

[2:15 ~ 2:40] 자기 검증 ★에이전트 5★
  11. 에이전트가 수정된 코드를 다시 렌더링
  12. "Navbar 높이 4px 불일치 발견 → 자동 재수정 → 재검증 통과"
  → AgentPanel에 검증 루프 과정 실시간 표시

  ★ "에이전트가 결과를 스스로 검증하고, 안 맞으면 스스로 다시 고칩니다."

[2:40 ~ 3:00] 마무리
  "WIGSS의 에이전트는 5가지를 스스로 합니다.
   컴포넌트를 인식하고, 개선을 제안하고, 반응형을 변환하고,
   코드를 리팩토링하고, 결과를 검증합니다.
   개발자는 드래그만 하면 됩니다."
```

---

## 11. 예상 질문 & 답변

| 질문 | 답변 |
|------|------|
| "Figma랑 뭐가 다른가요?" | "Figma는 디자인 도구고, WIGSS은 코드와 연결됩니다. 실제 렌더링된 화면을 편집하면 소스코드가 바뀝니다." |
| "에이전트가 컴포넌트를 잘못 인식하면?" | "사용자가 수동으로 영역을 조정할 수 있고, 인식 결과에 reasoning이 표시되어 왜 그렇게 판단했는지 투명합니다." |
| "어떤 프로젝트에서 작동하나요?" | "현재는 React/Next.js + Tailwind 프로젝트에 최적화. CSS Module, inline style도 지원 가능." |
| "코드가 깨지면 어떡하나요?" | "적용 전 반드시 diff 미리보기를 보여주고, 사용자가 확인 후 적용합니다. 백업도 자동 생성." |
| "자연어 명령은 없나요?" | "기본 조작은 드래그가 더 빠릅니다. 대신 에이전트가 능동적으로 개선을 제안하고, 반응형 변환도 자동으로 해줍니다." |
| "자기 검증이 실패하면?" | "최대 3회 자동 재수정합니다. 3회 후에도 불일치 시 사용자에게 수동 확인을 요청합니다." |

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| DOM 스캔 성공률 | > 90% |
| 컴포넌트 인식 정확도 | > 70% (주요 컴포넌트) |
| 드래그/리사이즈 FPS | 60fps |
| 코드 리팩토링 → 빌드 성공률 | > 80% |
| 자기 검증 통과율 (3회 이내) | > 90% |
| 디자인 제안 유효성 | > 70% |
| 반응형 변환 성공률 | > 70% |
| 리팩토링 후 레이아웃 일치도 | > 70% |
| 데모 완료 시간 | < 3분 |
