<div align="center">

# WIGSS

### Style Shaper — AI 에이전트 기반 비주얼 코드 리팩토링

**컴포넌트를 드래그하세요. 코드가 따라갑니다.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o_+_5.4-412991?style=for-the-badge&logo=openai&logoColor=white)](https://platform.openai.com/)
[![Playwright](https://img.shields.io/badge/Playwright-Locator-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

**한국어** | [English](README.md)

</div>

---

## WIGSS란?

WIGSS는 **항시 떠있는 AI 에이전트** 기반의 비주얼 코드 리팩토링 도구입니다. 프론트엔드 개발자가 실제 웹 페이지 위에서 **UI 컴포넌트를 드래그/리사이즈**하면, AI가 **소스코드를 자동으로 수정**합니다.

Figma 없이. CSS 수동 수정 없이. 그냥 드래그하면 코드가 바뀝니다.

## 문제

코딩 에이전트(Cursor, Claude Code, Trae)로 화면을 대충 만드는 건 잘 됩니다. 하지만 **디자인을 다듬는 건 여전히 고통**입니다:

- "이 카드를 좀 더 크게" — 말로 정확히 설명하기 어려움
- CSS 수정 → 새로고침 → 확인 → 반복 — 느리고 비효율적
- 디자이너 없이 개발자 혼자 다듬어야 하는 상황

## 해결

```bash
npx wigss --port 3000
# 이 한 줄이면 끝.
```

WIGSS가 개발 중인 페이지에 **편집 오버레이**를 씌워줍니다. 컴포넌트를 클릭하고, 드래그해서 크기를 바꾸고, 저장하면 — AI가 Tailwind 클래스를 자동으로 수정합니다.

---

## 빠른 시작

### 1. 실행

```bash
cd my-project
npm run dev                        # 개발 서버 기동 (3000번 포트)

# 다른 터미널에서:
npx wigss --port 3000              # WIGSS가 OpenAI API 키를 물어봄 → 브라우저 자동 오픈
```

또는 키를 인라인으로:
```bash
npx wigss --port 3000 --key sk-proj-...
```

데모 체험 (기존 프로젝트 없어도 됨):
```bash
npx wigss --demo
```

### 2. 편집

1. **Scan** 클릭 — AI가 모든 UI 컴포넌트를 자동 인식
2. 컴포넌트 **클릭** → 선택 (파란 테두리 + 리사이즈 핸들)
3. **드래그**로 이동, **핸들**로 크기 조절
4. AI가 **실시간 피드백** — "60px 차이납니다. 맞출까요?"
5. **채팅**으로 AI에게 질문 — "푸터는 어떻게 수정하지?"

### 3. 저장

**Save** 클릭 → AI가 Tailwind diff 생성 → 소스 파일 수정 → iframe 자동 새로고침 → 끝.

---

## 아키텍처

```
브라우저 (localhost:4000)
├── 플로팅 툴바 [Scan] [Save] [Mobile] [Undo/Redo]
├── 비주얼 에디터
│   ├── iframe (내 페이지 — 읽기 전용 배경)
│   └── 오버레이 (드래그/리사이즈 가능한 컴포넌트 박스)
├── Agent Panel
│   ├── 실시간 피드백 ("카드 높이 60px 차이" → [바로 적용])
│   ├── AI 제안 ("간격 불균일 90%" → [적용] [무시])
│   └── 채팅 ("푸터 어떻게 해?" → AI 분석 + 수정 계획)
│
│   WebSocket (항시 연결, 이벤트 기반)
│   ▼
WIGSS Agent (Node.js)
├── OpenAI GPT-4o — 컴포넌트 인식, 제안, 피드백, 채팅
├── OpenAI GPT-5.4 — Tailwind 코드 리팩토링
├── Playwright — DOM 스캔 (headless Chromium)
└── fs — 소스 파일 읽기/쓰기 (백업 포함)
```

## AI 에이전트: 5가지 자율 행동

| # | 행동 | 모델 | 시점 |
|---|------|------|------|
| 1 | **컴포넌트 자동 인식** | GPT-4o | Scan 후 — "이건 Navbar, 이건 Card Grid" |
| 2 | **디자인 제안** | GPT-4o | 인식 후 — "카드 간격 16px/24px 불균일 (90%)" |
| 3 | **실시간 편집 피드백** | GPT-4o | 드래그/리사이즈 후 — "60px 차이, 맞출까요?" |
| 4 | **채팅 상담** | GPT-4o | 사용자 요청 — "푸터 어떻게?" / "알아서 해줘" |
| 5 | **코드 리팩토링** | GPT-5.4 | Save 시 — `h-16→h-12`, `mt-2→mt-0` 소스 수정 |

### "도구"가 아닌 "에이전트"인 이유

| | 일반 AI 도구 | WIGSS 에이전트 |
|--|------------|---------------|
| **주도성** | 명령을 기다림 | 능동적으로 개선 제안 |
| **범위** | 요청당 단일 액션 | 멀티스텝 자율 파이프라인 |
| **통신** | 요청 → 응답 | 항시 연결 WebSocket |
| **결과물** | 텍스트 생성 | 실제 소스 파일 수정 |

---

## 주요 기능

### 비주얼 편집
- 클릭으로 선택 → 드래그로 이동 → 핸들로 리사이즈
- 배경 레이어 자동 감지 → 클릭이 작은 컴포넌트로 통과
- Undo/Redo 지원
- 1280px 고정 뷰포트 (스캔 좌표와 정확히 일치)

### AI 에이전트 (항시 연결 WebSocket)
- 이벤트 기반 (대기 중 비용 ZERO)
- `data-component` 속성 → 소스 파일 자동 매핑
- 신뢰도 점수가 포함된 제안 + 호버 시 컴포넌트 하이라이트
- 한국어 응답 (구체적 px 값 포함)

### 소스코드 리팩토링
- **1클릭 Save** (diff 생성 + 적용 한 번에)
- Tailwind 인식 — CSS 클래스만 변경, JS 로직은 절대 수정 안 함
- 안전성 — 관련 없는 코드(SVG, 이벤트 핸들러) 수정하는 diff 거부
- 자동 백업 (`.bak` 파일) + iframe 자동 새로고침 + 재스캔

### 채팅 인터페이스
- 의견 요청 — "푸터 어떻게 수정하지?"
- 위임 — "알아서 해줘" → 계획 제시 → 확인 → 자동 수정
- 피드백 연동 — "AI 수정 요청" 클릭 → 채팅으로 자동 전달

---

## CLI 옵션

```bash
npx wigss [옵션]

  -p, --port <port>       대상 dev 서버 포트 (기본: 3000)
  --wigss-port <port>     WIGSS 에디터 포트 (기본: 4000)
  --key <key>             OpenAI API 키
  --demo                  내장 데모 페이지로 실행
  -V, --version           버전 표시
```

`--key` 미제공 + `OPENAI_API_KEY` 환경변수 미설정 시, WIGSS가 **대화형으로 키를 입력받습니다**.

---

## 사용자 흐름

```
1. 개발자가 dev 서버 실행
   $ npm run dev                    → localhost:3000

2. WIGSS 실행
   $ npx wigss --port 3000          → localhost:4000 (자동 오픈)
   → OpenAI API 키 입력 (또는 --key 플래그)

3. [Scan] 클릭
   → AI가 116개 요소 감지 → 컴포넌트 그룹핑
   → 제안: "카드 간격 불균일 (90%)" [적용] [무시]

4. 컴포넌트 클릭 → 선택
   드래그 → 이동 | 핸들 → 리사이즈
   → AI 피드백: "60px 차이납니다. 맞출까요?" [바로 적용] [무시]

5. [Save] 클릭
   → GPT-5.4가 Tailwind diff 생성
   → 소스 파일 수정 (Navbar.tsx: h-16 → h-12)
   → iframe 자동 새로고침 → 변경 확인

6. 계속 편집 (Save 후 자동 재스캔)
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|-----|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS |
| AI (빠른 분석) | OpenAI GPT-4o |
| AI (코드 수정) | OpenAI GPT-5.4 |
| DOM 스캔 | Playwright (headless Chromium) |
| 통신 | WebSocket (ws) — 항시 연결 |
| 상태 관리 | Zustand |
| 파일 I/O | Node.js fs (경로 검증 + 백업) |

## 요구 사항

- Node.js 18+
- OpenAI API 키 (GPT-5.4는 Tier 3+ 권장)
- 편집할 dev 서버 (React/Next.js + Tailwind 권장)

## 라이선스

MIT

---

<div align="center">

**Team WIGSS (WIGTN Crew) — Trae.ai 해커톤 2026 출품작**

*주제: "에이전트" — 관찰하고, 제안하고, 자율적으로 행동하는 AI 에이전트*

</div>
