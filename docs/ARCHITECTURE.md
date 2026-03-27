# WIGSS Architecture

> **Version**: 1.1
> **Updated**: 2026-03-27 (CLI 진입점, demo-target, npx 배포 반영)
> **PRD Reference**: docs/prd/PRD_wigss.md (v4.0)

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                          WIGSS (Style Shaper)                           │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        Frontend (Browser)                         │  │
│  │                                                                   │  │
│  │  ┌─────────┐  ┌──────────────────────┐  ┌────────────────────┐  │  │
│  │  │ Toolbar  │  │    Visual Editor     │  │   Side Panels      │  │  │
│  │  │         │  │                      │  │                    │  │  │
│  │  │ URL     │  │  ┌────────────────┐  │  │ ┌────────────────┐│  │  │
│  │  │ Path    │  │  │  iframe        │  │  │ │ ComponentPanel ││  │  │
│  │  │ Scan    │  │  │  (live page)   │  │  │ │ - 컴포넌트 목록 ││  │  │
│  │  │ Save    │  │  │               │  │  │ │ - 소스 매핑     ││  │  │
│  │  │ Mobile  │  │  │  ┌──overlay──┐│  │  │ └────────────────┘│  │  │
│  │  │ Export  │  │  │  │drag/resize││  │  │ ┌────────────────┐│  │  │
│  │  │         │  │  │  └──────────┘│  │  │ │ AgentPanel     ││  │  │
│  │  │         │  │  └────────────────┘  │  │ │ - 에이전트 로그 ││  │  │
│  │  │         │  │                      │  │ │ - 제안 카드     ││  │  │
│  │  │         │  │                      │  │ │ - 검증 상태     ││  │  │
│  │  │         │  │                      │  │ └────────────────┘│  │  │
│  │  │         │  │                      │  │ ┌────────────────┐│  │  │
│  │  │         │  │                      │  │ │ DiffPreview    ││  │  │
│  │  │         │  │                      │  │ │ - before/after  ││  │  │
│  │  │         │  │                      │  │ │ - Apply/Cancel  ││  │  │
│  │  │         │  │                      │  │ └────────────────┘│  │  │
│  │  └─────────┘  └──────────────────────┘  └────────────────────┘  │  │
│  │                                                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                    Zustand Store                             │  │  │
│  │  │  editor-store: components, changes, selectedId, history     │  │  │
│  │  │  agent-store: status, logs, suggestions, verification       │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                    HTTP / SSE │                                          │
│                              ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                   Backend (Next.js API Routes)                     │  │
│  │                                                                   │  │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌───────┐ ┌────────┐     │  │
│  │  │  /scan  │ │ /detect │ │ /suggest │ │/respon│ │/refact │     │  │
│  │  │         │ │         │ │          │ │ sive  │ │  or    │     │  │
│  │  └────┬────┘ └────┬────┘ └────┬─────┘ └───┬───┘ └───┬────┘     │  │
│  │       │           │           │            │         │           │  │
│  │  ┌────┴────┐ ┌────┴──────────┴────────────┴─────────┴────┐     │  │
│  │  │Puppeteer│ │              Claude API                     │     │  │
│  │  │Headless │ │         (Tool Use + Reasoning)              │     │  │
│  │  └─────────┘ └────────────────────────────────────────────┘     │  │
│  │                                                                   │  │
│  │  ┌─────────┐ ┌──────────┐                                       │  │
│  │  │ /apply  │ │ /verify  │                                       │  │
│  │  └────┬────┘ └────┬─────┘                                       │  │
│  │       │           │                                              │  │
│  │  ┌────┴───────────┴────┐                                        │  │
│  │  │   File System (fs)  │ ← 프로젝트 소스코드 읽기/쓰기           │  │
│  │  └─────────────────────┘                                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow

전체 파이프라인을 단계별로 보여줍니다.

