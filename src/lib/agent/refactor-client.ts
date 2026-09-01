import type {
  CodeDiff,
  ComponentChange,
  DetectedComponent,
  FidelityExpectation,
  SourceInput,
  StyleIntent,
} from '@/types';
import { detectCssStrategy } from '@/lib/css-strategy-detector';
import { changesToIntents } from './intent-adapter';
import { dispatchIntent } from './dispatcher';
import { intentToExpectation } from './verify/fidelity-check';
import { parseAddress, resolveAddressInSource, isResolveFailure } from './address-resolver';
import { opsFromTargetStyles, editClassTokens } from './rewriters/breakpoint-tailwind';

export type { SourceInput };

/** 사유 있는 포기 (PRD D5) — API 가 그대로 실어 UI 가 원인을 보여줄 수 있다 */
export interface RefactorSkip {
  componentId: string;
  reason: string;
}

export interface RefactorInput {
  changes: ComponentChange[];
  components: DetectedComponent[];
  sources: SourceInput[];
  /** P3: 편집 시점 에디터 뷰포트 폭. 지배 토큰 선택에 쓰인다. 미전달 시 1280 */
  viewportWidth?: number;
  /**
   * P3: Tailwind 프로젝트 여부. true 면 주소 경로 실패 시 인라인 폴백 대신
   * 사유 있는 포기(D4) — 리뷰어가 거부할 코드를 남기지 않는다.
   */
  tailwindProject?: boolean;
}

export interface RefactorOutput {
  diffs: CodeDiff[];
  expectations: FidelityExpectation[];
  skipped: RefactorSkip[];
}

/**
 * Generate code diffs for a batch of ComponentChanges.
 * v3(PROD-632): 컴포넌트에 sourceAddress 가 있으면 주소 우선 경로를 탄다.
 */
export async function generateRefactorDiffs(input: RefactorInput): Promise<CodeDiff[]> {
  const { diffs } = await generateRefactorResult(input);
  return diffs;
}

/**
 * 주소 우선 경로 (P2·P3):
 *   sourceAddress → 그 파일의 AST 노드 → 지배 토큰 편집 → range 를 실은 CodeDiff
 *
 * 실패 시:
 *   - Tailwind 프로젝트 → skipped(사유) — 인라인을 새로 만들지 않는다 (D4)
 *   - 그 외 → 기존 디스패치 캐스케이드로 저하 (D6)
 * 주소가 없는 컴포넌트는 기존 경로 그대로다.
 */
export async function generateRefactorResult(input: RefactorInput): Promise<RefactorOutput> {
  const componentMap = new Map<string, DetectedComponent>();
  for (const component of input.components) {
    const enriched: DetectedComponent = {
      ...component,
      cssInfo: component.cssInfo ?? detectCssStrategy(component, input.sources),
    };
    componentMap.set(component.id, enriched);
  }

  const intents: StyleIntent[] = changesToIntents(input.changes, componentMap);
  for (const intent of intents) {
    intent.viewportWidth = input.viewportWidth;
    const address = componentMap.get(intent.componentId)?.sourceAddress;
    if (address && intent.sourceHint) intent.sourceHint.address = address;
    else if (address) intent.sourceHint = { address };
  }

  const diffs: CodeDiff[] = [];
  const expectations: FidelityExpectation[] = [];
  const skipped: RefactorSkip[] = [];
  const failed: StyleIntent[] = [];

  for (const intent of intents) {
    const address = intent.sourceHint?.address;

    if (address) {
      const outcome = addressPathDiff(intent, input.sources, input.viewportWidth);
      if ('diff' in outcome) {
        diffs.push(outcome.diff);
        expectations.push(intentToExpectation(intent, outcome.diff.file));
        continue;
      }
      if (input.tailwindProject) {
        // D4: Tailwind 프로젝트에서는 인라인 폴백으로 내려가지 않는다
        skipped.push({ componentId: intent.componentId, reason: outcome.reason });
        continue;
      }
      // D6: 저하 — 기존 경로에 맡긴다
    }

    const diff = dispatchIntent(intent, input.sources);
    if (diff) {
      diffs.push(diff);
      expectations.push(intentToExpectation(intent, intent.sourceHint?.file ?? diff.file));
    } else {
      failed.push(intent);
      skipped.push({
        componentId: intent.componentId,
        reason: address
          ? '주소 해석과 기존 경로 모두 실패'
          : '대상 소스를 찾지 못함 (className 검색 실패)',
      });
    }
  }

  console.log(`[Refactor] ${diffs.length} diffs generated. ${skipped.length} skipped.`);
  for (const s of skipped) {
    console.log(`[Refactor] Skipped ${s.componentId}: ${s.reason}`);
  }

  return { diffs, expectations, skipped };
}

/** 주소 하나를 range 를 실은 CodeDiff 로. 실패는 사유 문자열로. */
function addressPathDiff(
  intent: StyleIntent,
  sources: SourceInput[],
  viewportWidth?: number,
): { diff: CodeDiff } | { reason: string } {
  const parsed = parseAddress(intent.sourceHint!.address!);
  if (!parsed) return { reason: `주소 형식 오류: ${intent.sourceHint!.address}` };

  const source = sources.find((s) => s.path === parsed.file);
  if (!source) return { reason: `주소의 파일이 소스 목록에 없음: ${parsed.file}` };

  const resolved = resolveAddressInSource(source.content, parsed.line, parsed.column);
  if (isResolveFailure(resolved)) return { reason: resolved.error };

  const { ops, unsupported } = opsFromTargetStyles(intent.targetStyles);
  if (unsupported.length > 0) {
    return { reason: `토큰으로 표현할 수 없는 속성: ${unsupported.join(', ')}` };
  }

  const edit = editClassTokens(resolved.staticClass, ops, viewportWidth);
  if (!edit.ok) return { reason: edit.reason };

  const content = source.content;
  const original = content.slice(resolved.attrStart, resolved.attrEnd);
  const modified =
    content.slice(resolved.attrStart, resolved.valueRange.start) +
    edit.className +
    content.slice(resolved.valueRange.end, resolved.attrEnd);
  if (modified === original) return { reason: '변경 결과가 원본과 동일' };

  return {
    diff: {
      file: source.path,
      original,
      modified,
      lineNumber: resolved.lineNumber,
      explanation: edit.explanation,
      strategy: 'tailwind',
      range: { start: resolved.attrStart, end: resolved.attrEnd },
    },
  };
}
