# Wigdom PRD

> **Version**: 1.0
> **Created**: 2026-03-26
> **Status**: Reviewed (Critical issues fixed)
> **Project**: Hackathon - Wigdom (AI Agent 기반 DOM 레이아웃 자동화 도구)

## 1. Overview

### 1.1 Problem Statement

프론트엔드 개발/퍼블리싱 작업에서 CSS 레이아웃 배치는 코드를 수정하고 브라우저를 새로고침하는 반복 작업이 필요하다. 중첩된 DOM 구조 안에서 요소의 위치를 변경하려면 부모-자식 관계, flexbox/grid 속성, position 등 여러 CSS 속성을 이해하고 조합해야 한다.

**이 도구는 개발서버의 DOM을 스캔하여 Canvas 위에 플랫하게 펼친 뒤, 마우스 드래그 또는 자연어 목표를 주면 AI 에이전트가 자율적으로 관찰→계획→실행→검증을 반복하며 레이아웃을 자동 재배치하고, 최종 결과를 깨끗한 HTML/CSS 코드로 변환해주는 AI 에이전트 기반 레이아웃 자동화 도구다.**

### 1.2 Goals
- 개발서버에서 렌더링된 실제 DOM을 Canvas에 1:1로 재현
- 중첩된 DOM 트리를 플랫한 단일 오브젝트로 변환하여 자유로운 드래그 편집 지원
- **AI 에이전트가 자연어 목표를 받으면 자율적으로 멀티 스텝 실행 (관찰→계획→실행→검증 루프)**
- 에이전트 실행 과정을 사용자에게 실시간 시각화 (계획, 진행률, 변경 로그)
- 편집 결과를 구조화된 HTML/CSS로 역변환하여 실제 코드에 반영

### 1.3 Non-Goals (Out of Scope)
- 실시간 협업 편집 (멀티 유저)
- 모바일 앱 (React Native 등) 지원
- 백엔드 로직/API 자동 생성
- Figma/Sketch 같은 본격적인 디자인 툴 수준의 그래픽 편집
- 프로덕션 배포 자동화

### 1.4 Scope

| 포함 | 제외 |
|------|------|
| 개발서버 DOM 스캔 및 파싱 | 서버 사이드 렌더링 분석 |
| Canvas 기반 시각적 레이아웃 편집기 | 3D 변환/애니메이션 편집 |
| AI 자연어 명령으로 레이아웃 조작 | 복잡한 인터랙션(이벤트 핸들러) 편집 |
| HTML/CSS 코드 자동 생성 및 export | JavaScript 로직 생성 |
| AI 레이아웃 자동 제안 | A/B 테스트 자동화 |

## 2. User Stories

### 2.1 Primary User - 프론트엔드 개발자

**US-001**: As a 프론트엔드 개발자, I want to 개발서버에 띄운 페이지의 DOM을 스캔하여 Canvas에 시각화 so that 코드 수정 없이 레이아웃을 눈으로 확인하고 조작할 수 있다.

**US-002**: As a 프론트엔드 개발자, I want to Canvas에서 중첩된 요소들을 개별 오브젝트로 자유롭게 드래그 so that CSS 속성을 직접 수정하지 않고 빠르게 레이아웃을 잡을 수 있다.

**US-003**: As a 프론트엔드 개발자, I want to 편집한 레이아웃을 HTML/CSS 코드로 자동 변환 so that 바로 프로젝트에 적용할 수 있다.

### 2.2 Secondary User - 퍼블리셔/디자이너

**US-004**: As a 퍼블리셔, I want to "헤더를 상단 고정하고, 카드 3개를 가로 정렬해줘" 같은 자연어로 레이아웃을 변경 so that CSS 문법을 몰라도 레이아웃을 조작할 수 있다.

**US-005**: As a 디자이너, I want to AI가 현재 레이아웃을 분석하고 개선안을 제안 so that 더 나은 디자인 결과물을 빠르게 얻을 수 있다.

### 2.3 Acceptance Criteria (Gherkin)

```gherkin
Scenario: DOM 스캔 및 Canvas 시각화
  Given 개발서버가 localhost:3000에서 실행 중이다
  When 사용자가 URL을 입력하고 "스캔" 버튼을 클릭한다
  Then 해당 페이지의 DOM 요소들이 Canvas 위에 플랫하게 시각화된다
  And 각 요소는 원래 위치, 크기, 스타일을 반영한다

Scenario: 오브젝트 드래그 이동
  Given Canvas에 DOM 요소들이 시각화되어 있다
  When 사용자가 특정 요소를 마우스로 드래그하여 새 위치에 놓는다
  Then 해당 요소가 새 위치에 배치된다
  And 변경 사항이 실시간으로 Canvas에 반영된다

Scenario: 자연어 레이아웃 변경
  Given Canvas에 DOM 요소들이 시각화되어 있다
  When 사용자가 "이 버튼을 오른쪽 하단으로 옮겨줘"라고 입력한다
  Then AI 에이전트가 해당 요소를 식별한다
  And 지정된 위치로 오브젝트가 이동된다

Scenario: HTML/CSS 코드 내보내기
  Given 사용자가 Canvas에서 레이아웃 편집을 완료했다
  When "코드 생성" 버튼을 클릭한다
  Then 편집된 레이아웃이 구조화된 HTML/CSS 코드로 변환된다
  And 코드를 클립보드 복사 또는 파일 다운로드할 수 있다
```

## 3. Functional Requirements

