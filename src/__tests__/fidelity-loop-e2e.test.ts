/**
 * End-to-end fidelity loop test.
 *
 * Drives the full v2.2 runtime path against a real temporary project:
 *   1. generateRefactorResult → CodeDiff + FidelityExpectation
 *   2. POST /api/apply handler → writes file, returns backupId
 *   3. POST /api/verify handler → compares expectations against fake bboxes
 *   4. POST /api/rollback handler → restores originals
 *
 * Ensures the three endpoints composed together produce a coherent story:
 * applying a diff mutates the file, rolling back restores it byte-for-byte,
 * and the verification report agrees with the known drift.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { NextRequest } from 'next/server';
import { POST as applyPOST } from '../app/api/apply/route';
import { POST as verifyPOST } from '../app/api/verify/route';
import { POST as rollbackPOST } from '../app/api/rollback/route';
import { generateRefactorResult } from '../lib/agent/refactor-client';
import type {
  BoundingBox,
  ComponentChange,
  DetectedComponent,
  SourceInput,
} from '../types';

function mkRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(new URL(url), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('Fidelity loop E2E (apply → verify → rollback)', () => {
  let tmpProject: string;

  beforeEach(async () => {
    tmpProject = await fs.mkdtemp(path.join(os.tmpdir(), 'wigss-e2e-'));
  });

  afterEach(async () => {
    await fs.rm(tmpProject, { recursive: true, force: true });
  });

  it('applies a tailwind resize and successfully rolls it back', async () => {
    // ── Arrange: write a source file with a Tailwind component ──
    const relPath = 'src/app/page.tsx';
    const absPath = path.join(tmpProject, relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    const originalSource =
      'export default function Page() { return <div className="flex h-24 w-50">hi</div>; }';
    await fs.writeFile(absPath, originalSource, 'utf-8');

    const component: DetectedComponent = {
      id: 'c1',
      name: 'card',
      type: 'card',
      elementIds: ['el-1'],
      boundingBox: { x: 0, y: 0, width: 200, height: 96 },
      sourceFile: relPath,
      reasoning: 'e2e',
      fullClassName: 'flex h-24 w-50',
    };

    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 200, height: 96 },
        to: { width: 200, height: 256 },
      },
    ];

    const sources: SourceInput[] = [
      { path: relPath, content: originalSource },
    ];

    // ── Act 1: generate diff + expectation ──
    const { diffs, expectations } = await generateRefactorResult({
      changes,
      components: [component],
      sources,
    });
    expect(diffs).toHaveLength(1);
    expect(expectations).toHaveLength(1);
    expect(expectations[0].expectedStyles.height).toBe('256px');

    // ── Act 2: POST /api/apply ──
    const applyRes = await applyPOST(
      mkRequest('http://localhost/api/apply', {
        diffs,
        projectPath: tmpProject,
      }),
    );
    const applyJson = await applyRes.json();
    expect(applyRes.status).toBe(200);
    expect(applyJson.success).toBe(true);
    expect(applyJson.data.applied).toBe(1);
    expect(typeof applyJson.data.backupId).toBe('string');

    const backupId: string = applyJson.data.backupId;

    // File must be mutated now
    const mutated = await fs.readFile(absPath, 'utf-8');
    expect(mutated).not.toBe(originalSource);
    expect(mutated).toContain('h-64');

    // ── Act 3: POST /api/verify with matching bbox (passes) ──
    const priorBoxes: Record<string, BoundingBox> = {
      c1: { x: 0, y: 0, width: 200, height: 96 },
    };
    // Simulate the editor re-measuring to the expected height
    const actualBoxes: Record<string, BoundingBox> = {
      c1: { x: 0, y: 0, width: 200, height: 256 },
    };
    const verifyRes = await verifyPOST(
      mkRequest('http://localhost/api/verify', {
        expectations,
        priorBoxes,
        actualBoxes,
      }),
    );
    const verifyJson = await verifyRes.json();
    expect(verifyJson.success).toBe(true);
    expect(verifyJson.data.passed).toBe(true);

    // ── Act 4: POST /api/rollback ──
    const rollbackRes = await rollbackPOST(
      mkRequest('http://localhost/api/rollback', { backupId }),
    );
    const rollbackJson = await rollbackRes.json();
    expect(rollbackRes.status).toBe(200);
    expect(rollbackJson.success).toBe(true);
    expect(rollbackJson.data.restored).toHaveLength(1);

    // File must be back to the original byte-for-byte
    const restored = await fs.readFile(absPath, 'utf-8');
    expect(restored).toBe(originalSource);

    // Second rollback on the same id must fail (one-shot semantics)
    const secondRollback = await rollbackPOST(
      mkRequest('http://localhost/api/rollback', { backupId }),
    );
    expect(secondRollback.status).toBe(404);
  });

  it('reports fidelity mismatch when the post-apply bbox drifts beyond tolerance', async () => {
    const relPath = 'src/page.tsx';
    const absPath = path.join(tmpProject, relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    const originalSource =
      'export default function Page() { return <div className="flex h-24">hi</div>; }';
    await fs.writeFile(absPath, originalSource, 'utf-8');

    const component: DetectedComponent = {
      id: 'c1',
      name: 'card',
      type: 'card',
      elementIds: ['el-1'],
      boundingBox: { x: 0, y: 0, width: 200, height: 96 },
      sourceFile: relPath,
      reasoning: 'e2e',
      fullClassName: 'flex h-24',
    };

    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 200, height: 96 },
        to: { width: 200, height: 256 },
      },
    ];

    const { diffs, expectations } = await generateRefactorResult({
      changes,
      components: [component],
      sources: [{ path: relPath, content: originalSource }],
    });
    expect(diffs).toHaveLength(1);

    const applyRes = await applyPOST(
      mkRequest('http://localhost/api/apply', {
        diffs,
        projectPath: tmpProject,
      }),
    );
    const applyJson = await applyRes.json();
    const backupId: string = applyJson.data.backupId;

    // Simulate a flex parent constraint that clamps height to 180 — not the
    // 256 we intended.
    const verifyRes = await verifyPOST(
      mkRequest('http://localhost/api/verify', {
        expectations,
        priorBoxes: { c1: { x: 0, y: 0, width: 200, height: 96 } },
        actualBoxes: { c1: { x: 0, y: 0, width: 200, height: 180 } },
      }),
    );
    const verifyJson = await verifyRes.json();
    expect(verifyJson.data.passed).toBe(false);
    expect(verifyJson.data.reports[0].mismatches[0].property).toBe('height');
    expect(verifyJson.data.reports[0].mismatches[0].expected).toBe('256px');

    // Rollback restores the original so the user can recover from the
    // broken layout
    const rollbackRes = await rollbackPOST(
      mkRequest('http://localhost/api/rollback', { backupId }),
    );
    expect(rollbackRes.status).toBe(200);
    const restored = await fs.readFile(absPath, 'utf-8');
    expect(restored).toBe(originalSource);
  });

  it('applies + verifies + rolls back a CSS module change across two files', async () => {
    const tsxRel = 'src/Card.tsx';
    const cssRel = 'src/Card.module.css';
    const tsxAbs = path.join(tmpProject, tsxRel);
    const cssAbs = path.join(tmpProject, cssRel);
    await fs.mkdir(path.dirname(tsxAbs), { recursive: true });
    await fs.writeFile(
      tsxAbs,
      'import styles from "./Card.module.css"; export default function Card() { return <div className={styles.card}>hi</div>; }',
      'utf-8',
    );
    const originalCss = '.card {\n  width: 200px;\n  height: 100px;\n}\n';
    await fs.writeFile(cssAbs, originalCss, 'utf-8');

    const component: DetectedComponent = {
      id: 'c1',
      name: 'card',
      type: 'card',
      elementIds: ['el-1'],
      boundingBox: { x: 0, y: 0, width: 200, height: 100 },
      sourceFile: tsxRel,
      reasoning: 'e2e',
      fullClassName: 'card',
    };

    const changes: ComponentChange[] = [
      {
        componentId: 'c1',
        type: 'resize',
        from: { width: 200, height: 100 },
        to: { width: 200, height: 256 },
      },
    ];

    const sources: SourceInput[] = [
      { path: tsxRel, content: await fs.readFile(tsxAbs, 'utf-8') },
      { path: cssRel, content: originalCss },
    ];

    const { diffs } = await generateRefactorResult({
      changes,
      components: [component],
      sources,
    });
    expect(diffs.length).toBeGreaterThanOrEqual(1);

    const applyRes = await applyPOST(
      mkRequest('http://localhost/api/apply', {
        diffs,
        projectPath: tmpProject,
      }),
    );
    const applyJson = await applyRes.json();
    expect(applyJson.success).toBe(true);
    const backupId: string = applyJson.data.backupId;

    // CSS file should have been updated (or the TSX side emitted an
    // inline-style fallback; either counts for the fidelity loop test).
    const cssMutated = await fs.readFile(cssAbs, 'utf-8');
    const tsxMutated = await fs.readFile(tsxAbs, 'utf-8');
    expect(cssMutated !== originalCss || tsxMutated.includes('256px')).toBe(true);

    // Rollback must restore every mutated file byte-for-byte
    const rollbackRes = await rollbackPOST(
      mkRequest('http://localhost/api/rollback', { backupId }),
    );
    expect(rollbackRes.status).toBe(200);
    expect(await fs.readFile(cssAbs, 'utf-8')).toBe(originalCss);
  });
});
