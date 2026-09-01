/**
 * wigss 커스텀 JSX 개발 런타임 (P1 · 주소 생산).
 *
 * React는 개발 모드에서 JSX를 jsxDEV(type, props, key, isStatic, source, self)로
 * 컴파일하며 source에 { fileName, lineNumber, columnNumber }를 담는다.
 * 이 래퍼는 그 값을 DOM 요소에 data-wigss="file:line:col"로 꺼내 준다.
 *
 * - DOM 요소(type이 문자열)에만 붙는다. 컴포넌트는 건드리지 않는다.
 * - 프로덕션 빌드는 jsxDEV를 쓰지 않으므로 이 파일 자체가 로드되지 않는다.
 * - 사용: 대상 프로젝트 tsconfig에  "jsxImportSource": "wigss"  한 줄.
 */
import { jsxDEV as reactJsxDEV, Fragment } from 'react/jsx-dev-runtime';

export { Fragment };

export function jsxDEV(type, props, key, isStaticChildren, source, self) {
  if (typeof type === 'string' && source && source.fileName) {
    props = {
      ...(props || {}),
      'data-wigss': `${source.fileName}:${source.lineNumber}:${source.columnNumber}`,
    };
  }
  return reactJsxDEV(type, props, key, isStaticChildren, source, self);
}