| ID | Requirement | Priority | Dependencies |
|----|------------|----------|--------------|
| FR-001 | 개발서버 URL 입력으로 DOM 스캔 (Puppeteer headless browser) | P0 (Must) | - |
| FR-002 | Puppeteer로 실제 렌더링된 DOM에서 getBoundingClientRect + getComputedStyle 추출 | P0 (Must) | FR-001 |
| FR-015 | 요소 스마트 필터링: display:none/script/style/meta 제외, 최소 면적(10x10px) 이상만, 최대 200개 제한 | P0 (Must) | FR-002 |
| FR-003 | Canvas에 DOM 요소를 플랫한 단일 오브젝트로 렌더링 (색상 사각형 + 태그 라벨) | P0 (Must) | FR-015 |
| FR-004 | 오브젝트 마우스 드래그 이동 (자유 배치) | P0 (Must) | FR-003 |
| FR-005 | 오브젝트 리사이즈 (핸들 드래그) | P1 (Should) | FR-003 |
| FR-006 | Canvas 상태를 HTML/CSS로 역변환 (기본: position absolute, auto: AI가 flex/grid 판단하여 생성) | P0 (Must) | FR-004 |
| FR-007 | AI 에이전트 자율 실행 루프 (OBSERVE→PLAN→EXECUTE→VERIFY 반복) | P0 (Must) | FR-003 |
| FR-016 | 에이전트 실행 계획 수립 및 사용자 표시 (create_plan) | P0 (Must) | FR-007 |
| FR-017 | 에이전트 자율 검증 및 자동 수정 (verify_layout → 재실행) | P0 (Must) | FR-007 |
| FR-018 | 에이전트 실행 과정 실시간 시각화 (SSE 스트리밍) | P0 (Must) | FR-007 |
| FR-019 | 에이전트 제어 (일시정지/재개/건너뛰기/중단) | P1 (Should) | FR-018 |
| FR-020 | 자연어 목표 → 에이전트 멀티 스텝 자동 실행 (반응형 변환, 정리, 접근성 등) | P0 (Must) | FR-007 |
| FR-008 | AI 레이아웃 자동 제안 (현재 배치 분석) | P1 (Should) | FR-003 |
| FR-009 | 생성된 코드 미리보기 및 export (복사/다운로드) | P0 (Must) | FR-006 |
| FR-010 | Undo/Redo 지원 | P1 (Should) | FR-004 |
| FR-011 | 오브젝트 선택 시 원본 태그 정보 표시 (태그명, class, id) | P1 (Should) | FR-003 |
| FR-012 | 스냅/그리드 정렬 가이드 | P2 (Could) | FR-004 |
| FR-013 | 디자인 시스템(Tailwind 등) 클래스 자동 매핑 | P2 (Could) | FR-006, FR-007 |
| FR-014 | 레이아웃 상태 저장/불러오기 | P1 (Should) | FR-004 |

## 4. Non-Functional Requirements

### 4.0 Scale Grade

**Hobby** (해커톤 프로젝트)

| 항목 | 값 |
|------|-----|
| 일일 사용자(DAU) | < 100 (데모/심사용) |
| 동시접속 | < 10 |
| 데이터량 | < 100MB |

### 4.1 Performance SLA

| 지표 | 목표값 |
|------|--------|
| DOM 스캔 완료 시간 | < 5초 (필터링 후 최대 200개 요소 기준) |
| Canvas 렌더링 | < 1초 |
| 드래그 반응 속도 | 60fps (16ms 이하) |
| AI 응답 시간 | < 5초 (자연어 명령) |
| 코드 생성 시간 | < 2초 |

### 4.2 Availability SLA

| 등급 | Uptime | 비고 |
|------|--------|------|
| Hobby | 95% | 해커톤 데모 시간에 안정적 동작이면 충분 |

### 4.3 Data Requirements

| 항목 | 값 |
|------|-----|
| 현재 데이터량 | < 10MB |
| 데이터 보존 기간 | 세션 기반 (브라우저 localStorage) |
| 저장 형태 | JSON (Canvas 상태) + HTML/CSS (export) |

### 4.4 Recovery

| 항목 | 값 |
|------|-----|
| RTO | N/A (클라이언트 앱) |
| RPO | 세션 중 localStorage 자동 저장 |

### 4.5 Security
- Authentication: 불필요 (로컬 도구)
- SSRF 방어: `/api/scan` URL 허용 목록 적용
  - 허용: `localhost`, `127.0.0.1`, `0.0.0.0` 만 허용
  - 차단: 사설 IP (10.x, 172.16-31.x, 192.168.x, 169.254.x), `file://`, `ftp://`, `gopher://` 프로토콜
- XSS: 스캔된 HTML 내 script 태그 무시, Canvas 렌더링 시 innerHTML 미사용
- API Key: AI API 키는 서버사이드 환경변수로 관리 (.env.local)

## 5. Technical Design

### 5.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │  URL Input    │───>│  DOM Scanner      │───>│  DOM Parser   │  │
│  │  Panel        │    │  (Puppeteer)      │    │  (Tree→Flat)  │  │
│  └──────────────┘    └──────────────────┘    └──────┬───────┘  │
│                                                      │          │
│                                                      ▼          │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │  AI Chat      │◄──>│  Canvas Editor    │◄──│  Object Store │  │
│  │  Panel        │    │  (Drag & Drop)    │    │  (State Mgmt) │  │
│  └──────┬───────┘    └──────────────────┘    └──────────────┘  │
│         │                     │                                  │
│         ▼                     ▼                                  │
│  ┌──────────────┐    ┌──────────────────┐                      │
│  │  AI Agent     │    │  Code Generator   │                      │
│  │  Service      │    │  (Canvas→HTML/CSS)│                      │
│  └──────┬───────┘    └──────────────────┘                      │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐
│  Backend (API Server)│
├─────────────────────┤
│  - AI Proxy API      │
│  - Puppeteer Scanner │
│  (Headless Chrome)   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  AI Provider         │
│  (Claude API)        │
└─────────────────────┘
```

### 5.2 Core Pipeline

```
[Phase 1: DOM Scan]
개발서버 URL → Puppeteer headless 접속 → 실제 페이지 렌더링
                                              │