```
사용자                       Frontend                    Backend                   External
  │                            │                           │                          │
  │  1. URL + Path 입력        │                           │                          │
  │ ──────────────────────────>│                           │                          │
  │                            │  POST /api/scan           │                          │
  │                            │ ─────────────────────────>│                          │
  │                            │                           │  Puppeteer launch        │
  │                            │                           │ ────────────────────────>│
  │                            │                           │  DOM + screenshot        │ Chrome
  │                            │                           │ <────────────────────────│
  │                            │  { domTree, screenshot }  │                          │
  │                            │ <─────────────────────────│                          │
  │                            │                           │                          │
  │                            │  POST /api/detect         │                          │
  │                            │ ─────────────────────────>│                          │
  │                            │                           │  Tool Use call           │
  │                            │                           │ ────────────────────────>│
  │                            │                           │  { components[] }        │ Claude
  │                            │                           │ <────────────────────────│ API
  │                            │  { components, agentLog } │                          │
  │                            │ <─────────────────────────│                          │
  │                            │                           │                          │
  │  2. 컴포넌트 오버레이 표시  │                           │                          │
  │ <──────────────────────────│                           │                          │
  │                            │  POST /api/suggest        │                          │
  │                            │ ─────────────────────────>│ ────────────────────────>│
  │                            │  { suggestions[] }        │ <────────────────────────│
  │  3. 제안 카드 표시         │ <─────────────────────────│                          │
  │ <──────────────────────────│                           │                          │
  │                            │                           │                          │
  │  4. 드래그/리사이즈 편집    │                           │                          │
  │ ──────────────────────────>│  Zustand 상태 업데이트     │                          │
  │                            │  (changes delta 추적)     │                          │
  │                            │                           │                          │
  │  5. [모바일 보기] 클릭      │                           │                          │
  │ ──────────────────────────>│  POST /api/responsive     │                          │
  │                            │ ─────────────────────────>│ ────────────────────────>│
  │                            │  { mobileComponents[] }   │ <────────────────────────│
  │  6. 모바일 레이아웃 표시    │ <─────────────────────────│                          │
  │ <──────────────────────────│                           │                          │
  │                            │                           │                          │
  │  7. [저장] 클릭            │                           │                          │
  │ ──────────────────────────>│  POST /api/refactor       │                          │
  │                            │ ─────────────────────────>│ ────────────────────────>│
  │                            │  { diffs[] }              │ <────────────────────────│
  │  8. Diff 미리보기 표시      │ <─────────────────────────│                          │
  │ <──────────────────────────│                           │                          │
  │                            │                           │                          │
  │  9. [적용] 클릭            │                           │                          │
  │ ──────────────────────────>│  POST /api/apply          │                          │
  │                            │ ─────────────────────────>│  fs.writeFile            │
  │                            │  { appliedFiles[] }       │ ────> 소스 파일 수정      │
  │                            │ <─────────────────────────│                          │
  │                            │                           │                          │
  │                            │  POST /api/verify         │                          │
  │                            │ ─────────────────────────>│  Puppeteer 재렌더링       │
  │                            │                           │ ────────────────────────>│
  │                            │                           │  스크린샷 비교            │ Chrome
  │                            │                           │ <────────────────────────│
  │                            │                           │                          │
  │                            │                           │  불일치? ──YES──> Claude  │
  │                            │                           │    │              재수정   │
  │                            │                           │    │      <───── diff     │
  │                            │                           │    │      apply + 재검증   │
  │                            │                           │    │      (최대 3회 루프)  │
  │                            │                           │    NO                     │
  │                            │                           │    │                      │
  │  10. 검증 결과 표시         │  { passed, attempts[] }   │    ▼                      │
  │ <──────────────────────────│ <─────────────────────────│  완료                     │
  │                            │                           │                          │
```

---

## 3. API Design (상세)

### 3.1 API 전체 맵

```
/api
├── /scan              POST   DOM 스캔 + 스크린샷          [Puppeteer]
├── /detect            POST   컴포넌트 자동 인식            [Claude AI Agent #1]
├── /suggest           POST   디자인 개선 제안              [Claude AI Agent #2]
├── /responsive        POST   반응형 자동 변환              [Claude AI Agent #3]
├── /refactor          POST   소스코드 리팩토링             [Claude AI Agent #4]
├── /apply             POST   소스 파일 실제 수정           [Node.js fs]
└── /verify            POST   자기 검증 + 자동 재수정 루프   [Puppeteer + Claude AI Agent #5]
```

### 3.2 각 API 상세 설계

---

#### `POST /api/scan` — DOM 스캔

**역할**: Puppeteer로 실제 페이지를 렌더링하고, DOM 트리 + 스크린샷 + 소스 파일 목록을 추출

**의존성**: Puppeteer (Headless Chrome)

**AI Agent**: 없음 (순수 기술 작업)

