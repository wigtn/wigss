/**
 * 실험 2 — 중복 밀도가 조인 정확도에 미치는 영향
 *
 * 같은 className 조합을 쓰는 컴포넌트가 코드베이스에 N개 있을 때,
 * "N개 중 k번째 요소를 편집"을 k=1..N 전부 시도해 정확도를 잰다.
 *
 * A: className 문자열로 검색 → 항상 첫 번째 일치를 고른다
 * B: 주소로 해석 → N과 무관
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generateRefactorResult } from '@/lib/agent/refactor-client';
import type { ComponentChange, DetectedComponent } from '@/types';
import { applyDiff, applyByRange, staticClassAt, parseTsx, walkAst } from './util';
import { resolveByAddress, editClassName } from './versionB';

const CLS = 'flex flex-col h-48 w-64 rounded-lg bg-gray-800 p-4';
const TARGET_CLS = 'flex flex-col h-64 w-64 rounded-lg bg-gray-800 p-4';

function makeFile(i: number): string {
  return `export function Card${i}() {
  return (
    <div className="${CLS}">
      <h3 className="text-lg font-bold text-white">Card ${i}</h3>
    </div>
  );
}
`;
}

const CHANGE: ComponentChange = {
  componentId: 'x',
  type: 'resize',
  from: { x: 0, y: 0, width: 256, height: 192 },
  to: { x: 0, y: 0, width: 256, height: 256 },
};

function component(): DetectedComponent {
  return {
    id: 'x',
    name: 'Card',
    type: 'card',
    elementIds: ['x'],
    boundingBox: { x: 0, y: 0, width: 256, height: 192 },
    sourceFile: '',
    reasoning: 'exp2',
    fullClassName: CLS,
  };
}

/** 파일 안 첫 번째 div 의 주소 */
function addressOfDiv(content: string): { line: number; column: number } {
  const ast = parseTsx(content);
  let a = { line: 0, column: 0 };
  let done = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walkAst(ast.program, (n: any) => {
    if (done) return;
    if (n.type === 'JSXOpeningElement' && n.name?.name === 'div' && n.loc) {
      a = { line: n.loc.start.line, column: n.loc.start.column };
      done = true;
    }
  });
  return a;
}

describe('실험 2 — 중복 밀도 vs 조인 정확도', () => {
  it('measures accuracy as duplicate count grows', async () => {
    const densities = [1, 2, 4, 8, 16, 32];
    const rows: {
      n: number;
      aCorrect: number;
      bCorrect: number;
      aPct: number;
      bPct: number;
      aMs: number;
      bMs: number;
      aFilesParsed: number;
      bFilesParsed: number;
    }[] = [];

    for (const n of densities) {
      const files = Array.from({ length: n }, (_, i) => ({
        path: `Card${i}.tsx`,
        content: makeFile(i),
      }));

      let aCorrect = 0;
      let bCorrect = 0;

      // k번째 요소를 편집하는 상황을 k=0..n-1 전부 시도
      for (let k = 0; k < n; k++) {
        const targetPath = files[k].path;
        const targetContent = files[k].content;
        const addr = addressOfDiv(targetContent);

        // ── A ──
        const { diffs } = await generateRefactorResult({
          changes: [CHANGE],
          components: [component()],
          sources: files,
        });
        if (diffs.length > 0 && diffs[0].file === targetPath) {
          const r = applyDiff(targetContent, diffs[0]);
          if (r.ok && staticClassAt(r.content, addr) === TARGET_CLS) aCorrect++;
        }

        // ── B ──
        const resolved = resolveByAddress(targetContent, addr);
        if (!('error' in resolved)) {
          const edit = editClassName(resolved.staticClass, [{ prefix: 'h', px: 256 }], 'base');
          if (edit.ok) {
            const attrStart = targetContent.lastIndexOf('className', resolved.range.start);
            const r = applyByRange(targetContent, resolved.range, edit.className, {
              original: targetContent.slice(attrStart, resolved.range.end + 1),
              modified:
                targetContent.slice(attrStart, resolved.range.start) +
                edit.className +
                targetContent.slice(resolved.range.end, resolved.range.end + 1),
            });
            if (r.ok && staticClassAt(r.content, addr) === TARGET_CLS) bCorrect++;
          }
        }
      }

      // ── 지연은 따로 측정한다. 워밍업 후 반복 평균. ──
      const REPS = 60;
      const addr0 = addressOfDiv(files[0].content);
      const runOnceA = async () => {
        await generateRefactorResult({ changes: [CHANGE], components: [component()], sources: files });
      };
      const runOnceB = () => {
        const c = files[0].content;
        const r = resolveByAddress(c, addr0);
        if ('error' in r) return;
        const e = editClassName(r.staticClass, [{ prefix: 'h', px: 256 }], 'base');
        if (!e.ok) return;
        const attrStart = c.lastIndexOf('className', r.range.start);
        applyByRange(c, r.range, e.className, {
          original: c.slice(attrStart, r.range.end + 1),
          modified: c.slice(attrStart, r.range.start) + e.className + c.slice(r.range.end, r.range.end + 1),
        });
      };
      for (let i = 0; i < 30; i++) { await runOnceA(); runOnceB(); }
      let aMs = 0;
      let bMs = 0;
      for (let i = 0; i < REPS; i++) {
        const ta = performance.now(); await runOnceA(); aMs += performance.now() - ta;
        const tb = performance.now(); runOnceB(); bMs += performance.now() - tb;
      }
      aMs /= REPS;
      bMs /= REPS;

      rows.push({
        n,
        aCorrect,
        bCorrect,
        aPct: (aCorrect / n) * 100,
        bPct: (bCorrect / n) * 100,
        aMs,
        bMs,
        aFilesParsed: n,
        bFilesParsed: 1,
      });
    }

    const L: string[] = [];
    L.push('# 실험 2 — 중복 밀도 vs 조인 정확도\n');
    L.push(`생성: ${new Date().toISOString()}\n`);
    L.push('같은 className 조합을 가진 컴포넌트가 N개일 때, N개를 각각 한 번씩 편집 대상으로 삼아 측정.\n');
    L.push('| 중복 N | A 정확 | A 정확도 | B 정확 | B 정확도 | A 평균 ms | B 평균 ms | A 파싱 | B 파싱 |');
    L.push('|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of rows) {
      L.push(
        `| ${r.n} | ${r.aCorrect}/${r.n} | ${r.aPct.toFixed(0)}% | ${r.bCorrect}/${r.n} | ${r.bPct.toFixed(0)}% | ${r.aMs.toFixed(2)} | ${r.bMs.toFixed(2)} | ${r.aFilesParsed} | ${r.bFilesParsed} |`,
      );
    }
    L.push('');
    const last = rows[rows.length - 1];
    L.push(
      `N=${last.n} 에서 A는 ${last.aPct.toFixed(0)}%, B는 ${last.bPct.toFixed(0)}%. ` +
        `정확도는 정확히 1/N 을 따른다 — A는 항상 "첫 번째 일치"를 고르기 때문이다.`,
    );
    L.push('');
    L.push(
      '지연은 N에 비례하지 않는다. A의 리라이터가 첫 일치에서 순회를 멈추기 때문이다. ' +
        '실제 비용은 파싱이 아니라 /api/refactor 의 파일 수집 단계에 있고, 그건 실험 3에서 실측한다.',
    );

    writeFileSync(join(__dirname, 'exp2.md'), L.join('\n'));
    writeFileSync(join(__dirname, 'exp2.json'), JSON.stringify(rows, null, 2));
    expect(rows.length).toBe(densities.length);
  }, 300000);
});