[Phase 2: Extract & Filter]                   ▼
Puppeteer page.evaluate() → querySelectorAll('*')
  → getBoundingClientRect() + getComputedStyle() 추출
  → 스마트 필터링 (invisible/trivial 제거, max 200개)
  → 플랫 오브젝트 배열 생성 (id, tag, x, y, w, h, styles)
                                              │
[Phase 3: Canvas Render]                      ▼
플랫 오브젝트 배열 → Canvas 렌더링 (색상 사각형 + 태그 라벨)
                   → 드래그/리사이즈 핸들러 바인딩
                                              │
[Phase 4: Edit]                               ▼
사용자 드래그 → 오브젝트 좌표 업데이트 → Canvas 리렌더
AI 자연어 → 오브젝트 식별 + 좌표 변환 → Canvas 리렌더
                                              │
[Phase 5: Export]                             ▼
편집된 오브젝트 배열 → AI에 전달 → 레이아웃 전략 자동 판단
  → absolute(기본) / flex / grid 선택 → HTML 구조 재구성 → 코드 출력
```

### 5.3 Tech Stack

| Layer | Technology | 선택 이유 |
|-------|-----------|----------|
| Frontend Framework | Next.js 14 (App Router) | React 기반, SSR/API Routes 통합 |
| Canvas Engine | Konva.js (react-konva) | 2D Canvas 라이브러리, 드래그/리사이즈 내장 |
| State Management | Zustand | 경량, Canvas 상태 관리에 적합 |
| Styling | Tailwind CSS | 빠른 UI 구성, 해커톤에 적합 |
| AI Provider | Claude API (Anthropic) | Tool use 지원, 구조화된 응답 |
| DOM Scanning | Puppeteer | Headless Chrome으로 실제 렌더링 후 BoundingRect/ComputedStyle 추출 |
| Backend | Next.js API Routes | 별도 서버 불필요 |
| Package Manager | pnpm | 빠른 설치 |

### 5.4 API Specification

#### `POST /api/scan`

**Description**: Puppeteer headless browser로 대상 URL을 렌더링하고, DOM 요소의 BoundingRect/ComputedStyle을 추출하여 플랫 오브젝트 배열로 반환

**Authentication**: None (로컬 전용)

**URL Validation (SSRF 방어)**:
- 허용 호스트: `localhost`, `127.0.0.1`, `0.0.0.0` 만 허용
- 허용 프로토콜: `http://`, `https://` 만 허용
- 차단: 사설 IP, 메타데이터 서비스 IP, file/ftp 프로토콜

**Request Body**:
```json
{
  "url": "string (required) - 스캔할 개발서버 URL (localhost만 허용)",
  "options": {
    "depth": "number (optional) - 최대 탐색 깊이, default: 3",
    "selector": "string (optional) - 특정 영역만 스캔, default: 'body'",
    "includeHidden": "boolean (optional) - 숨겨진 요소 포함, default: false",
    "maxElements": "number (optional) - 최대 요소 수, default: 200",
    "minSize": "number (optional) - 최소 면적 px (width*height), default: 100"
  }
}
```

**Request Example**:
```json
{
  "url": "http://localhost:3000",
  "options": {
    "selector": "body",
    "depth": -1
  }
}
```

**Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "pageTitle": "string - 페이지 제목",
    "viewport": {
      "width": "number",
      "height": "number"
    },
    "elements": [
      {
        "id": "string - 고유 식별자 (el_001)",
        "tag": "string - HTML 태그명",
        "originalId": "string | null - 원본 id 속성",
        "className": "string - 원본 class 속성",
        "textContent": "string - 텍스트 내용 (truncated)",
        "rect": {
          "x": "number - 절대 X 좌표",
          "y": "number - 절대 Y 좌표",
          "width": "number - 너비",
          "height": "number - 높이"
        },
        "computedStyles": {
          "backgroundColor": "string",
          "color": "string",
          "fontSize": "string",
          "fontWeight": "string",
          "borderRadius": "string",
          "border": "string",
          "padding": "string",
          "display": "string",
          "opacity": "string"
        },
        "depth": "number - 원본 DOM 트리에서의 깊이",
        "parentId": "string | null - 부모 요소 ID",
        "children": "string[] - 자식 요소 ID 배열"
      }
    ],
    "totalElements": "number"
  }
}
```

**Error Responses**:

| Status | Code | Message | Description |
|--------|------|---------|-------------|
| 400 | INVALID_URL | Invalid URL format | URL 형식 오류 |
| 403 | URL_NOT_ALLOWED | Only localhost URLs are allowed | localhost 외 URL 차단 (SSRF 방어) |
| 502 | FETCH_FAILED | Failed to fetch target URL | 대상 서버 접근 실패 |
| 408 | SCAN_TIMEOUT | DOM scan timed out | 스캔 타임아웃 (10초) |
| 500 | PARSE_ERROR | Failed to parse DOM | DOM 파싱 실패 |

---

#### `POST /api/ai/command`

**Description**: 자연어 명령을 Canvas 조작 명령으로 변환

**Request Body**:
```json
{
  "command": "string (required) - 자연어 명령",
  "canvasState": {
    "elements": "Element[] (required) - 현재 Canvas 오브젝트 배열",
    "viewport": "object (required) - Canvas 뷰포트 정보"
  },
  "history": "Message[] (optional) - 이전 대화 히스토리"
}
```

**Request Example**:
```json
{
  "command": "헤더를 상단에 고정하고 너비를 100%로 맞춰줘",
  "canvasState": {
    "elements": [
      {
        "id": "el_001",
        "tag": "header",
        "rect": { "x": 0, "y": 50, "width": 800, "height": 60 }
      }
    ],
    "viewport": { "width": 1200, "height": 800 }
  }
}
```

**Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "actions": [
      {
        "type": "move | resize | style | group | reorder",
        "targetId": "string - 대상 오브젝트 ID",
        "params": {
          "x": "number (optional)",
          "y": "number (optional)",
          "width": "number (optional)",
          "height": "number (optional)",
          "styles": "object (optional)"
        }
      }
    ],
    "explanation": "string - AI의 변경 설명",
    "suggestion": "string | null - 추가 개선 제안"
  }
}
```

