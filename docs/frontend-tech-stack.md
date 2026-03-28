# WIGSS Frontend Tech Stack

> 해커톤 심사 기준 최적화 기준으로 정리한 프론트엔드 기술 목록.
> 우선순위는 **심사 임팩트(WOW 팩터 → 기술 완성도 → 코드 품질)** 순.

---

## 현재 스택

| 역할 | 패키지 | 버전 | 비고 |
|------|--------|------|------|
| 프레임워크 | `next` | ^14.2 | App Router |
| UI 런타임 | `react` / `react-dom` | ^19.2 | Concurrent 지원 |
| 스타일링 | `tailwindcss` | ^4.2 | |
| 상태관리 | `zustand` | ^5.0 | editor-store + agent-store |
| 캔버스 오버레이 | `fabric` | ^7.2 | 컴포넌트 바운딩박스 |
| 실시간 통신 | `ws` | ^8.20 | WebSocket 서버 |
| AI (관찰/제안/채팅) | `openai` | ^6.33 | GPT-4o, function calling |
| AI (리팩토링/검증) | `@anthropic-ai/sdk` | ^0.80 | Claude, tool use |

---

## 추가 가능한 기술

### 🔴 Priority 1 — WOW 팩터 (즉각 눈에 보임)

#### Monaco Editor — `@monaco-editor/react`

- VS Code와 동일한 코드 에디터를 패널 내 임베드
- AI가 생성한 코드를 패널에서 직접 수정 가능
- **적용 위치**: `AgentPanel` 내 DiffPreview 또는 별도 CodeEditor 섹션
- **심사 포인트**: "AI가 코드를 생성하고 에디터에서 바로 편집한다" — 완결된 프로덕트처럼 보임

```bash
pnpm add @monaco-editor/react
```

```tsx
// 사용 예시
import Editor from '@monaco-editor/react';

<Editor
  height="200px"
  language="tsx"
  theme="vs-dark"
  value={generatedCode}
  onChange={(val) => setCode(val ?? '')}
/>
```

---

#### react-diff-viewer — `react-diff-viewer-continued`

- Before/After 코드 diff 시각화
- 리팩토링 도구의 핵심 UX — "이 코드가 이렇게 바뀌었습니다"
- **적용 위치**: `DiffPreview` 컴포넌트 (`src/components/panels/DiffPreview.tsx`)
- **심사 포인트**: 데모에서 변경사항을 시각적으로 표현 → 설명 없이도 기능이 전달됨

```bash
pnpm add react-diff-viewer-continued
```

```tsx
import ReactDiffViewer from 'react-diff-viewer-continued';

<ReactDiffViewer
  oldValue={originalCode}
  newValue={refactoredCode}
  splitView={false}
  useDarkTheme
/>
```

---

#### Framer Motion — `framer-motion`

- 컴포넌트 오버레이 등장/선택 애니메이션
- AgentPanel 피드백·제안 카드 slide-in / fade-out
- PanelSection collapse 스무스 애니메이션 (현재 없음)
- **적용 위치**: `VisualEditor` 오버레이, `AgentPanel` 카드들
- **심사 포인트**: 폴리시 — 같은 기능이라도 애니메이션 있으면 완성도가 2배로 보임

```bash
pnpm add framer-motion
```

```tsx
// 카드 등장 예시
import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {feedbacks.map((fb) => (
    <motion.div
      key={fb.id}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      {/* FeedbackCard */}
    </motion.div>
  ))}
</AnimatePresence>
```

---

### 🟠 Priority 2 — 기술 완성도 (UX + 개발 도구 인상)

#### cmdk — Command Palette

- `Cmd+K` / `Ctrl+K` 로 AI 명령 입력
- AI-native 툴의 표준 UX 패턴
- **적용 위치**: 전역 레이아웃 (`src/app/layout.tsx`)
- **심사 포인트**: "이 팀은 Figma, Linear 같은 모던 개발 도구 UX를 이해하고 있다"

```bash
pnpm add cmdk
```

---

#### Sonner — Toast Notifications

- "Refactoring complete ✓", "File saved", "Agent error" 등 액션 피드백
- 현재 알림 시스템 없음 → 추가 시 완성도 급상승
- **적용 위치**: agent-store의 액션 결과, applyChange 완료 시점
- **심사 포인트**: 사용자가 에이전트 상태를 직관적으로 인지 가능

```bash
pnpm add sonner
```

