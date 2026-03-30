<div align="center">

# WIGSS

> UI 컴포넌트를 드래그하세요 — 소스 코드가 자동으로 바뀝니다.

[![npm version](https://img.shields.io/npm/v/wigss?style=flat-square)](https://npmjs.com/package/wigss)
[![npm downloads](https://img.shields.io/npm/dm/wigss?style=flat-square)](https://npmjs.com/package/wigss)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

<!-- TODO: 터미널 데모 GIF 추가 (권장: vhs 또는 asciinema) -->

**한국어** | [English](README.md)

</div>

---

## 빠른 시작

```bash
cd my-project
npm run dev                          # 개발 서버 기동 (3000번 포트)

# 다른 터미널에서:
npx wigss@latest --port <포트번호>         # API 키 입력 후 브라우저 자동 오픈
```

또는 키를 인라인으로:

```bash
npx wigss@latest --port <포트번호> --key sk-proj-...
```

데모 체험 (기존 프로젝트 없어도 됨):

```bash
npx wigss@latest --demo
```

> 이전에 `wigss`를 전역 설치한 적 있다면, `npm uninstall -g wigss`로 먼저 제거하세요. 그래야 npx가 항상 최신 버전을 실행합니다.

---

## WIGSS란?

**WIGSS** (Style Shaper)는 **항시 떠있는 AI 에이전트** 기반의 비주얼 코드 리팩토링 도구입니다. 프론트엔드 개발자가 실제 웹 페이지 위에서 **UI 컴포넌트를 드래그/리사이즈**하면, AI가 **소스코드를 자동으로 수정**합니다.

Figma 없이. CSS 수동 수정 없이. 그냥 드래그하면 코드가 바뀝니다.

### 문제

코딩 에이전트(Cursor, Claude Code, Trae)로 화면을 대충 만드는 건 잘 됩니다. 하지만 **디자인을 다듬는 건 여전히 고통**입니다:

- "이 카드를 좀 더 크게" — 말로 정확히 설명하기 어려움
- CSS 수정 → 새로고침 → 확인 → 반복 — 느리고 비효율적
- 디자이너 없이 개발자 혼자 다듬어야 하는 상황

---

## 사용 방법

### 1. 스캔

**Scan** 클릭 — AI가 페이지의 모든 UI 컴포넌트를 자동 인식하고 레이블을 붙입니다 (Navbar, Card, Footer 등).

### 2. 편집

1. 컴포넌트 **클릭** → 선택 (파란 테두리 + 리사이즈 핸들)
2. **드래그**로 이동, **핸들**로 크기 조절
3. AI가 **실시간 피드백** — "8px 차이납니다. 맞출까요?"
4. **채팅**으로 AI에게 질문 — "푸터 어떻게 수정하지?" 또는 "알아서 해줘"

### 3. 저장

**Save** 클릭 → AI가 Tailwind diff 생성 → 소스 파일 수정 → iframe 자동 새로고침.

---

## CLI

```bash
npx wigss@latest [옵션]
```

| 플래그                | 기본값 | 설명                                           |
| --------------------- | ------ | ---------------------------------------------- |
| `-p, --port <port>`   | `3000` | 대상 dev 서버 포트                             |
| `--wigss-port <port>` | `4000` | WIGSS 에디터 포트                              |
| `--key <key>`         | —      | OpenAI API 키 (또는 `OPENAI_API_KEY` 환경변수) |
| `--demo`              | —      | 내장 데모 페이지로 실행                        |
| `-V, --version`       | —      | 버전 표시                                      |

`--key` 미제공 + `OPENAI_API_KEY` 환경변수 미설정 시, WIGSS가 **대화형으로 키를 입력받습니다**.

---

## 동작 원리

1. 포트 4000에 Next.js 에디터를 실행해 개발 서버를 iframe으로 감쌉니다
2. Playwright가 라이브 DOM을 스캔해 컴포넌트를 소스 파일에 매핑합니다
3. fabric.js 오버레이가 각 컴포넌트에 정렬된 드래그/리사이즈 박스를 렌더링합니다
4. 드래그/리사이즈 이벤트가 WebSocket으로 AI 에이전트에 스트리밍됩니다
5. Save 시 직접 Tailwind 클래스 매핑으로 diff를 생성하고 `fs`가 소스에 직접 적용합니다

---

## AI 에이전트: 5가지 자율 행동

| #   | 행동                   | 모델    | 시점                       |
| --- | ---------------------- | ------- | -------------------------- |
| 1   | **컴포넌트 자동 인식** | GPT-4o  | Scan 후                    |
| 2   | **디자인 제안**        | GPT-4o  | 인식 후 (신뢰도 점수 포함) |
| 3   | **실시간 편집 피드백** | GPT-4o  | 드래그/리사이즈 후         |
| 4   | **채팅 상담**          | GPT-4o  | 사용자 질문 또는 위임      |
| 5   | **코드 리팩토링**      | Direct Tailwind mapping | Save 시              |

### "도구"가 아닌 "에이전트"인 이유

|            | 일반 AI 도구     | WIGSS 에이전트           |
| ---------- | ---------------- | ------------------------ |
| **주도성** | 명령을 기다림    | 능동적으로 개선 제안     |
| **범위**   | 요청당 단일 액션 | 멀티스텝 자율 파이프라인 |
| **통신**   | 요청 → 응답      | 항시 연결 WebSocket      |
| **결과물** | 텍스트 생성      | 실제 소스 파일 수정      |

---

## 요구 사항

- Node.js 18+
- OpenAI API 키 (GPT-4o 분석 및 제안용)
- 편집할 dev 서버 (React/Next.js + Tailwind 권장)

---

## 아키텍처

```
브라우저 (localhost:4000)
├── 플로팅 툴바 [Scan] [Save] [Mobile] [Undo/Redo]
├── 비주얼 에디터
│   ├── iframe (내 페이지 — 읽기 전용 배경)
│   └── 오버레이 (드래그/리사이즈 가능한 컴포넌트 박스)
└── Agent Panel
    ├── 실시간 피드백  → [바로 적용]
    ├── AI 제안        → [적용] [무시]
    └── 채팅

    WebSocket (항시 연결, 이벤트 기반)
    ▼
WIGSS Agent (Node.js)
├── OpenAI GPT-4o  — 컴포넌트 인식, 제안, 피드백, 채팅
├── Direct Tailwind mapping — 결정론적 코드 리팩토링
├── Playwright     — DOM 스캔 (headless Chromium)
└── fs             — 소스 파일 읽기/쓰기 (.bak 백업 포함)
```

---

## 기여

Pull Request를 환영합니다! 변경 전 Issue를 먼저 열어서 논의해 주세요.

---

## 라이선스

[MIT](./LICENSE) © Team WIGSS (WIGTN Crew)

---

<div align="center">

**Trae.ai 해커톤 2026 출품작 — 주제: "에이전트"**

</div>