**Error Responses**:

| Status | Code | Message | Description |
|--------|------|---------|-------------|
| 400 | INVALID_COMMAND | Cannot understand command | 명령 해석 불가 |
| 400 | NO_CANVAS_STATE | Canvas state is required | Canvas 상태 누락 |
| 422 | ELEMENT_NOT_FOUND | Referenced element not found | 언급된 요소를 찾을 수 없음 |
| 429 | RATE_LIMITED | Too many requests | AI API 호출 제한 |
| 502 | AI_ERROR | AI service unavailable | AI 서비스 오류 |

---

#### `POST /api/ai/suggest`

**Description**: 현재 레이아웃 분석 후 개선안 제안

**Request Body**:
```json
{
  "canvasState": {
    "elements": "Element[] (required) - 현재 Canvas 오브젝트 배열",
    "viewport": "object (required)"
  },
  "context": "string (optional) - 추가 컨텍스트 (예: '모바일 반응형', 'e-commerce')"
}
```

**Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "id": "string - 제안 ID",
        "title": "string - 제안 제목",
        "description": "string - 상세 설명",
        "preview": {
          "actions": "Action[] - 적용 시 실행될 액션 목록"
        },
        "confidence": "number - 신뢰도 (0-1)"
      }
    ]
  }
}
```

**Error Responses**:

| Status | Code | Message | Description |
|--------|------|---------|-------------|
| 400 | NO_CANVAS_STATE | Canvas state is required | Canvas 상태 누락 |
| 429 | RATE_LIMITED | Too many requests | AI API 호출 제한 |
| 502 | AI_ERROR | AI service unavailable | AI 서비스 오류 |

---

#### `POST /api/generate`

**Description**: Canvas 상태를 HTML/CSS 코드로 변환

**Code Generation Strategy**:
- `absolute`: 모든 요소를 `position: absolute` + pixel 좌표로 출력 (기본, 가장 정확)
- `auto`: Canvas 상태를 Claude AI에 전달하여 요소 간 관계를 분석, 적절한 flex/grid/absolute를 AI가 판단하여 시맨틱한 HTML/CSS 생성
- `flex` / `grid`: 강제로 해당 레이아웃 전략 적용

**Request Body**:
```json
{
  "canvasState": {
    "elements": "Element[] (required) - 현재 Canvas 오브젝트 배열",
    "viewport": "object (required)"
  },
  "options": {
    "cssMode": "string (optional) - 'inline' | 'class' | 'tailwind', default: 'class'",
    "layoutStrategy": "string (optional) - 'flex' | 'grid' | 'absolute' | 'auto', default: 'auto'",
    "framework": "string (optional) - 'html' | 'react' | 'vue', default: 'html'"
  }
}
```

**Request Example**:
```json
{
  "canvasState": {
    "elements": [
      {
        "id": "el_001",
        "tag": "header",
        "rect": { "x": 0, "y": 0, "width": 1200, "height": 60 },
        "children": ["el_002", "el_003"]
      }
    ],
    "viewport": { "width": 1200, "height": 800 }
  },
  "options": {
    "cssMode": "tailwind",
    "layoutStrategy": "auto",
    "framework": "react"
  }
}
```

**Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "html": "string - 생성된 HTML 코드",
    "css": "string - 생성된 CSS 코드 (tailwind 모드가 아닌 경우)",
    "preview": "string - 렌더링 가능한 전체 HTML",
    "metadata": {
      "elementsProcessed": "number",
      "layoutStrategy": "string - 실제 사용된 전략",
      "warnings": "string[] - 변환 시 주의사항"
    }
  }
}
```

**Error Responses**:

| Status | Code | Message | Description |
|--------|------|---------|-------------|
| 400 | EMPTY_CANVAS | No elements to generate | Canvas가 비어있음 |
| 422 | GENERATION_FAILED | Code generation failed | 코드 생성 실패 |
| 500 | INTERNAL_ERROR | Internal server error | 서버 오류 |

### 5.5 Database Schema

별도 DB 없음. 클라이언트 상태 관리:

```typescript
// Canvas State (Zustand Store)
interface CanvasStore {
  // 스캔된 원본 데이터
  originalElements: DOMElement[];

  // Canvas 편집 상태
  elements: CanvasElement[];
  selectedId: string | null;
  viewport: { width: number; height: number };

  // 히스토리 (Undo/Redo)
  history: CanvasElement[][];
  historyIndex: number;

  // AI 채팅
  messages: ChatMessage[];
}

interface CanvasElement {
  id: string;
  tag: string;
  originalId: string | null;
  className: string;
  textContent: string;
  rect: { x: number; y: number; width: number; height: number };
  computedStyles: Record<string, string>;
  depth: number;
  parentId: string | null;
  children: string[];
  isLocked: boolean;
  isVisible: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: Action[];
  timestamp: number;
}
```