```tsx
import { toast } from 'sonner';

// agent-store.ts 내
toast.success('Refactoring applied');
toast.error('Agent connection failed');
```

---

#### Lucide React — Icon System

- 현재 모든 아이콘이 inline SVG 수작업 (`AgentPanel.tsx` 하단 참고)
- 일관된 아이콘 시스템으로 대체 → 코드 경량화 + 시각 일관성
- **적용 위치**: `FloatingToolbar`, `AgentPanel`, `VisualEditor`

```bash
pnpm add lucide-react
```

```tsx
// 기존 inline SVG 대체
import { Send, ChevronRight, AlertCircle, AlertTriangle } from 'lucide-react';

<Send size={14} />
```

---

#### Radix UI — Headless Primitives

- 접근성(a11y) 보장된 headless 컴포넌트
- **필요한 것만 설치** (패키지 분리형)

| 패키지 | 용도 | 적용 위치 |
|--------|------|----------|
| `@radix-ui/react-tooltip` | 컴포넌트 오버레이 hover시 메타데이터 표시 | `VisualEditor` 오버레이 |
| `@radix-ui/react-dropdown-menu` | FloatingToolbar 뷰포트 전환 드롭다운 | `FloatingToolbar` |
| `@radix-ui/react-dialog` | 설정 모달, 확인 다이얼로그 | 전역 |

```bash
pnpm add @radix-ui/react-tooltip @radix-ui/react-dropdown-menu @radix-ui/react-dialog
```

---

### 🟡 Priority 3 — 코드 품질 (기술 깊이)

#### Shiki — Syntax Highlighting

- 채팅창 AI 응답 내 코드 블록 하이라이팅
- VS Code 기반 토크나이저 → 가장 정확한 하이라이팅
- **적용 위치**: `ChatSection` 메시지 렌더링

```bash
pnpm add shiki
```

---

#### @dnd-kit/core — Drag and Drop

- AgentPanel 내 Suggestions 카드 순서 변경
- 컴포넌트 오버레이 드래그 (fabric.js 보완)
- **적용 위치**: `SuggestionsSection`, 향후 컴포넌트 레이어 패널

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable
```

---

#### @tanstack/react-virtual — Virtual Scroll

- Logs 섹션이 길어질 때 DOM 절약
- 현재 단순 `overflow-y-auto` → 수백 개 로그 시 성능 저하 방지
- **적용 위치**: `LogsSection` (`AgentPanel.tsx`)

```bash
pnpm add @tanstack/react-virtual
```

---

#### immer — Immutable State

- Zustand store 복잡한 state mutation을 직관적으로 작성
- Zustand가 기본 지원 (`immer` middleware)
- **적용 위치**: `editor-store.ts`, `agent-store.ts`

```bash
pnpm add immer
```

---

### 🟢 Optional — 시간 여유 있을 때

#### react-resizable-panels

- VisualEditor ↔ AgentPanel 경계를 드래그로 조절
- 현재 AgentPanel 고정 `w-80` → 유동적 레이아웃

```bash
pnpm add react-resizable-panels
```

---

#### nuqs — URL State Management

- `project`, `wsPort`, `viewportMode` 등 URL search params 기반 상태 관리
- 현재 `new URLSearchParams(window.location.search)` 수동 처리를 선언적으로 대체
- 공유 가능한 URL, 브라우저 히스토리 지원

```bash
pnpm add nuqs
```

---

#### @xyflow/react — React Flow

- AI 에이전트 루프 시각화 (관찰 → 제안 → 리팩토링 플로우 다이어그램)
- 데모 보조 화면으로 활용 가능

```bash
pnpm add @xyflow/react
```

---

---

## Lighthouse 성능 최적화

> 추가 패키지 설치 없이 코드 수준에서 적용 가능한 것들을 먼저 다룬다.
> Lighthouse 4개 카테고리(Performance / Accessibility / Best Practices / SEO) 기준으로 분류.

---

### ⚡ Performance — 번들 크기 & 로딩

#### Code Splitting — `next/dynamic`

Monaco Editor(`~2MB`)와 fabric.js(`~800KB`)는 초기 번들에 포함되면 LCP를 직접 파괴한다.
`next/dynamic`으로 lazy load해서 실제 사용 시점에만 로드해야 한다.

**적용 위치**: `src/app/page.tsx` — VisualEditor, AgentPanel 임포트 부분

```tsx
// src/app/page.tsx — 현재 정적 import를 dynamic으로 교체
import dynamic from 'next/dynamic';

