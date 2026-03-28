# README.md 작성 베스트 프랙티스

> npx one-shot 실행형 CLI 도구 기준

---

## 핵심 원칙

README는 프로젝트의 **랜딩 페이지**다. 방문자는 처음 10초 안에 세 가지 질문에 답을 얻어야 한다.

1. **What** — 이 도구가 뭘 하는가?
2. **Why** — 내가 왜 써야 하는가?
3. **How** — 어떻게 바로 쓸 수 있는가?

이 세 질문에 즉시 답하지 못하면 사람들은 떠난다.

---

## 섹션 구성 (권장 순서)

### 1. Header — 첫인상 (가장 중요)

**포함할 것:**
- 프로젝트 로고 또는 이름
- 한 줄 설명 (tagline) — "무엇을 하는 도구인가"를 동사로 시작
- 배지 (npm version, license, CI 상태)
- 터미널 데모 GIF 또는 스크린샷

**✅ 좋은 예:**
```md
# toolname

> Instantly find and delete unused node_modules folders.

[![npm](https://img.shields.io/npm/v/toolname)](https://npmjs.com/package/toolname)
[![license](https://img.shields.io/npm/l/toolname)](./LICENSE)

![demo](./demo.gif)
```

**❌ 나쁜 예:**
```md
# My Tool
This is a tool I made. It does some things.
```

> **핵심:** 데모 GIF 한 장이 긴 설명 10줄보다 낫다.
> npx one-shot 도구는 "실행하면 뭔가 바로 일어난다"는 것을 **눈으로** 보여줘야 한다.

---

### 2. Quick Start — 진입 장벽 제거

방문자가 README를 읽은 후 **30초 안에 실행할 수 있어야** 한다.
npx 도구는 설치가 필요 없으므로 이게 특히 강점이다. 적극적으로 활용할 것.

```md
## Quick Start

npx your-tool@latest
```

**다중 패키지 매니저 지원 시 (create-vite 패턴):**
```md
## Quick Start

npx your-tool@latest
# or
yarn dlx your-tool
# or
pnpm dlx your-tool
```

> **`@latest` 명시는 필수다.** 글로벌 캐시된 구버전이 실행되는 것을 방지한다.

---

### 3. Installation — 전역 설치 안내 (선택)

one-shot 도구라도 자주 쓴다면 전역 설치를 원하는 사용자가 있다.

```md
## Installation

### Without installing (recommended)
npx your-tool@latest

### Global install
npm install -g your-tool
your-tool --help
```

> **주의 문구 포함 권장:**
> ```md
> > If you've previously installed `your-tool` globally,
> > run `npm uninstall -g your-tool` first to ensure npx always uses the latest version.
> ```

---

### 4. Usage — 실제 사용법

옵션/플래그는 **테이블**로, 예시는 **코드 블록**으로.

```md
## Usage

your-tool [options]

| Flag         | Default | Description              |
|--------------|---------|--------------------------|
| `--dry-run`  | false   | Preview without changes  |
| `--verbose`  | false   | Show detailed output     |
| `--help`     | —       | Show help                |
```

**예제는 현실적인 시나리오로:**
```md
### Examples

# Basic usage
npx your-tool@latest

# Preview mode (no changes made)
npx your-tool@latest --dry-run

# With verbose output
npx your-tool@latest --verbose
```

> 예제는 "복붙해서 바로 쓸 수 있는" 형태로 작성한다.
> 플레이스홀더(`<YOUR_VALUE>`)를 남발하지 말 것 — 실제 값으로 채운 예시가 훨씬 유용하다.

---

### 5. How It Works — 내부 동작 (선택)

도구의 신뢰성을 높이는 섹션. 복잡한 동작이 있을 때 특히 중요하다.

```md
## How It Works

1. Scans the current directory for `node_modules` folders
2. Calculates their total size
3. Prompts you to select which ones to delete
4. Removes selected folders
```

> 긴 설명이 필요하다면 별도 문서로 분리하고 링크만 걸어라.

---

### 6. Configuration — 설정 (해당 시)