저장: `localStorage` 키 기반

| Key | 내용 |
|-----|------|
| `wigdom:canvas-state` | 현재 Canvas 상태 JSON |
| `wigdom:chat-history` | AI 대화 히스토리 |
| `wigdom:recent-urls` | 최근 스캔 URL 목록 |

### 5.6 Architecture Diagram - UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─ Toolbar ──────────────────────────────────────────────────┐ │
│  │ [URL Input........] [Scan] │ [Undo][Redo] │ [Export Code] │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ Element Panel ─┐  ┌─ Canvas Area ──────────────────────┐   │
│  │                  │  │                                     │   │
│  │  ▼ header        │  │   ┌────────────────────────────┐   │   │
│  │    ▼ nav         │  │   │  header                     │   │   │
│  │      a.logo      │  │   └────────────────────────────┘   │   │
│  │      ul.menu     │  │                                     │   │
│  │  ▼ main          │  │   ┌──────┐  ┌──────┐  ┌──────┐   │   │
│  │    ▼ section     │  │   │ card │  │ card │  │ card │   │   │
│  │      div.card    │  │   │  1   │  │  2   │  │  3   │   │   │
│  │      div.card    │  │   └──────┘  └──────┘  └──────┘   │   │
│  │      div.card    │  │                                     │   │
│  │  ▼ footer        │  │   ┌────────────────────────────┐   │   │
│  │                  │  │   │  footer                     │   │   │
│  │                  │  │   └────────────────────────────┘   │   │
│  │                  │  │                                     │   │
│  └──────────────────┘  └─────────────────────────────────────┘   │
│                                                                  │
│  ┌─ AI Chat Panel ──────────────────────────────────────────┐   │
│  │  🤖 레이아웃을 분석했습니다. 카드를 grid로 배치하면        │   │
│  │     더 깔끔할 것 같아요. 적용할까요?                       │   │
│  │                                                           │   │
│  │  [카드 3개를 세로로 쌓아줘________________] [Send]         │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## 6. AI Agent Design

### 6.1 핵심 차별점: AI 에이전트 자율 실행 루프

이 도구의 AI는 단순한 명령-응답 도구가 아니라, **자율적으로 관찰→계획→실행→검증을 반복하는 에이전트**다.

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Agent Loop (Agentic)                       │
│                                                                  │
│   사용자: "이 페이지를 모바일 반응형으로 바꿔줘"                    │
│                        │                                         │
│                        ▼                                         │
│              ┌──────────────────┐                                │
│              │   1. OBSERVE     │  Canvas 상태 전체 분석          │
│              │   (관찰)         │  요소 크기/위치/관계 파악       │
│              └────────┬─────────┘                                │
│                       │                                          │
│                       ▼                                          │
│              ┌──────────────────┐                                │
│              │   2. PLAN        │  Step 1: 헤더 너비 축소         │
│              │   (계획)         │  Step 2: 사이드바 하단 이동     │
│              │                  │  Step 3: 카드 1열 정렬          │
│              │                  │  Step 4: 폰트/여백 조정         │
│              └────────┬─────────┘                                │
│                       │                                          │
│                       ▼                                          │
│              ┌──────────────────┐                                │
│              │   3. EXECUTE     │  Tool 호출로 Canvas 조작       │
│              │   (실행)         │  move → resize → align → style │
│              └────────┬─────────┘                                │
│                       │                                          │
│                       ▼                                          │
│              ┌──────────────────┐                                │
│              │   4. VERIFY      │  결과 검증                     │
│              │   (검증)         │  "카드 간격 너무 좁다"          │
│              │                  │  → 자동 조정 후 재검증          │
│              └────────┬─────────┘                                │
│                       │                                          │
│                  ┌────┴────┐                                     │
│                  │ 만족?   │                                     │
│                  ├─ NO ────┘→ OBSERVE로 돌아감 (자동 반복)       │
│                  │                                               │
│                  └─ YES ──→ 사용자에게 결과 보고 + 코드 생성     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**일반 AI 도구 vs 이 에이전트의 차이:**

| | 일반 AI 도구 | DOM Canvas AI Agent |
|--|-------------|---------------------|
| 실행 구조 | 명령 1개 → 응답 1개 → 끝 | 목표 1개 → 자율적 멀티 스텝 실행 |
| 판단 주체 | 사용자가 매 단계 지시 | 에이전트가 스스로 다음 스텝 판단 |
| 오류 처리 | 사용자가 결과 보고 재지시 | 에이전트가 자체 검증 후 자동 수정 |
| 복잡한 작업 | 불가 (단일 액션만) | 가능 (계획 수립 후 순차 실행) |