const VisualEditor = dynamic(() => import('@/components/editor/VisualEditor'), {
  ssr: false,                          // fabric.js는 브라우저 전용
  loading: () => <EditorSkeleton />,
});

const AgentPanel = dynamic(() => import('@/components/panels/AgentPanel'), {
  ssr: false,
  loading: () => <PanelSkeleton />,
});

// Monaco Editor (Priority 1 추가 시)
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="h-48 bg-gray-800 animate-pulse rounded" />,
});
```

**예상 효과**: 초기 JS 번들 ~60% 감소, LCP 1~2초 단축

---

#### Tree Shaking — 잘못된 import 패턴 방지

라이브러리별로 tree shaking이 되는 import 방식이 다르다.

```tsx
// ❌ 전체 번들을 가져옴
import * as LucideIcons from 'lucide-react';
import { motion } from 'framer-motion'; // 이건 OK — named export

// ✅ named import — 사용한 아이콘만 번들에 포함
import { Send, ChevronRight, AlertCircle } from 'lucide-react';

// ❌ lodash 전체 (사용하면 ~70KB 추가)
import _ from 'lodash';

// ✅ 필요한 함수만
import debounce from 'lodash/debounce';
// 또는 lodash-es 사용 (ES module, tree shaking 완전 지원)
import { debounce } from 'lodash-es';
```

**Framer Motion tree shaking 팁**
```tsx
// 애니메이션만 필요하면 m 컴포넌트 + LazyMotion으로 ~30KB 절약
import { LazyMotion, domAnimation, m } from 'framer-motion';

<LazyMotion features={domAnimation}>
  <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    {/* ... */}
  </m.div>
</LazyMotion>
```

---

#### Bundle Analyzer — `@next/bundle-analyzer`

번들 구성을 시각화해서 어디서 크기가 새는지 파악.

```bash
pnpm add -D @next/bundle-analyzer
```

```js
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);
```

```bash
ANALYZE=true pnpm build
# .next/analyze/client.html 에서 트리맵으로 확인
```

---

#### `next/font` — 폰트 최적화

현재 `layout.tsx`에 폰트 설정이 없음. `next/font`는 빌드 타임에 폰트를 self-host하고
`font-display: swap`을 자동 적용 → CLS(레이아웃 이동) 방지.

**적용 위치**: `src/app/layout.tsx`

```tsx
import { Geist, Geist_Mono } from 'next/font/google';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-sans bg-gray-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
```

---

#### `next/script` — 외부 스크립트 로딩 전략

서드파티 스크립트(analytics 등) 추가 시 `strategy` 속성으로 메인 스레드 블로킹 방지.

```tsx
import Script from 'next/script';

// afterInteractive: DOMContentLoaded 이후 로드 (analytics에 적합)
<Script src="..." strategy="afterInteractive" />

// lazyOnload: 모든 리소스 로드 후 (광고, 채팅위젯)
<Script src="..." strategy="lazyOnload" />
```

---

#### React Suspense + Streaming

Next.js 14 App Router는 서버 컴포넌트 스트리밍을 지원한다.
에디터처럼 무거운 페이지는 Suspense boundary로 감싸서 Shell을 먼저 보여줌.

```tsx
// src/app/page.tsx
import { Suspense } from 'react';

export default function EditorPage() {
  return (
    <div className="h-screen flex flex-col bg-gray-950">
      <FloatingToolbar />
      <Suspense fallback={<EditorSkeleton />}>
        <div className="flex-1 flex overflow-hidden pt-10">
          <VisualEditor />
          <AgentPanel />
        </div>
      </Suspense>
    </div>
  );
}
```

---

### ♿ Accessibility — Lighthouse a11y 점수

현재 inline SVG 아이콘에 `aria-label`이 없고, 인터랙티브 요소에 `role` 속성도 누락된 부분이 있다.

```tsx
// ❌ 현재 코드 패턴 (AgentPanel.tsx의 아이콘 버튼들)
<button onClick={handleSend}>
  <SendIcon />
</button>

// ✅ 수정
<button onClick={handleSend} aria-label="메시지 전송">
  <SendIcon aria-hidden="true" />
