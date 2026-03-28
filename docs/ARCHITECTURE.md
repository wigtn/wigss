# WIGSS Architecture

> **Version**: 2.2
> **Updated**: 2026-03-27 (OpenAI 듀얼 모델 전환: GPT-4o + GPT-5.4)
> **PRD Reference**: docs/prd/PRD_wigss.md (v5.2)

---

## 1. System Overview

```
$ npx wigss --port 3000
      │
      ├── cwd → 소스 경로 감지
      ├── WIGSS 서버 기동 (localhost:4000)
      └── 브라우저 자동 오픈
              │
              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Browser (localhost:4000)                    │
│                                                               │
│  ┌─ 플로팅 툴바 ──────────────────────────────────────────┐  │
│  │ [Edit] [Mobile] [Save] [Undo]              [Close]     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ iframe ──────────────┐  ┌─ Agent Panel ──────────────┐  │
│  │ 실제 페이지 (배경)      │  │ 실시간 피드백              │  │
│  │                        │  │  ⚠️ "8px 어긋남" [적용]    │  │
│  │ ┌─ fabric.js Canvas ┐│  │                            │  │
│  │ │ 드래그/리사이즈 핸들 ││  │ 채팅                       │  │
│  │ │ (object-based)     ││  │  🧑 "푸터 어떻게?"         │  │
│  │ └────────────────────┘│  │  🤖 "높이 축소 제안"       │  │
│  └────────────────────────┘  │                            │  │
│                               │ 에이전트 로그              │  │
│  Zustand (editor + agent)     │  ✓ 8개 인식               │  │
│                               └────────────────────────────┘  │
└───────────────────────────────────┬──────────────────────────┘
                                    │
                          WebSocket (항시 연결)
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────┐
│                    WIGSS Agent (Node.js)                       │
│                                                               │
│  Event Loop (이벤트 기반, 폴링 아님)                           │
│  ├── WebSocket 이벤트: scan, drag_end, resize_end,            │
│  │   save, chat, mobile_view, accept_suggestion               │
│  ├── chokidar: 소스 파일 변경 감지                             │
│  └── 내부 트리거: 스캔완료→인식, 적용완료→검증                  │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │ OpenAI GPT-4o    │  │ OpenAI GPT-5.4   │                  │
│  │ (관찰/인식/제안/  │  │ (코드 리팩토링/  │                  │
│  │  피드백/채팅/반응형)│  │  검증 수정)      │                  │
│  └──────────────────┘  └──────────────────┘                  │
│                                                               │
│  Playwright (스캔/검증)  │  fs (파일 읽기/쓰기)  │  chokidar    │
└──────────────────────────────────────────────────────────────┘
```

## 2. 이벤트 → AI 호출 매핑

| 이벤트 | 트리거 | AI | 모델 |
|--------|--------|-----|------|
| 스캔 | 사용자 | 인식 + 제안 (자동 연쇄) | GPT-4o |
| 드래그/리사이즈 중 | 사용자 | **없음** (60fps) | - |
| 드래그/리사이즈 끝 | 사용자 | 실시간 피드백 | GPT-4o |
| 채팅 | 사용자 | 의견/위임/지시 | GPT-4o |
| 제안 [적용] | 사용자 | **없음** (즉시 적용) | - |
| 모바일 보기 | 사용자 | 반응형 변환 | GPT-4o |
| 저장 | 사용자 | 코드 리팩토링 | **GPT-5.4** |
| 적용 완료 | 내부 자동 | 자기 검증 | Playwright + **GPT-5.4** |
| 검증 실패 | 내부 자동 | 자동 재수정 (최대 3회) | **GPT-5.4** |
| 파일 변경 | chokidar | 알림만 (AI 없음) | - |

**핵심**: 대기 중 비용 ZERO. AI는 이벤트 발생 시에만 호출.

## 3. WebSocket 프로토콜

```
Frontend → Agent:
  scan, drag_end, resize_end, save, chat, mobile_view,
  accept_suggestion, accept_feedback, plan_confirmed, apply

Agent → Frontend:
  status, components_detected, suggestion, feedback,
  chat_response, plan_confirm, auto_modify,
  diff_preview, refactoring_progress, verification_result, file_changed
```

## 4. OpenAI 듀얼 모델

| 역할 | 모델 | 이유 |
|------|------|------|
| 관찰/인식/제안/피드백/채팅/반응형 | **OpenAI GPT-4o** | 빠른 응답, function calling |
| 코드 리팩토링/검증 수정 | **OpenAI GPT-5.4** | 코드 정밀도 |

## 5. 오버레이 편집 방식

```
iframe (실제 페이지) — 보이기만 함, 터치 불가
      ↑
fabric.js Canvas — object-based drag/resize, toJSON() serialization
      ↑
사용자가 Canvas 객체를 조작 → 실제 페이지는 안 움직임
```

## 6. Agent Panel 구조

```
Agent Panel
├── 실시간 피드백 (드래그/리사이즈 후)
│   └── ⚠️ 경고/제안 + [적용][무시]
├── 채팅 (3가지 모드)
│   ├── 의견 요청 → 분석 + 제안
│   ├── 위임 → 계획 → 확인 → 자동 수정
│   └── 지시 → 즉시 수정
└── 에이전트 로그 (수행 이력)
```