### 6.2 Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI Agent (Claude)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  System Prompt:                                                  │
│  - DOM/CSS 레이아웃 전문가 역할                                   │
│  - Canvas 좌표 시스템 이해                                        │
│  - Agentic Loop: 반드시 OBSERVE→PLAN→EXECUTE→VERIFY 순서 수행    │
│  - 각 Step 실행 후 검증, 불만족 시 자동 재조정                    │
│  - 사용자에게 진행 상황을 단계별로 스트리밍 보고                   │
│                                                                  │
│  Tools (Canvas 조작):                                            │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ observe_canvas()              → 현재 상태 스냅샷 반환    │     │
│  │ create_plan(goal, steps[])    → 실행 계획 수립/표시      │     │
│  │ move_element(id, x, y)       → 요소 이동               │     │
│  │ resize_element(id, w, h)     → 요소 크기 변경           │     │
│  │ align_elements(ids[], dir)   → 다중 요소 정렬           │     │
│  │ distribute_elements(ids[])   → 균등 분배               │     │
│  │ apply_style(id, styles)      → 스타일 적용             │     │
│  │ group_elements(ids[])        → 그룹 묶기               │     │
│  │ verify_layout(criteria)      → 결과 검증 (겹침/간격)    │     │
│  │ generate_code(options)       → 최종 코드 생성           │     │
│  │ report_progress(step, status)→ 사용자에게 진행 보고     │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Automation Scenarios (에이전트 자동화 시나리오)

에이전트가 자율적으로 멀티 스텝 실행하는 핵심 시나리오들:

#### Scenario 1: 반응형 변환
```
사용자: "이 데스크톱 레이아웃을 모바일(375px)용으로 변환해줘"

에이전트 자율 실행:
  [OBSERVE] 현재 뷰포트 1200px, 3열 그리드, 사이드바 존재
  [PLAN]    5단계 계획 수립
    Step 1: 뷰포트 375px 기준으로 요소 크기 재계산
    Step 2: 3열 → 1열 스택 레이아웃 변환
    Step 3: 사이드바를 메인 콘텐츠 아래로 이동
    Step 4: 네비게이션을 햄버거 메뉴 크기로 축소
    Step 5: 폰트 크기/여백 모바일 비율로 조정
  [EXECUTE] Step 1~5 순차 실행 (각 Step마다 Canvas에 실시간 반영)
  [VERIFY]  요소 겹침 검사 → "카드2와 카드3 겹침 발견"
  [EXECUTE] 자동 간격 조정
  [VERIFY]  재검증 통과
  [REPORT]  "모바일 변환 완료. 5개 요소 재배치, 1건 자동 수정"
```

#### Scenario 2: 레이아웃 자동 정리
```
사용자: "이 페이지 레이아웃 좀 정리해줘"

에이전트 자율 실행:
  [OBSERVE] 요소 간 간격 불균일, 정렬 안 맞음, 2개 요소 겹침
  [PLAN]    4단계 계획
    Step 1: 겹치는 요소 분리
    Step 2: 같은 행에 있는 요소들 수평 정렬
    Step 3: 간격 균일화 (8px 그리드 기준)
    Step 4: 전체 중앙 정렬 검증
  [EXECUTE] Step 1~4 실행
  [VERIFY]  모든 요소 정렬/간격 검증 통과
  [REPORT]  "레이아웃 정리 완료. 겹침 1건 해소, 정렬 3건 수정, 간격 5건 균일화"
```

#### Scenario 3: 디자인 시스템 자동 적용
```
사용자: "Tailwind 기준으로 정리해줘"

에이전트 자율 실행:
  [OBSERVE] 커스텀 px 값들, 비표준 색상, 임의 간격
  [PLAN]    3단계 계획
    Step 1: px 값 → 가장 가까운 Tailwind spacing으로 스냅 (4/8/12/16...)
    Step 2: 색상 → Tailwind 팔레트 매칭
    Step 3: 폰트 크기 → Tailwind text-sm/base/lg 매핑
  [EXECUTE] 모든 요소에 Tailwind 호환 값 적용
  [VERIFY]  시각적 차이 최소화 확인
  [REPORT]  "Tailwind 매핑 완료. 12개 속성 변환, 원본 대비 시각 차이 < 5%"
```

#### Scenario 4: 접근성 자동 개선
```
사용자: "접근성 문제 있으면 고쳐줘"

에이전트 자율 실행:
  [OBSERVE] 요소별 분석: 색상 대비, 클릭 영역 크기, 레이블 유무
  [PLAN]    발견된 문제 기반 계획
    Issue 1: 버튼 클릭 영역 32x28px → 최소 44x44px 필요
    Issue 2: 텍스트 색상 대비 3.2:1 → 최소 4.5:1 필요
    Issue 3: 요소 간 간격 4px → 최소 8px 필요 (터치 타겟)
  [EXECUTE] 각 이슈 순차 수정
  [VERIFY]  WCAG 2.1 AA 기준 재검증
  [REPORT]  "접근성 3건 수정. 대비 비율 4.5:1 이상, 터치 타겟 44px 이상 확보"
```

### 6.4 Agent Interaction Modes

| Mode | Trigger | 동작 | 에이전트 수준 |
|------|---------|------|-------------|
| **Auto** | "~해줘", "~으로 바꿔줘" | 에이전트 루프 자율 실행 (멀티 스텝) | **Agentic** |
| **Guided** | "~하는 방법 알려줘" | 계획만 제시, 사용자 승인 후 실행 | Semi-Agentic |
| **Command** | "이거 오른쪽으로 옮겨" | 단일 액션 즉시 실행 | Tool 수준 |
| **Watch** | 사용자 드래그 중 | 실시간 가이드/스냅 제안 (비침습적) | Passive |

### 6.5 Agent Execution UI (실행 과정 시각화)

에이전트의 멀티 스텝 실행을 사용자가 실시간으로 관찰할 수 있는 UI:

