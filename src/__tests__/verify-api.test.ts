import { describe, it, expect } from 'vitest';
import { POST } from '../app/api/verify/route';
import { NextRequest } from 'next/server';
import type { FidelityExpectation } from '../types';

function mkRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/verify'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/verify', () => {
  it('returns passed=true when actual boxes match expectations within tolerance', async () => {
    const expectations: FidelityExpectation[] = [
      { componentId: 'c1', expectedStyles: { width: '320px' }, sourceFile: 'x.tsx' },
    ];
    const req = mkRequest({
      expectations,
      priorBoxes: { c1: { x: 0, y: 0, width: 100, height: 100 } },
      actualBoxes: { c1: { x: 0, y: 0, width: 320, height: 100 } },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.passed).toBe(true);
    expect(json.data.reports).toHaveLength(1);
    expect(json.data.reports[0].mismatches).toEqual([]);
  });

  it('reports mismatches when actual drift exceeds tolerance', async () => {
    const expectations: FidelityExpectation[] = [
      { componentId: 'c1', expectedStyles: { height: '256px' }, sourceFile: 'x.tsx' },
    ];
    const req = mkRequest({
      expectations,
      priorBoxes: { c1: { x: 0, y: 0, width: 100, height: 100 } },
      actualBoxes: { c1: { x: 0, y: 0, width: 100, height: 200 } },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.passed).toBe(false);
    expect(json.data.reports[0].mismatches).toHaveLength(1);
    expect(json.data.reports[0].mismatches[0].property).toBe('height');
  });

  it('flags missing actual measurements as fidelity failure', async () => {
    const expectations: FidelityExpectation[] = [
      { componentId: 'c1', expectedStyles: { width: '200px' }, sourceFile: 'x.tsx' },
    ];
    const req = mkRequest({
      expectations,
      priorBoxes: { c1: { x: 0, y: 0, width: 100, height: 100 } },
      actualBoxes: {}, // missing
    });
    const res = await POST(req);
    const json = await res.json();

    expect(json.data.passed).toBe(false);
    expect(json.data.reports[0].mismatches[0].property).toBe('__measurement__');
  });

  it('rejects request without expectations array', async () => {
    const req = mkRequest({
      priorBoxes: {},
      actualBoxes: {},
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('INVALID_INPUT');
  });

  it('rejects request with missing bbox records', async () => {
    const req = mkRequest({
      expectations: [],
      priorBoxes: {},
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.code).toBe('INVALID_INPUT');
  });

  it('aggregates multiple components', async () => {
    const req = mkRequest({
      expectations: [
        { componentId: 'c1', expectedStyles: { width: '200px' }, sourceFile: 'a.tsx' },
        { componentId: 'c2', expectedStyles: { height: '100px' }, sourceFile: 'b.tsx' },
      ],
      priorBoxes: {
        c1: { x: 0, y: 0, width: 100, height: 100 },
        c2: { x: 0, y: 0, width: 100, height: 50 },
      },
      actualBoxes: {
        c1: { x: 0, y: 0, width: 200, height: 100 },
        c2: { x: 0, y: 0, width: 100, height: 100 },
      },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.data.passed).toBe(true);
    expect(json.data.reports).toHaveLength(2);
  });
});
