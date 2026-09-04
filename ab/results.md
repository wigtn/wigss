# A/B 결과

생성: 2026-09-01T19:00:40.040Z · 지연 반복 20회

## 요약

| 지표 | A (현행) | B (개선안) | 변화 |
|---|---:|---:|---|
| 편집 정확도 | 5/10 (50%) | 10/10 (100%) | +50pp |
| 대상 해석 성공 | 8/10 (80%) | 10/10 (100%) | +20pp |
| **오편집** (썼는데 틀림) | 3건 | 0건 | -3건 |
| 오염 발생 시나리오 | 1건 | 0건 | -1건 |
| 오염 총 건수 | 1 | 0 | -1 |
| 사유 보고된 포기 | 2건 | 0건 | +-2건 |
| 평균 지연 | 0.16 ms | 0.03 ms | 4.8× 빠름 |
| 평균 읽은 파일 | 11.0개 | 1.0개 | 11× 감소 |
| 평균 파싱 파일 | 10.0개 | 1.0개 | 10× 감소 |

## 시나리오별

| # | 패턴 | 시나리오 | A 결과 | B 결과 | A 오염 | B 오염 | A ms | B ms |
|---|---|---|---|---|---:|---:|---:|---:|
| S1 | 기본형 | 고유 className · 정적 | ✅ 정확 | ✅ 정확 | 0 | 0 | 0.11 | 0.04 |
| S2 | 중복 | 동일 className 2개 | ❌ 오편집 | ✅ 정확 | 0 | 0 | 0.10 | 0.03 |
| S3 | 동적 className | 템플릿 리터럴 + 보간 | ⏸ 포기 | ✅ 정확 | 0 | 0 | 0.29 | 0.04 |
| S4 | 동적 className | cn() 호출 | ⏸ 포기 | ✅ 정확 | 0 | 0 | 0.23 | 0.04 |
| S5 | 포맷 | 여러 줄 속성 | ✅ 정확 | ✅ 정확 | 0 | 0 | 0.13 | 0.03 |
| S6 | 브레이크포인트 | 반응형 h-32 md:h-48 lg:h-64 | ❌ 오편집 | ✅ 정확 | 0 | 0 | 0.14 | 0.03 |
| S7 | 반복 렌더 | .map() 안의 항목 | ✅ 정확 | ✅ 정확 | 0 | 0 | 0.19 | 0.04 |
| S8 | 위치 이동 | flex 자식 이동 (12px) | ❌ 오편집 | ✅ 정확 | 1 | 0 | 0.18 | 0.03 |
| S9 | 포맷 | 단일 따옴표 className | ✅ 정확 | ✅ 정확 | 0 | 0 | 0.19 | 0.03 |
| S10 | 혼합 | prop className 형제 옆의 정적 요소 | ✅ 정확 | ✅ 정확 | 0 | 0 | 0.03 | 0.03 |

## 상세

### S1 — 고유 className · 정적
- 기대: `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-4` — h-48(192px) → h-64(256px)
- A: 정확 → `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-4`
  - tailwind · 높이: h-48 → h-64
- B: 정확 → `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-4`
  - string · h-48 → h-64

### S2 — 동일 className 2개
- 기대: `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-5` — 두 번째 카드만 바뀌어야 한다
- A: 틀림 → `flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-5`
  - tailwind · 높이: h-48 → h-64
- B: 정확 → `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-5`
  - string · h-48 → h-64

### S3 — 템플릿 리터럴 + 보간
- 기대: `flex flex-col h-64 w-64 rounded-lg p-4` — 정적 부분의 h-48만 교체. 보간은 보존
- A: 포기 → `—`
  - 현행은 실패 사유를 사용자에게 알리지 않고 조용히 넘어간다
- B: 정확 → `flex flex-col h-64 w-64 rounded-lg p-4`
  - template · h-48 → h-64

### S4 — cn() 호출
- 기대: `flex flex-col h-64 w-64 rounded-lg p-8` — cn() 첫 인자 문자열 안의 h-48만 교체. 조건부 인자는 보존
- A: 포기 → `—`
  - 현행은 실패 사유를 사용자에게 알리지 않고 조용히 넘어간다
- B: 정확 → `flex flex-col h-64 w-64 rounded-lg p-8`
  - call · h-48 → h-64

### S5 — 여러 줄 속성
- 기대: `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-4 shadow-md transition-colors hover:bg-gray-700` — 줄바꿈 포맷을 보존하며 h-48만 교체
- A: 정확 → `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-4 shadow-md transition-colors hover:bg-gray-700`
  - tailwind · 높이: h-48 → h-64
- B: 정확 → `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-4 shadow-md transition-colors hover:bg-gray-700`
  - string · h-48 → h-64

### S6 — 반응형 h-32 md:h-48 lg:h-64
- 기대: `flex flex-col h-32 md:h-48 lg:h-80 w-full rounded-lg bg-gray-800 p-4` — lg 활성 → lg:h-64만 lg:h-80으로. base/md는 불변
- A: 틀림 → `flex flex-col h-80 md:h-48 lg:h-64 w-full rounded-lg bg-gray-800 p-4`
  - tailwind · 높이: h-32 → h-80
- B: 정확 → `flex flex-col h-32 md:h-48 lg:h-80 w-full rounded-lg bg-gray-800 p-4`
  - string · lg:h-64 → lg:h-80

### S7 — .map() 안의 항목
- 기대: `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-6` — 크기 변경은 전체 항목에 적용되는 게 맞다 (순서 변경과 달리 배열 무관)
- A: 정확 → `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-6`
  - tailwind · 높이: h-48 → h-64
- B: 정확 → `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-6`
  - string · h-48 → h-64

### S8 — flex 자식 이동 (12px)
- 기대: `block rounded px-3 py-2 text-gray-300 mt-3` — 12px → mt-3 (스케일 정확히 일치). 임의값 금지
- A: 틀림 → `block rounded px-3 py-2 text-gray-300`
  - tailwind · 마진 추가: mt-[12px]
  - 오염: 임의값: mt-[12px]
- B: 정확 → `block rounded px-3 py-2 text-gray-300 mt-3`
  - string · + mt-3

### S9 — 단일 따옴표 className
- 기대: `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-3` — 따옴표 스타일을 보존하며 교체
- A: 정확 → `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-3`
  - tailwind · 높이: h-48 → h-64
- B: 정확 → `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-3`
  - string · h-48 → h-64

### S10 — prop className 형제 옆의 정적 요소
- 기대: `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-2` — 같은 파일에 표현식 className이 있어도 정적 요소는 정확히 찾아야 함
- A: 정확 → `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-2`
  - tailwind · 높이: h-48 → h-64
- B: 정확 → `flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-2`
  - string · h-48 → h-64