```
┌─ AI Agent Panel ────────────────────────────────────────────┐
│                                                              │
│  🎯 목표: "모바일 반응형으로 변환"                             │
│                                                              │
│  ┌─ 실행 계획 ────────────────────────────────────────────┐  │
│  │  ✅ Step 1: 뷰포트 분석 (1200px → 375px)               │  │
│  │  ✅ Step 2: 3열 → 1열 스택 변환                         │  │
│  │  🔄 Step 3: 사이드바 하단 이동 중...                    │  │
│  │  ⏳ Step 4: 네비게이션 축소                              │  │
│  │  ⏳ Step 5: 폰트/여백 조정                              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  📊 진행률: ████████░░░░░░ 3/5 (60%)                         │
│                                                              │
│  💬 에이전트: "사이드바(el_012)를 메인 콘텐츠 아래로           │
│     이동하고 있습니다. 너비를 375px에 맞춰 조정 중..."        │
│                                                              │
│  [⏸ 일시정지]  [⏭ 이 단계 건너뛰기]  [⏹ 중단]              │
│                                                              │
│  ┌─ 변경 로그 ────────────────────────────────────────────┐  │
│  │  12:01:03  move_element(el_005, 0, 320)                │  │
│  │  12:01:03  resize_element(el_005, 375, auto)           │  │
│  │  12:01:04  move_element(el_012, 0, 580)    ← 현재     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**사용자 제어:**
- **일시정지**: 에이전트 루프를 멈추고 중간 결과 확인
- **건너뛰기**: 현재 Step을 건너뛰고 다음으로
- **중단**: 에이전트 실행 중단, 현재까지 변경사항 유지
- **되돌리기**: 에이전트 실행 전 상태로 전체 Undo (1-click)

### 6.6 Agent Loop API

#### `POST /api/ai/agent`

**Description**: 에이전트 자율 실행 루프 시작. 스트리밍으로 각 Step의 진행 상황을 실시간 전달.

**Request Body**:
```json
{
  "goal": "string (required) - 에이전트에게 부여할 목표",
  "canvasState": {
    "elements": "Element[] (required)",
    "viewport": "object (required)"
  },
  "mode": "string (optional) - 'auto' | 'guided', default: 'auto'",
  "maxSteps": "number (optional) - 최대 실행 스텝 수, default: 20",
  "history": "Message[] (optional) - 이전 대화 컨텍스트"
}
```

**Response (Server-Sent Events 스트리밍)**:
```
event: plan
data: {"steps": [{"id": 1, "description": "뷰포트 분석"}, ...], "totalSteps": 5}

event: step_start
data: {"stepId": 1, "description": "뷰포트 분석 중..."}

event: action
data: {"type": "move_element", "targetId": "el_005", "params": {"x": 0, "y": 320}}

event: step_complete
data: {"stepId": 1, "status": "success"}

event: verify
data: {"passed": false, "issues": [{"type": "overlap", "elements": ["el_007", "el_008"]}]}

event: auto_fix
data: {"description": "겹침 자동 수정", "action": {"type": "move_element", ...}}

event: verify
data: {"passed": true}

