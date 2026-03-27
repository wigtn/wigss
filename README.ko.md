<div align="center">

# WIGSS

### Style Shaper — AI 에이전트 기반 비주얼 코드 리팩토링

**컴포넌트를 드래그하세요. 코드가 따라갑니다.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Claude API](https://img.shields.io/badge/Claude_API-Tool_Use-D97757?style=for-the-badge&logo=anthropic&logoColor=white)](https://docs.anthropic.com/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-Headless-40B5A4?style=for-the-badge&logo=puppeteer&logoColor=white)](https://pptr.dev/)
[![Zustand](https://img.shields.io/badge/Zustand-State-433E38?style=for-the-badge&logo=react&logoColor=white)](https://zustand-demo.pmnd.rs/)

**한국어** | [English](README.md)

</div>

---

## 문제

AI 시대에 프론트엔드 개발자가 디자이너/퍼블리셔 없이 직접 화면을 만드는 경우가 늘고 있습니다. 코드로 대충 구성은 가능하지만, **보기 좋게 다듬는 건 여전히 고통**입니다:

- CSS 수정 &rarr; 새로고침 &rarr; 확인 &rarr; 다시 수정 &rarr; 무한 반복
- 컴포넌트 간 간격, 크기, 정렬을 코드로 조정하는 건 비효율적
- 컴포넌트를 직접 잡아서 옮기고, 코드가 자동으로 바뀌면 좋겠는데...

## 해결

WIGSS은 **실제 렌더링된 웹 페이지 위에서 컴포넌트를 직접 드래그/리사이즈**하고, **저장하면 기존 소스코드를 AI가 자동 리팩토링**합니다.

새 코드를 만드는 게 아닙니다. 기존 코드를 수정합니다.

---

## 작동 방식

```
  코드로 대충 구성       AI가 컴포넌트 인식      드래그로 꾸미기        코드 자동 수정
 ┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
 │  개발자가     │────>│  컴포넌트     │────>│  비주얼       │────>│  소스코드     │
 │  코드 작성    │     │  자동 분리     │     │  에디터       │     │  리팩토링     │
 └─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                       AI 에이전트 #1                            AI 에이전트 #4
                                           웹 꾸미기처럼
                                           직접 만지세요.
```

## 5가지 자율 AI 에이전트 행동

| # | 에이전트 행동 | 설명 | AI 모델 |
|---|-------------|------|---------|
| **1** | **컴포넌트 자동 인식** | DOM 구조를 분석하여 Navbar, Card Grid, Sidebar 등을 스스로 판단 | GPT-4o |
| **2** | **실시간 편집 피드백** | 드래그/리사이즈 후 즉시: "8px 어긋남", "카드 너무 작음" — 실시간 리뷰 | GPT-4o |
| **3** | **채팅 상담** | "푸터 어떻게 하지?" — 분석 + 제안. "알아서 해줘" — 확인 후 자동 수정 | GPT-4o |
| **4** | **소스코드 리팩토링** | 시각적 변경을 실제 소스 파일에 매핑하여 정확한 diff 생성 | Claude |
| **5** | **자기 검증 루프** | 리팩토링 후 재렌더링, 불일치 시 자동 재수정 (최대 3회) | Claude |

> 에이전트는 명령을 기다리지 않습니다. **스스로 관찰하고, 제안하고, 실행하고, 검증합니다.**

---

## 아키텍처

```
Browser (localhost:4000)
├── 플로팅 툴바
├── 비주얼 에디터 (iframe + 오버레이)
│   └── 드래그/리사이즈 오버레이 (실제 페이지는 안 움직임)
├── Agent Panel
│   ├── 실시간 피드백 [적용] [무시]
│   ├── 채팅 (의견 요청 / 위임 / 지시)
│   └── 에이전트 로그
│
│   WebSocket (항시 연결)
│   ▼
WIGSS Agent (Node.js, 이벤트 기반)
├── OpenAI GPT-4o — 관찰, 인식, 제안, 피드백, 채팅, 반응형
├── Claude API — 코드 리팩토링, 자기 검증
├── Puppeteer — DOM 스캔, 검증 재렌더링
├── chokidar — 파일 변경 감지
└── fs — 소스코드 읽기/쓰기
```

## 기술 스택

| 레이어 | 기술 | 역할 |
|--------|-----|------|
| **프레임워크** | Next.js 14 (App Router) | 풀스택, API Routes |
| **언어** | TypeScript | 타입 안전성 |
| **스타일** | Tailwind CSS | 빠른 UI 개발 |
| **비주얼 에디터** | iframe + 오버레이 div | 실제 화면 위 드래그 가능한 컴포넌트 |
| **드래그/리사이즈** | interact.js | 컴포넌트 조작 |
| **상태 관리** | Zustand | 컴포넌트 상태 + 변경 추적 |
| **AI** | Claude API (Tool Use) | 컴포넌트 인식 + 리팩토링 |
| **DOM 스캔** | Puppeteer | Headless Chrome 렌더링 |
| **파일 I/O** | Node.js fs | 소스코드 읽기/쓰기 |

## 통신

| 채널 | 설명 |
|------|------|
| `WebSocket /ws` | 항시 연결 에이전트 (스캔, 인식, 제안, 피드백, 채팅, 반응형, 리팩토링, 검증) |
| `POST /api/apply` | 소스 파일 수정 (REST — 사용자 확인 필수) |

---

## 시작하기

### 사전 요구

- Node.js 18+
- pnpm
- 스캔할 개발 서버 (예: `localhost:3000`)

### 설치

```bash
git clone https://github.com/your-username/wigss.git
cd wigss
pnpm install
```

### 환경 설정

```bash
cp .env.example .env.local
# Anthropic API 키 추가
# ANTHROPIC_API_KEY=sk-ant-...
```

### 실행

**개발 모드:**
```bash
pnpm dev
```
WIGSS 에디터(`localhost:3000`)와 demo-target(`localhost:3001`)이 실행됩니다.

**프로덕션 사용 (npm publish 후):**
```bash
cd your-project
npx wigss --port 3000
```

---

## 데모 시나리오 (3분)

```
0:00  문제 소개
0:15  스캔 → AI가 컴포넌트 자동 인식                ← 에이전트 #1
0:40  AI가 "카드 간격 불균일" 제안 → 적용            ← 에이전트 #2
1:00  드래그 편집 + 모바일 보기 자동 변환             ← 에이전트 #3
1:30  저장 → AI가 소스코드 diff 생성                 ← 에이전트 #4
2:15  자기 검증 → 불일치 자동 수정                   ← 에이전트 #5
2:40  "5가지 자율 행동. 개발자는 드래그만."
```

---

## "도구"가 아닌 "에이전트"인 이유

| | 일반 AI 도구 | WIGSS 에이전트 |
|--|------------|---------------|
| **주도성** | 명령을 기다림 | 능동적으로 개선 제안 |
| **범위** | 요청당 단일 액션 | 멀티스텝 자율 파이프라인 |
| **오류 처리** | 사용자가 보고 | 스스로 검증하고 자동 수정 |
| **결과물** | 텍스트/코드 생성 | 실제 소스 파일 수정 |
| **통신** | 요청-응답 | 항시 연결 WebSocket, 이벤트 기반 |

---

## 프로젝트 구조

```
docs/
├── prd/PRD_wigss.md           # 제품 요구사항 정의서 (v5.0)
├── todo_plan/PLAN_wigss.md    # 실행 계획 (D-1 / D-Day)
└── ARCHITECTURE.md            # 시스템 아키텍처 (v2.0)
```

## 라이선스

MIT

---

<div align="center">

**Trae.ai 해커톤 2026 출품작 — Team WIGSS (WIGTN Crew)**

*주제: "에이전트"*

</div>
