/**
 * Version A — 현행 wigss v0.2.0 파이프라인.
 *
 * 실제 출하 코드를 그대로 호출한다. 재구현하지 않는다.
 *   generateRefactorResult()  →  refactor-client → intent-adapter → dispatcher → rewriters
 * 그리고 /api/refactor 가 하듯 프로젝트의 모든 소스 파일을 넘긴다.
 */
import type { ComponentChange, DetectedComponent } from '@/types';
import { generateRefactorResult } from '@/lib/agent/refactor-client';
import { loadAllSources, applyDiff, staticClassAt, filePollution, type SourceInput } from './util';
import type { Scenario } from './scenarios';

export type RunResult = {
  version: 'A' | 'B';
  scenario: string;
  /** 소스에서 대상을 찾았는가 */
  resolved: boolean;
  /** diff 를 만들었는가 */
  produced: boolean;
  /** apply 안전장치를 통과했는가 */
  applied: boolean;
  /** 최종 className (적용 후) */
  finalClassName: string;
  /** 기대와 일치하는가 */
  correct: boolean;
  /** 의도적으로 포기했는가 (정직한 실패) */
  abandoned: boolean;
  abandonReason?: string;
  /** 오염 건수 */
  pollution: number;
  pollutionDetail: string[];
  /** 읽은 파일 수 */
  filesRead: number;
  /** 파싱한 파일 수 (추정: 리라이터가 순회한 tsx 개수) */
  filesParsed: number;
  elapsedMs: number;
  note: string;
};

function toChange(s: Scenario): ComponentChange {
  if (s.gesture.type === 'resize') {
    return {
      componentId: s.id,
      type: 'resize',
      from: { x: 0, y: 0, width: s.gesture.from.width, height: s.gesture.from.height },
      to: { x: 0, y: 0, width: s.gesture.to.width, height: s.gesture.to.height },
    };
  }
  return {
    componentId: s.id,
    type: 'move',
    from: { x: s.gesture.from.x, y: s.gesture.from.y, width: 200, height: 40 },
    to: { x: s.gesture.to.x, y: s.gesture.to.y, width: 200, height: 40 },
  };
}

/**
 * 현행 스캐너가 만들어내는 DetectedComponent 를 재현한다.
 * component-detector.inferSourceFile 은 data-component 가 없으면 '' 를 돌려주므로
 * 일반 프로젝트에서 sourceFile 은 비어 있고, 조인은 fullClassName 문자열에만 의존한다.
 */
function toComponent(s: Scenario): DetectedComponent {
  const box =
    s.gesture.type === 'resize'
      ? { x: 0, y: 0, width: s.gesture.from.width, height: s.gesture.from.height }
      : { x: s.gesture.from.x, y: s.gesture.from.y, width: 200, height: 40 };
  return {
    id: s.id,
    name: s.id,
    type: 'card',
    elementIds: [s.id],
    boundingBox: box,
    sourceFile: '', // ← 실제 스캐너의 결과. data-component 가 없으면 비어 있다.
    reasoning: 'ab-harness',
    fullClassName: s.runtimeClassName,
  };
}

export async function runA(s: Scenario): Promise<RunResult> {
  const sources: SourceInput[] = loadAllSources();
  const target = sources.find((x) => x.path === s.file)!;
  const before = target.content;

  const t0 = performance.now();
  const { diffs } = await generateRefactorResult({
    changes: [toChange(s)],
    components: [toComponent(s)],
    sources,
  });
  const elapsedMs = performance.now() - t0;

  const base = {
    version: 'A' as const,
    scenario: s.id,
    filesRead: sources.length,
    filesParsed: sources.filter((x) => x.path.endsWith('.tsx')).length,
    elapsedMs,
  };

  if (diffs.length === 0) {
    return {
      ...base,
      resolved: false,
      produced: false,
      applied: false,
      finalClassName: '',
      correct: s.expect.className === null,
      abandoned: true,
      abandonReason: 'diff 생성 실패 (사유 미보고)',
      pollution: 0,
      pollutionDetail: [],
      note: '현행은 실패 사유를 사용자에게 알리지 않고 조용히 넘어간다',
    };
  }

  const diff = diffs[0];
  const wroteToTargetFile = diff.file === s.file;
  const fileForApply = sources.find((x) => x.path === diff.file)!;
  const res = applyDiff(fileForApply.content, diff);

  if (!res.ok) {
    return {
      ...base,
      resolved: true,
      produced: true,
      applied: false,
      finalClassName: '',
      correct: false,
      abandoned: false,
      pollution: 0,
      pollutionDetail: [],
      note: `apply 거부: ${res.reason}`,
    };
  }

  const after = res.content;
  const finalClassName = wroteToTargetFile ? staticClassAt(after, s.address) : '';
  const correct = s.expect.className !== null && finalClassName === s.expect.className;
  // 오염은 "실제로 수정된 파일"을 기준으로 센다 (엉뚱한 파일을 고쳤어도 오염은 오염)
  const pol = filePollution(fileForApply.content, after);

  return {
    ...base,
    resolved: true,
    produced: true,
    applied: true,
    finalClassName,
    correct,
    abandoned: false,
    pollution: pol.total,
    pollutionDetail: [
      ...pol.duplicateTokens.map((d) => `중복: ${d}`),
      ...pol.arbitraryValues.map((v) => `임의값: ${v}`),
      ...(pol.inlineStyleAdded ? ['인라인 style 주입'] : []),
    ],
    note: wroteToTargetFile
      ? `${diff.strategy} · ${diff.explanation}`
      : `❌ 다른 파일을 수정함: ${diff.file}`,
  };
}