event: complete
data: {"summary": "5단계 실행 완료, 자동 수정 1건", "totalActions": 12}
```

**Error Responses**:

| Status | Code | Message | Description |
|--------|------|---------|-------------|
| 400 | INVALID_GOAL | Cannot understand goal | 목표 해석 불가 |
| 400 | NO_CANVAS_STATE | Canvas state is required | Canvas 상태 누락 |
| 429 | RATE_LIMITED | Too many requests | AI API 호출 제한 |
| 502 | AI_ERROR | AI service unavailable | AI 서비스 오류 |

#### `POST /api/ai/agent/control`

**Description**: 실행 중인 에이전트 제어 (일시정지/재개/중단)

**Request Body**:
```json
{
  "sessionId": "string (required) - 에이전트 세션 ID",
  "action": "string (required) - 'pause' | 'resume' | 'skip' | 'stop'"
}
```

### 6.7 Agent Tool Definitions

```typescript
// AI Agent가 사용하는 Tool 정의 (Agentic Loop 지원)
const agentTools = [
  // === Agent Loop Control Tools ===
  {
    name: "observe_canvas",
    description: "현재 Canvas 상태를 분석하여 요소 관계, 정렬 상태, 겹침, 간격 등을 파악",
    input_schema: {
      type: "object",
      properties: {
        focus: { type: "string", description: "분석 초점 (예: 'alignment', 'spacing', 'overlap', 'all')" }
      }
    }
  },
  {
    name: "create_plan",
    description: "목표 달성을 위한 실행 계획 수립. 사용자에게 계획을 표시하고 실행 시작",
    input_schema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "달성 목표" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              targetElements: { type: "array", items: { type: "string" } }
            }
          }
        }
      },
      required: ["goal", "steps"]
    }
  },
  {
    name: "verify_layout",
    description: "현재 Canvas 레이아웃의 품질을 검증 (겹침, 간격, 정렬, 접근성 등)",
    input_schema: {
      type: "object",
      properties: {
        criteria: {
          type: "array",
          items: { type: "string", enum: ["overlap", "spacing", "alignment", "accessibility", "responsive"] },
          description: "검증할 기준 목록"
        }
      },
      required: ["criteria"]
    }
  },
  {
    name: "report_progress",
    description: "사용자에게 현재 진행 상황 보고",
    input_schema: {
      type: "object",
      properties: {
        stepId: { type: "number" },
        status: { type: "string", enum: ["start", "progress", "complete", "failed", "auto_fix"] },
        message: { type: "string" }
      },
      required: ["status", "message"]
    }
  },

  // === Canvas Manipulation Tools ===
  {
    name: "move_element",
    description: "Canvas에서 요소를 지정된 좌표로 이동",
    input_schema: {
      type: "object",
      properties: {
        elementId: { type: "string", description: "이동할 요소 ID" },
        x: { type: "number", description: "새 X 좌표" },
        y: { type: "number", description: "새 Y 좌표" }
      },
      required: ["elementId", "x", "y"]
    }
  },
  {
    name: "resize_element",
    description: "요소의 크기를 변경",
    input_schema: {
      type: "object",
      properties: {
        elementId: { type: "string" },
        width: { type: "number" },
        height: { type: "number" }
      },
      required: ["elementId"]
    }
  },
  {
    name: "align_elements",
    description: "여러 요소를 정렬 (left, center, right, top, middle, bottom)",
    input_schema: {
      type: "object",
      properties: {
        elementIds: { type: "array", items: { type: "string" } },
        direction: { type: "string", enum: ["left", "center", "right", "top", "middle", "bottom"] }
      },
      required: ["elementIds", "direction"]
    }
  },
  {
    name: "distribute_elements",
    description: "요소들을 균등 분배",
    input_schema: {
      type: "object",
      properties: {
        elementIds: { type: "array", items: { type: "string" } },
        axis: { type: "string", enum: ["horizontal", "vertical"] },
        spacing: { type: "number", description: "요소 간 간격 (px)" }
      },
      required: ["elementIds", "axis"]
    }
  },
  {
    name: "apply_style",
    description: "요소에 스타일을 적용",
    input_schema: {
      type: "object",
      properties: {
        elementId: { type: "string", description: "대상 요소 ID" },
        styles: { type: "object", description: "적용할 CSS 스타일 (key-value)" }
      },
      required: ["elementId", "styles"]
    }
  },
  {
    name: "group_elements",
    description: "여러 요소를 그룹으로 묶기 (함께 이동/정렬)",
    input_schema: {
      type: "object",
      properties: {
        elementIds: { type: "array", items: { type: "string" }, description: "그룹에 포함할 요소 ID 배열" }
      },
      required: ["elementIds"]
    }
  },
  {
    name: "generate_code",
    description: "현재 Canvas 상태를 HTML/CSS 코드로 변환",
    input_schema: {
      type: "object",
      properties: {
        elementIds: { type: "array", items: { type: "string" } },
        cssMode: { type: "string", enum: ["inline", "class", "tailwind"] },
        framework: { type: "string", enum: ["html", "react", "vue"] }
      },
      required: ["elementIds"]
    }
  }
];
```

## 7. Implementation Phases

### Phase 1: MVP Core (Day 1 - 핵심)
- [ ] Next.js 프로젝트 초기 설정 (pnpm, TypeScript, Tailwind)
- [ ] DOM 스캔 API (`/api/scan`) - Puppeteer headless → getBoundingClientRect + getComputedStyle
- [ ] URL 유효성 검사 (localhost 허용 목록, SSRF 방어)
- [ ] 요소 스마트 필터링 (invisible/trivial 제거, max 200개)
- [ ] DOM → 플랫 오브젝트 변환 로직
- [ ] Canvas 렌더링 (react-konva) - 색상 사각형 + 태그 라벨
- [ ] 드래그 이동 기능
- [ ] 기본 UI 레이아웃 (Toolbar + Canvas + Element Panel)
**Deliverable**: URL 입력 → DOM 시각화 → 드래그 편집 가능한 프로토타입

### Phase 2: AI Agent Loop (Day 1-2 - 핵심 차별화)
- [ ] Claude API 연동 (tool_use 활성화, SSE 스트리밍)
- [ ] Agent Loop 구현: OBSERVE→PLAN→EXECUTE→VERIFY 자율 반복
- [ ] Agent Tool 정의 (observe_canvas, create_plan, verify_layout, report_progress + Canvas 조작 도구)
- [ ] `/api/ai/agent` 엔드포인트 (SSE 스트리밍 응답)
- [ ] `/api/ai/agent/control` 엔드포인트 (일시정지/중단)
- [ ] Agent 실행 과정 시각화 UI (계획 표시, Step 진행률, 변경 로그)
- [ ] 자동화 시나리오 구현: 반응형 변환, 레이아웃 정리
- [ ] AI Chat Panel UI (목표 입력 + 실행 제어)
**Deliverable**: 자연어 목표 → 에이전트가 멀티 스텝 자율 실행 → 결과 보고

### Phase 3: Code Generation & Export (Day 2)
- [ ] Canvas → HTML/CSS 역변환: 기본 모드(position: absolute) 구현
- [ ] Auto 모드: Canvas 상태를 Claude AI에 전달하여 flex/grid 레이아웃 자동 생성
- [ ] `/api/generate` 엔드포인트 구현
- [ ] 코드 미리보기 패널
- [ ] 클립보드 복사 / 파일 다운로드
**Deliverable**: 편집 결과를 코드로 export 가능

### Phase 4: Polish & Demo (Day 2)
- [ ] Undo/Redo 구현
- [ ] 스냅/그리드 가이드
- [ ] 오브젝트 선택 시 정보 패널
- [ ] 에러 핸들링 및 로딩 상태
- [ ] 데모 시나리오 준비
**Deliverable**: 해커톤 데모용 완성된 프로토타입

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| DOM 스캔 성공률 | > 90% (일반 웹페이지) | 테스트 URL 10개 이상 |
| 드래그 편집 FPS | 60fps | Chrome DevTools Performance |
| AI 명령 정확도 | > 80% (기본 명령) | 테스트 명령 20개 기준 |
| 코드 생성 → 브라우저 렌더링 일치도 | > 70% | 시각적 비교 |
| 데모 완료 시간 | < 3분 | 전체 플로우 1회 |
| 해커톤 심사 점수 | 상위 30% | 심사 결과 |
