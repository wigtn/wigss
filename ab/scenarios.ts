/**
 * A/B 하네스 — 시나리오 정의
 *
 * 각 시나리오는 "화면에서 이 요소를 이렇게 조작했다"를 나타낸다.
 * A(현행)와 B(개선안)에 같은 입력을 주고 결과를 비교한다.
 */

export type Scenario = {
  id: string;
  file: string;
  label: string;
  /** 어떤 코드 패턴을 시험하는가 */
  pattern: string;
  /** 편집 대상 요소의 소스 위치 — jsxDEV 런타임이 심어줄 주소와 동일 */
  address: { line: number; column: number };
  /** 스캔이 읽어온 className (A의 조인 키). 동적이면 런타임 계산 결과 */
  runtimeClassName: string;
  /** 편집 제스처 */
  gesture:
    | { type: 'resize'; from: { width: number; height: number }; to: { width: number; height: number } }
    | { type: 'move'; from: { x: number; y: number }; to: { x: number; y: number } };
  /** 편집 시점의 활성 브레이크포인트 (에디터 뷰포트 폭에서 결정) */
  breakpoint: 'base' | 'sm' | 'md' | 'lg' | 'xl';
  /** 기대 결과: 이 className 토큰이 이렇게 바뀌어야 정답 */
  expect: {
    /** 정답 className 문자열. null이면 "편집 불가로 정직하게 포기해야 함" */
    className: string | null;
    reason: string;
  };
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'S1',
    file: 'S1_unique.tsx',
    label: '고유 className · 정적',
    pattern: '기본형',
    address: { line: 3, column: 4 },
    runtimeClassName: 'flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-4',
    gesture: { type: 'resize', from: { width: 256, height: 192 }, to: { width: 256, height: 256 } },
    breakpoint: 'base',
    expect: {
      className: 'flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-4',
      reason: 'h-48(192px) → h-64(256px)',
    },
  },
  {
    id: 'S2',
    file: 'S2_duplicate.tsx',
    label: '동일 className 2개',
    pattern: '중복',
    // 두 번째 카드를 편집한다
    address: { line: 7, column: 6 },
    runtimeClassName: 'flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-5',
    gesture: { type: 'resize', from: { width: 256, height: 192 }, to: { width: 256, height: 256 } },
    breakpoint: 'base',
    expect: {
      className: 'flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-5',
      reason: '두 번째 카드만 바뀌어야 한다',
    },
  },
  {
    id: 'S3',
    file: 'S3_template.tsx',
    label: '템플릿 리터럴 + 보간',
    pattern: '동적 className',
    address: { line: 3, column: 4 },
    runtimeClassName: 'flex flex-col h-48 w-64 rounded-lg p-4 primary',
    gesture: { type: 'resize', from: { width: 256, height: 192 }, to: { width: 256, height: 256 } },
    breakpoint: 'base',
    expect: {
      className: 'flex flex-col h-64 w-64 rounded-lg p-4',
      reason: '정적 부분의 h-48만 교체. 보간은 보존',
    },
  },
  {
    id: 'S4',
    file: 'S4_clsx.tsx',
    label: 'cn() 호출',
    pattern: '동적 className',
    address: { line: 5, column: 4 },
    runtimeClassName: 'flex flex-col h-48 w-64 rounded-lg p-8 ring-2 ring-blue-500',
    gesture: { type: 'resize', from: { width: 256, height: 192 }, to: { width: 256, height: 256 } },
    breakpoint: 'base',
    expect: {
      className: 'flex flex-col h-64 w-64 rounded-lg p-8',
      reason: "cn() 첫 인자 문자열 안의 h-48만 교체. 조건부 인자는 보존",
    },
  },
  {
    id: 'S5',
    file: 'S5_multiline.tsx',
    label: '여러 줄 속성',
    pattern: '포맷',
    address: { line: 3, column: 4 },
    runtimeClassName:
      'flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-4 shadow-md transition-colors hover:bg-gray-700',
    gesture: { type: 'resize', from: { width: 256, height: 192 }, to: { width: 256, height: 256 } },
    breakpoint: 'base',
    expect: {
      className:
        'flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-4 shadow-md transition-colors hover:bg-gray-700',
      reason: '줄바꿈 포맷을 보존하며 h-48만 교체',
    },
  },
  {
    id: 'S6',
    file: 'S6_responsive.tsx',
    label: '반응형 h-32 md:h-48 lg:h-64',
    pattern: '브레이크포인트',
    address: { line: 3, column: 4 },
    runtimeClassName: 'flex flex-col h-32 md:h-48 lg:h-64 w-full rounded-lg bg-gray-800 p-4',
    // lg 뷰포트(1280px)에서 편집 — lg:h-64(256px)를 320px로
    gesture: { type: 'resize', from: { width: 1024, height: 256 }, to: { width: 1024, height: 320 } },
    breakpoint: 'lg',
    expect: {
      className: 'flex flex-col h-32 md:h-48 lg:h-80 w-full rounded-lg bg-gray-800 p-4',
      reason: 'lg 활성 → lg:h-64만 lg:h-80으로. base/md는 불변',
    },
  },
  {
    id: 'S7',
    file: 'S7_map.tsx',
    label: '.map() 안의 항목',
    pattern: '반복 렌더',
    address: { line: 7, column: 8 },
    runtimeClassName: 'flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-6',
    gesture: { type: 'resize', from: { width: 256, height: 192 }, to: { width: 256, height: 256 } },
    breakpoint: 'base',
    expect: {
      className: 'flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-6',
      reason: '크기 변경은 전체 항목에 적용되는 게 맞다 (순서 변경과 달리 배열 무관)',
    },
  },
  {
    id: 'S8',
    file: 'S8_move.tsx',
    label: 'flex 자식 이동 (12px)',
    pattern: '위치 이동',
    address: { line: 5, column: 6 },
    runtimeClassName: 'block rounded px-3 py-2 text-gray-300',
    gesture: { type: 'move', from: { x: 16, y: 60 }, to: { x: 16, y: 72 } },
    breakpoint: 'base',
    expect: {
      className: 'block rounded px-3 py-2 text-gray-300 mt-3',
      reason: '12px → mt-3 (스케일 정확히 일치). 임의값 금지',
    },
  },
  {
    id: 'S9',
    file: 'S9_singlequote.tsx',
    label: "단일 따옴표 className",
    pattern: '포맷',
    address: { line: 3, column: 4 },
    runtimeClassName: 'flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-3',
    gesture: { type: 'resize', from: { width: 256, height: 192 }, to: { width: 256, height: 256 } },
    breakpoint: 'base',
    expect: {
      className: 'flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-3',
      reason: '따옴표 스타일을 보존하며 교체',
    },
  },
  {
    id: 'S10',
    file: 'S10_prop.tsx',
    label: 'prop className 형제 옆의 정적 요소',
    pattern: '혼합',
    address: { line: 4, column: 6 },
    runtimeClassName: 'flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-2',
    gesture: { type: 'resize', from: { width: 256, height: 192 }, to: { width: 256, height: 256 } },
    breakpoint: 'base',
    expect: {
      className: 'flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-2',
      reason: '같은 파일에 표현식 className이 있어도 정적 요소는 정확히 찾아야 함',
    },
  },
];