```
Input                          Process                         Output
┌──────────────┐    ┌─────────────────────────┐    ┌──────────────────┐
│ url           │    │ 1. URL 유효성 검사       │    │ screenshot       │
│ projectPath   │───>│ 2. SSRF 방어 (localhost) │───>│ domTree[]        │
│ options       │    │ 3. Puppeteer 페이지 로드  │    │ sourceFiles[]    │
│  viewport     │    │ 4. screenshot 캡처       │    │ viewport         │
│  maxElements  │    │ 5. DOM 전체 순회         │    │ pageTitle        │
└──────────────┘    │ 6. getBoundingClientRect │    └──────────────────┘
                    │ 7. getComputedStyle      │
                    │ 8. 스마트 필터링 (≤200)   │
                    │ 9. 소스 파일 목록 수집     │
                    └─────────────────────────┘
```

**스마트 필터링 규칙**:
- `display:none`, `visibility:hidden` 제외
- `script`, `style`, `meta`, `link`, `head` 태그 제외
- 면적 < 100px (10x10) 제외
- 최대 200개 (depth 얕은 순 + z-index 높은 순 우선)

**데모 모드**: `NEXT_PUBLIC_DEMO_MODE=true` → Puppeteer 호출 없이 `data/demo-scan-result.json` 반환

**에러 코드**:

| Status | Code | 원인 |
|--------|------|------|
| 400 | INVALID_URL | URL 형식 오류 |
| 403 | URL_NOT_ALLOWED | localhost 외 URL (SSRF 차단) |
| 408 | SCAN_TIMEOUT | 10초 타임아웃 |
| 502 | FETCH_FAILED | 대상 서버 접근 실패 |

---

#### `POST /api/detect` — 컴포넌트 자동 인식

**역할**: AI가 DOM 트리를 분석하여 UI 컴포넌트 단위로 자동 분리

**의존성**: Claude API (Tool Use)

**AI Agent**: **#1 Component Detector**

```
Input                          Process                              Output
┌──────────────┐    ┌────────────────────────────────┐    ┌─────────────────────┐
│ domTree[]     │    │ Claude API (Tool Use)           │    │ components[]         │
│ screenshot    │───>│                                 │───>│   id, name, type     │
│ sourceFiles[] │    │ Tools:                          │    │   elementIds[]       │
└──────────────┘    │  identify_component()           │    │   boundingBox        │
                    │  analyze_layout_pattern()        │    │   sourceFile         │
                    │  map_to_source()                 │    │   reasoning          │
                    │                                  │    │   children[]         │
                    │ System Prompt:                   │    │ agentLog[]           │
                    │  시맨틱 태그 → 독립 컴포넌트      │    └─────────────────────┘
                    │  반복 패턴 → 그리드/리스트        │
                    │  flex/grid 컨테이너 → 레이아웃    │
                    │  배경/테두리/그림자 → 카드/패널    │
                    └────────────────────────────────┘
```

**Claude Tool 정의 (3개)**:

| Tool | 역할 | 입력 |
|------|------|------|
| `identify_component` | DOM 요소 그룹을 컴포넌트로 인식 | name, type, elementIds, sourceFile, reasoning |
| `analyze_layout_pattern` | 레이아웃 패턴 분석 (flex/grid/stack) | elementId, focus (children/siblings/parent) |
| `map_to_source` | className → 소스 파일 매핑 | className, sourceFiles |

**컴포넌트 타입**: `navbar`, `header`, `hero`, `grid`, `card`, `sidebar`, `footer`, `section`, `form`, `modal`

---

#### `POST /api/suggest` — 디자인 개선 제안

**역할**: AI가 현재 레이아웃을 능동적으로 분석하여 개선안 제시

**의존성**: Claude API

**AI Agent**: **#2 Design Advisor**

```
Input                          Process                              Output
┌──────────────┐    ┌────────────────────────────────┐    ┌─────────────────────┐
│ components[]  │    │ Claude API                      │    │ suggestions[]        │
│ viewport      │───>│                                 │───>│   id, type           │
└──────────────┘    │ 분석 항목:                       │    │   title, description │
                    │  1. 간격 균일성 (spacing)         │    │   affectedComponents │
                    │  2. 정렬 일관성 (alignment)       │    │   preview.changes[]  │
                    │  3. 크기 비율 (sizing)            │    │   confidence (0-1)   │
                    │  4. 시각적 계층 (hierarchy)       │    │ agentLog[]           │
                    │                                  │    └─────────────────────┘
                    │ 출력:                            │
                    │  제안별 confidence 점수           │
                    │  적용 시 변경될 컴포넌트 preview   │
                    └────────────────────────────────┘
```

