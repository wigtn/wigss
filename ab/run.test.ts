/**
 * A/B 실행기. 모든 시나리오를 A와 B로 각각 돌리고 결과를 파일로 남긴다.
 *   pnpm exec vitest run ab/run.test.ts
 * 산출물: ab/results.json, ab/results.md
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { SCENARIOS } from './scenarios';
import { runA, type RunResult } from './versionA';
import { runB } from './versionB';

const REPS = 20; // 지연 측정용 반복

function summarize(rows: RunResult[]) {
  const n = rows.length;
  const correct = rows.filter((r) => r.correct).length;
  const resolved = rows.filter((r) => r.resolved).length;
  const wrongWrite = rows.filter((r) => r.applied && !r.correct).length;
  const silentFail = rows.filter((r) => r.abandoned && !r.abandonReason?.includes('→')).length;
  const reported = rows.filter((r) => r.abandoned && !!r.abandonReason).length;
  const pollution = rows.reduce((a, r) => a + r.pollution, 0);
  const polluted = rows.filter((r) => r.pollution > 0).length;
  const ms = rows.reduce((a, r) => a + r.elapsedMs, 0) / n;
  const filesRead = rows.reduce((a, r) => a + r.filesRead, 0) / n;
  const filesParsed = rows.reduce((a, r) => a + r.filesParsed, 0) / n;
  return {
    n,
    correct,
    correctPct: (correct / n) * 100,
    resolved,
    resolvedPct: (resolved / n) * 100,
    wrongWrite,
    silentFail,
    reported,
    pollution,
    polluted,
    avgMs: ms,
    avgFilesRead: filesRead,
    avgFilesParsed: filesParsed,
  };
}

describe('A/B: 현행 파이프라인 vs 개선안 프로토타입', () => {
  it('runs all scenarios and writes a report', async () => {
    const aRows: RunResult[] = [];
    const bRows: RunResult[] = [];

    for (const s of SCENARIOS) {
      aRows.push(await runA(s));
      bRows.push(await runB(s));
    }

    // 지연은 별도로 반복 측정 (첫 회 JIT 편향 제거)
    const latency: Record<string, { a: number; b: number }> = {};
    for (const s of SCENARIOS) {
      await runA(s);
      await runB(s);
      let ta = 0;
      let tb = 0;
      for (let i = 0; i < REPS; i++) {
        ta += (await runA(s)).elapsedMs;
        tb += (await runB(s)).elapsedMs;
      }
      latency[s.id] = { a: ta / REPS, b: tb / REPS };
    }
    aRows.forEach((r) => (r.elapsedMs = latency[r.scenario].a));
    bRows.forEach((r) => (r.elapsedMs = latency[r.scenario].b));

    const sumA = summarize(aRows);
    const sumB = summarize(bRows);

    writeFileSync(
      join(__dirname, 'results.json'),
      JSON.stringify(
        { generatedAt: new Date().toISOString(), reps: REPS, scenarios: SCENARIOS, aRows, bRows, sumA, sumB },
        null,
        2,
      ),
    );

    // ── 사람이 읽는 표 ───────────────────────────────────────────────
    const L: string[] = [];
    L.push('# A/B 결과\n');
    L.push(`생성: ${new Date().toISOString()} · 지연 반복 ${REPS}회\n`);

    L.push('## 요약\n');
    L.push('| 지표 | A (현행) | B (개선안) | 변화 |');
    L.push('|---|---:|---:|---|');
    const row = (k: string, a: string, b: string, d: string) => L.push(`| ${k} | ${a} | ${b} | ${d} |`);
    row('편집 정확도', `${sumA.correct}/${sumA.n} (${sumA.correctPct.toFixed(0)}%)`,
        `${sumB.correct}/${sumB.n} (${sumB.correctPct.toFixed(0)}%)`,
        `+${(sumB.correctPct - sumA.correctPct).toFixed(0)}pp`);
    row('대상 해석 성공', `${sumA.resolved}/${sumA.n} (${sumA.resolvedPct.toFixed(0)}%)`,
        `${sumB.resolved}/${sumB.n} (${sumB.resolvedPct.toFixed(0)}%)`,
        `+${(sumB.resolvedPct - sumA.resolvedPct).toFixed(0)}pp`);
    row('**오편집** (썼는데 틀림)', `${sumA.wrongWrite}건`, `${sumB.wrongWrite}건`,
        `${sumB.wrongWrite - sumA.wrongWrite}건`);
    row('오염 발생 시나리오', `${sumA.polluted}건`, `${sumB.polluted}건`, `${sumB.polluted - sumA.polluted}건`);
    row('오염 총 건수', `${sumA.pollution}`, `${sumB.pollution}`, `${sumB.pollution - sumA.pollution}`);
    row('사유 보고된 포기', `${sumA.reported}건`, `${sumB.reported}건`, `+${sumB.reported - sumA.reported}건`);
    row('평균 지연', `${sumA.avgMs.toFixed(2)} ms`, `${sumB.avgMs.toFixed(2)} ms`,
        `${(sumA.avgMs / Math.max(sumB.avgMs, 0.0001)).toFixed(1)}× 빠름`);
    row('평균 읽은 파일', `${sumA.avgFilesRead.toFixed(1)}개`, `${sumB.avgFilesRead.toFixed(1)}개`,
        `${(sumA.avgFilesRead / sumB.avgFilesRead).toFixed(0)}× 감소`);
    row('평균 파싱 파일', `${sumA.avgFilesParsed.toFixed(1)}개`, `${sumB.avgFilesParsed.toFixed(1)}개`,
        `${(sumA.avgFilesParsed / sumB.avgFilesParsed).toFixed(0)}× 감소`);

    L.push('\n## 시나리오별\n');
    L.push('| # | 패턴 | 시나리오 | A 결과 | B 결과 | A 오염 | B 오염 | A ms | B ms |');
    L.push('|---|---|---|---|---|---:|---:|---:|---:|');
    SCENARIOS.forEach((s, i) => {
      const a = aRows[i];
      const b = bRows[i];
      const mark = (r: RunResult) =>
        r.correct ? '✅ 정확' : r.abandoned ? '⏸ 포기' : r.applied ? '❌ 오편집' : '⚠ 미적용';
      L.push(
        `| ${s.id} | ${s.pattern} | ${s.label} | ${mark(a)} | ${mark(b)} | ${a.pollution} | ${b.pollution} | ${a.elapsedMs.toFixed(2)} | ${b.elapsedMs.toFixed(2)} |`,
      );
    });

    L.push('\n## 상세\n');
    SCENARIOS.forEach((s, i) => {
      const a = aRows[i];
      const b = bRows[i];
      L.push(`### ${s.id} — ${s.label}`);
      L.push(`- 기대: \`${s.expect.className ?? '(포기해야 함)'}\` — ${s.expect.reason}`);
      L.push(`- A: ${a.correct ? '정확' : a.abandoned ? '포기' : '틀림'} → \`${a.finalClassName || '—'}\``);
      L.push(`  - ${a.note}`);
      if (a.pollutionDetail.length) L.push(`  - 오염: ${a.pollutionDetail.join(' / ')}`);
      L.push(`- B: ${b.correct ? '정확' : b.abandoned ? '포기' : '틀림'} → \`${b.finalClassName || '—'}\``);
      L.push(`  - ${b.note}`);
      if (b.pollutionDetail.length) L.push(`  - 오염: ${b.pollutionDetail.join(' / ')}`);
      L.push('');
    });

    writeFileSync(join(__dirname, 'results.md'), L.join('\n'));
    expect(aRows.length).toBe(SCENARIOS.length);
    expect(bRows.length).toBe(SCENARIOS.length);
  }, 120000);
});