설정 파일이 있다면 **기본값**을 명시하고, **우선순위**를 설명한다.

```md
## Configuration

Config is resolved in the following order:
1. `--config` flag
2. `your-tool.config.js` in project root
3. `your-tool` key in `package.json`
```

> 환경변수는 별도 테이블로 정리한다.

---

### 7. Contributing — 기여 안내

```md
## Contributing

Pull requests are welcome!
See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.
```

> Contributing 내용이 길면 반드시 `CONTRIBUTING.md`로 분리한다.
> GitHub는 이 파일이 있으면 PR/Issue 생성 시 자동으로 링크를 표시해준다.

---

### 8. License

```md
## License

[MIT](./LICENSE) © Your Name
```

> 라이선스 전문을 README에 붙여넣지 말 것. 한 줄 + LICENSE 파일 링크로 충분하다.

---

## 자주 하는 실수

| 실수 | 이유 | 대안 |
|---|---|---|
| 설명 없는 제목만 있음 | "뭘 하는 도구인지" 모름 | tagline 한 줄 필수 |
| 설치부터 시작 | 진입 장벽이 높아짐 | Quick Start를 앞으로 |
| `@latest` 없이 npx | 캐시된 구버전 실행 위험 | 항상 `@latest` 명시 |
| 데모 없음 | 눈으로 확인 불가 | 터미널 GIF 추가 |
| 플래그 설명이 산문 | 찾기 어려움 | 테이블로 정리 |
| 빈 섹션 포함 | 미완성으로 보임 | 없으면 섹션 자체를 삭제 |
| 오래된 내용 방치 | 신뢰 하락 | 릴리즈마다 README 함께 업데이트 |
| 라이선스 전문 삽입 | 가독성 저하 | LICENSE 파일 + 한 줄 링크 |

---

## 배지 선택 가이드

배지는 **정보를 전달하는 것**만 사용한다. 장식용 배지는 오히려 노이즈다.

**npx one-shot 도구에 권장하는 배지:**

```md
[![npm version](https://img.shields.io/npm/v/your-tool?style=flat-square)](https://npmjs.com/package/your-tool)
[![npm downloads](https://img.shields.io/npm/dm/your-tool?style=flat-square)](https://npmjs.com/package/your-tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/org/repo/ci.yml?style=flat-square&label=CI)](https://github.com/org/repo/actions)
```

**피해야 하는 배지:**
- 항상 passing인 무의미한 배지
- 4개 이상의 배지 줄바꿈 없이 나열
- 스타일 통일 안 된 배지 혼용

---

## 터미널 GIF 제작 도구

one-shot 도구 README에서 GIF는 선택이 아니라 **거의 필수**다.

| 도구 | URL | 특징 |
|---|---|---|
| **vhs** | https://github.com/charmbracelet/vhs | 코드(.tape 파일)로 GIF 생성, 재현 가능 |
| **asciinema** | https://asciinema.org | 녹화 후 SVG 변환, 용량 가벼움 |
| **terminalizer** | https://github.com/faressoft/terminalizer | 로컬 녹화 후 GIF 렌더링 |

> `vhs`를 가장 추천한다. `.tape` 파일로 선언적으로 작성하므로 나중에 수정이 쉽다.

---

## 길이와 톤

- **길이:** 너무 짧은 것보다 길어도 괜찮다. 단, 섹션이 없다면 만들지 않는다.
- **톤:** 친절하되 전문적으로. "Hey guys lol" 같은 표현은 신뢰를 깎는다.
- **언어:** 영어 README를 기본으로 하되, 필요하면 다국어 링크를 헤더에 추가한다.
- **업데이트:** 코드 변경 시 README도 함께 업데이트한다. 오래된 README는 없는 것보다 나쁠 수 있다.

---

## 레퍼런스

- https://www.makeareadme.com — README 작성 종합 가이드
- https://github.com/jehna/readme-best-practices — 복붙 가능한 베스트 프랙티스 템플릿
- https://github.com/badges/shields — shields.io 배지 공식 문서
- https://github.com/charmbracelet/vhs — 터미널 GIF 생성 도구