**제안 타입**: `spacing`, `alignment`, `sizing`, `hierarchy`, `overlap`

**동작 방식**: 제안은 AgentPanel에 카드로 표시. 사용자가 [적용] 클릭 시 프론트엔드에서 컴포넌트 상태를 직접 업데이트 (API 재호출 없음).

---

#### `POST /api/responsive` — 반응형 자동 변환

**역할**: AI가 데스크톱 레이아웃을 모바일 뷰포트 기준으로 자동 재배치

**의존성**: Claude API

**AI Agent**: **#3 Responsive Converter**

```
Input                          Process                              Output
┌──────────────┐    ┌────────────────────────────────┐    ┌─────────────────────┐
│ components[]  │    │ Claude API                      │    │ mobileComponents[]   │
│ sourceViewport│───>│                                 │───>│   componentId        │
│ targetViewport│    │ 변환 전략:                       │    │   name               │
└──────────────┘    │  1. 다열 → 1열 스택              │    │   boundingBox (new)  │
                    │  2. 사이드바 → 하단 이동          │    │   reasoning          │
                    │  3. 요소 크기 비율 축소           │    │ agentLog[]           │
                    │  4. 터치 타겟 최소 44px 보장      │    └─────────────────────┘
                    │  5. 컴포넌트 간 최소 간격 유지     │
                    └────────────────────────────────┘
```

**동작 방식**: 반환된 `mobileComponents`로 프론트엔드 오버레이를 교체. 사용자가 추가 조정 후 저장 가능.

---

#### `POST /api/refactor` — 소스코드 리팩토링

**역할**: 시각적 변경을 기존 소스코드의 구체적 수정(diff)으로 변환

**의존성**: Claude API + Node.js fs (소스 파일 읽기)

**AI Agent**: **#4 Code Refactorer**

```
Input                              Process                           Output
┌────────────────────┐    ┌──────────────────────────────┐    ┌──────────────┐
│ originalComponents │    │ 1. 변경 delta 분석            │    │ diffs[]       │
│ modifiedComponents │───>│ 2. 소스 파일 읽기 (fs)        │───>│   file        │
│ projectPath        │    │ 3. Claude API:                │    │   original    │
│ changes[]          │    │    변경 → 코드 매핑            │    │   modified    │
│   componentId      │    │    Tailwind/CSS 클래스 변경    │    │   lineNumber  │
│   type (move/resize)│    │    연쇄 영향 분석             │    │   explanation │
│   from, to         │    │ 4. diff 생성                  │    │ agentLog[]    │
└────────────────────┘    └──────────────────────────────┘    └──────────────┘
```

**수정 전략 (CSS 프레임워크별)**:

| 프로젝트 타입 | 수정 방식 | 예시 |
|--------------|----------|------|
| Tailwind CSS | className 유틸리티 클래스 변경 | `h-16` → `h-12` |
| CSS Module | `.module.css` 속성 값 변경 | `height: 64px` → `height: 48px` |
| Inline Style | style 속성 값 변경 | `style={{height: 64}}` → `style={{height: 48}}` |

**연쇄 영향 분석**: Navbar 높이 변경 → 아래 콘텐츠의 margin-top도 자동 조정

---

#### `POST /api/apply` — 소스 파일 수정

**역할**: diff를 실제 파일에 적용

**의존성**: Node.js fs

**AI Agent**: 없음 (순수 파일 I/O)

```
Input                    Process                        Output
┌──────────────┐    ┌─────────────────────────┐    ┌──────────────────┐
│ diffs[]       │    │ 1. projectPath 경로 검증 │    │ appliedFiles[]    │
│ projectPath   │───>│ 2. 백업 생성 (.bak)     │───>│ backupCreated     │
└──────────────┘    │ 3. 각 파일 읽기          │    └──────────────────┘
                    │ 4. original → modified   │
                    │ 5. 파일 쓰기             │
                    └─────────────────────────┘
```

**보안**: `projectPath`에 `..` 포함 시 거부. 허용된 디렉토리 내부만 쓰기 가능.

---

#### `POST /api/verify` — 자기 검증 루프

**역할**: 리팩토링 결과를 재렌더링하여 편집 의도와 비교, 불일치 시 자동 재수정

**의존성**: Puppeteer + Claude API