</button>
```

**체크리스트**
- `<img>` / `<iframe>` — `alt`, `title` 속성 필수 (`VisualEditor.tsx:87` iframe에 `title` 있음 ✓)
- 색상 대비 — Tailwind `gray-500` on `gray-950` 는 4.5:1 미달 가능성 → `gray-400` 이상 사용
- 키보드 포커스 — `focus:outline-none`만 쓰면 포커스 인디케이터 사라짐 → `focus-visible:ring-2` 병용
- `<PanelSection>` 토글 버튼 — `aria-expanded` 상태 전달 필요

```tsx
// PanelSection 개선
<button
  aria-expanded={open}
  aria-controls={`section-${title}`}
  onClick={() => setOpen(!open)}
>
```

---

### 📋 Best Practices & SEO

#### Metadata API — `src/app/layout.tsx`

현재 최소한의 메타데이터만 있음. Lighthouse SEO 점수는 메타 태그 completeness로 채점.

```tsx
// src/app/layout.tsx
export const metadata: Metadata = {
  title: 'WIGSS — Style Shaper',
  description: 'Visual code refactoring tool with always-on AI agent. Powered by GPT-4o + Claude.',
  keywords: ['visual editor', 'code refactoring', 'AI agent', 'tailwindcss'],
  openGraph: {
    title: 'WIGSS — Style Shaper',
    description: 'Visual code refactoring tool with always-on AI agent',
    type: 'website',
  },
};
```

#### `preconnect` — API 엔드포인트 사전 연결

OpenAI, Anthropic API 첫 요청 시 DNS + TLS 핸드쉐이크 비용을 레이아웃 렌더 중에 미리 처리.

```tsx
// src/app/layout.tsx <head> 내
<link rel="preconnect" href="https://api.openai.com" />
<link rel="preconnect" href="https://api.anthropic.com" />
```

---

### 📊 Web Vitals 측정

최적화 결과를 수치로 확인하는 방법.

#### Next.js 내장 Web Vitals 훅

```tsx
// src/app/layout.tsx 또는 별도 파일
export function reportWebVitals(metric: NextWebVitalsMetric) {
  // LCP, FID, CLS, TTFB, FCP 측정
  console.log(metric); // 개발 중 콘솔 확인
  // 프로덕션에서는 analytics로 전송
}
```

#### Lighthouse CI — `@lhci/cli`

배포 전 자동으로 Lighthouse 점수를 체크하는 CLI 도구.

```bash
pnpm add -D @lhci/cli
```

```yaml
# lighthouserc.yml
ci:
  collect:
    url: ['http://localhost:4000']
  assert:
    assertions:
      first-contentful-paint: ['warn', { maxNumericValue: 2000 }]
      interactive: ['error', { maxNumericValue: 5000 }]
      cumulative-layout-shift: ['error', { maxNumericValue: 0.1 }]
```

```bash
lhci autorun
```

---

### 요약 — 설치 없이 바로 적용 가능한 것

| 항목 | 파일 | 예상 Lighthouse 점수 변화 |
|------|------|--------------------------|
| `next/dynamic` for VisualEditor, AgentPanel | `page.tsx` | Performance +15~25 |
| `next/font` 추가 | `layout.tsx` | Performance +5, CLS 개선 |
| `aria-label`, `aria-expanded` 추가 | `AgentPanel.tsx` | Accessibility +10~20 |
| Metadata 보강 | `layout.tsx` | SEO +10~15 |
| `preconnect` 힌트 | `layout.tsx` | Performance +3~5 |
| Tree shaking (import 정리) | 각 컴포넌트 | Performance +5~10 |

---

## 권장 설치 순서

```bash
# 1순위 — 핵심 기능 완성
pnpm add @monaco-editor/react react-diff-viewer-continued framer-motion

# 2순위 — UX 폴리시
pnpm add cmdk sonner lucide-react
pnpm add @radix-ui/react-tooltip @radix-ui/react-dropdown-menu @radix-ui/react-dialog

# 3순위 — 코드 품질
pnpm add shiki immer @tanstack/react-virtual

# 개발 도구 (devDependency)
pnpm add -D @next/bundle-analyzer @lhci/cli
```

---

## 데모 핵심 플로우 (심사 시나리오)

```
1. 페이지 스캔 → 컴포넌트 오버레이 등장 (Framer Motion)
2. 컴포넌트 선택 → Radix Tooltip으로 메타데이터 표시
3. AI 리팩토링 실행 → Sonner toast "Refactoring complete"
4. DiffPreview에서 Before/After 확인 (react-diff-viewer)
5. Monaco Editor에서 코드 직접 수정 후 적용
6. iframe 실시간 갱신
```

이 플로우가 데모에서 끊김없이 동작하면 **"프로덕션 수준의 도구"** 로 인식됨.