**AI Agent**: **#5 Self-Verifier** (Puppeteer + Claude 조합)

```
Input                              Process                              Output
┌────────────────────┐    ┌────────────────────────────────────┐    ┌──────────────┐
│ projectPath        │    │                                    │    │ passed        │
│ url                │    │  ┌─────────────────────────┐       │    │ attempts[]    │
│ expectedLayout[]   │───>│  │ 1. Puppeteer 재렌더링    │       │───>│   screenshot  │
│ maxRetries: 3      │    │  │ 2. 스크린샷 + DOM 추출   │       │    │   mismatches  │
└────────────────────┘    │  │ 3. 컴포넌트별 비교       │       │    │   autoFix     │
                          │  │    expected vs actual    │       │    │ finalPassed   │
                          │  └────────────┬────────────┘       │    │ totalAttempts │
                          │               │                    │    │ agentLog[]    │
                          │          ┌────┴────┐               │    └──────────────┘
                          │          │ 일치?   │               │
                          │          ├─ YES ──>│ 통과          │
                          │          │         │               │
                          │          └─ NO     │               │
                          │            │       │               │
                          │            ▼       │               │
                          │  ┌─────────────┐   │               │
                          │  │ Claude API   │   │               │
                          │  │ 불일치 분석   │   │               │
                          │  │ diff 재생성   │   │               │
                          │  └──────┬──────┘   │               │
                          │         │          │               │
                          │         ▼          │               │
                          │  ┌─────────────┐   │               │
                          │  │ /api/apply   │   │               │
                          │  │ 재적용       │   │               │
                          │  └──────┬──────┘   │               │
                          │         │          │               │
                          │         └──> 재검증 (retry ≤ 3)    │
                          │                                    │
                          └────────────────────────────────────┘
```

**비교 기준**: 각 컴포넌트의 `boundingBox`를 expected vs actual로 비교. 허용 오차: 4px.

---

## 4. AI Agent 역할 분담

### 4.1 에이전트 전체 맵

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Claude API                                   │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐│
│  │ Agent #1 │  │ Agent #2 │  │ Agent #3 │  │ Agent #4 │  │Agent ││
│  │Component │  │ Design   │  │Responsive│  │  Code    │  │ #5   ││
│  │Detector  │  │ Advisor  │  │Converter │  │Refactorer│  │Verify││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──┬───┘│
│       │              │              │              │           │    │
│  detect API    suggest API    responsive API  refactor API  verify │
│                                                              API   │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 에이전트별 상세

| # | 에이전트 | API | 호출 시점 | 입력 | 판단 내용 | 특수 도구 |
|---|---------|-----|----------|------|----------|----------|
| **1** | Component Detector | `/api/detect` | 스캔 직후 자동 | DOM 트리 + 스타일 | "이건 Navbar, 이건 Card Grid" | `identify_component`, `analyze_layout_pattern`, `map_to_source` |
| **2** | Design Advisor | `/api/suggest` | detect 직후 자동 | 컴포넌트 배치 | "간격 불균일, 정렬 미스" | 없음 (추론만) |
| **3** | Responsive Converter | `/api/responsive` | 사용자 "모바일 보기" 클릭 | 데스크톱 레이아웃 | "다열→1열, 사이드바→하단" | 없음 (추론만) |
| **4** | Code Refactorer | `/api/refactor` | 사용자 "저장" 클릭 | 변경 delta + 소스코드 | "h-16→h-12, grid-cols-3 수정" | 없음 (소스 읽기는 서버) |
| **5** | Self-Verifier | `/api/verify` | apply 직후 자동 | 수정된 코드 + 편집 의도 | "Navbar 4px 불일치 → 재수정" | Puppeteer 재렌더링 (서버) |

### 4.3 에이전트 호출 타이밍

```
시간 ──────────────────────────────────────────────────────────────>

[스캔]──>[#1 Detect]──>[#2 Suggest]──>[사용자 편집]──>[#3 Responsive?]
                                            │
                                        [저장]
                                            │
                                      [#4 Refactor]──>[적용]──>[#5 Verify]
                                                                    │
                                                              불일치?──YES──>[#4]──>[적용]──>[#5]
                                                                    │                        (최대 3회)
                                                                   NO
                                                                    │
                                                                  완료
```

**자동 호출 (사용자 액션 없이)**:
- #1 → #2: 스캔 후 자동 연쇄
- #5: apply 후 자동 시작
- #5 → #4 → #5: 불일치 시 자동 루프

**사용자 트리거**:
- #3: "모바일 보기" 버튼 클릭
- #4: "저장" 버튼 클릭

### 4.4 에이전트별 System Prompt 핵심

| Agent | System Prompt 핵심 지시 |
|-------|----------------------|
| #1 | "시맨틱 태그 → 독립 컴포넌트. 반복 패턴 → 그리드. flex/grid → 레이아웃. 모든 판단에 reasoning 기록." |
| #2 | "간격/정렬/크기를 수치적으로 분석. 문제 발견 시 구체적 수정 값과 confidence 제시." |
| #3 | "다열→1열, 사이드바→하단 이동, 터치 타겟 44px, 비율 축소. 각 결정에 reasoning." |
| #4 | "Tailwind 클래스 변경 우선. 연쇄 영향 분석 필수. 파일별 line number 정확히." |
| #5 | "기대값과 실제값의 px 차이를 정량적으로 비교. 허용 오차 4px. 불일치 시 수정 방안 제시." |

---

## 5. 프론트엔드 컴포넌트 구조

```
page.tsx (메인)
├── Toolbar
│   ├── URLInput + ScanButton
│   ├── UndoRedoButtons
│   ├── MobileViewButton        → /api/responsive 호출
│   ├── SaveButton              → /api/refactor 호출
│   └── ExportButton
│
├── MainLayout (3-column)
│   ├── ComponentPanel (좌)
│   │   └── ComponentList       인식된 컴포넌트 목록
│   │       └── ComponentItem   클릭 → Canvas 선택 연동
│   │
│   ├── VisualEditor (중앙)
│   │   ├── iframe              실제 개발서버 페이지
│   │   └── OverlayLayer        투명 오버레이
│   │       └── ComponentOverlay[]  컴포넌트별 드래그/리사이즈
│   │           ├── SelectionBox    선택 하이라이트
│   │           └── ResizeHandles   8방향 리사이즈 핸들
│   │
│   └── RightPanel (우)
│       ├── AgentPanel
│       │   ├── AgentStatus     "컴포넌트 인식 중..."
│       │   ├── AgentLog        판단 로그 실시간
│       │   ├── SuggestionCards 개선 제안 [적용][무시]
│       │   └── VerifyStatus    검증 상태 + 재수정 이력
│       │
│       └── DiffPreview (조건부)
│           ├── DiffViewer      before/after 코드
│           ├── ApplyButton
│           └── CancelButton
│
└── StatusBar (하단)
    └── 선택된 컴포넌트 정보 (이름, 위치, 크기, 소스 파일)
```

---

## 6. Zustand Store 구조

```typescript
// editor-store.ts
interface EditorStore {
  // 스캔 결과
  scanResult: ScanResult | null;

  // 컴포넌트 (detect 결과)
  components: DetectedComponent[];
  selectedComponentId: string | null;

  // 변경 추적
  changes: ComponentChange[];

  // 뷰포트 모드
  viewportMode: 'desktop' | 'mobile';
  mobileComponents: DetectedComponent[] | null;  // responsive 결과

  // 리팩토링 결과
  diffs: CodeDiff[];

  // 히스토리
  history: ComponentChange[][];
  historyIndex: number;
}

// agent-store.ts
interface AgentStore {
  // 상태
  status: 'idle' | 'scanning' | 'detecting' | 'suggesting'
        | 'converting' | 'refactoring' | 'applying' | 'verifying';

  // 로그
  logs: AgentLogEntry[];

  // 제안
  suggestions: DesignSuggestion[];

  // 검증
  verification: VerificationResult | null;
}
```

---

## 7. 핵심 설계 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 시각적 편집기 | iframe + overlay | 실제 화면 그대로 표시하면서 편집 가능 |
| 상태 관리 | Zustand (2개 스토어) | 편집 상태와 에이전트 상태 분리 |
| AI 호출 방식 | 각 API별 독립 호출 | 에이전트 간 결합도 낮춤, fallback 용이 |
| 파일 수정 | diff 기반 (line-level) | 전체 파일 덮어쓰기보다 안전, 미리보기 가능 |
| 자기 검증 | Puppeteer 재렌더링 비교 | 시각적 결과를 정량적(px)으로 검증 |
| CSS 프레임워크 감지 | className 패턴 분석 | Tailwind(유틸리티), CSS Module(.module), inline 자동 판별 |
