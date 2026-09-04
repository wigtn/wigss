import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '../app/api/candidates/route';
import { NextRequest } from 'next/server';
import type { ComponentChange, DetectedComponent } from '../types';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

function mkRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/candidates'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * 주소는 선택 필드다. /api/candidates 가 주소에서 얻은 파일만 읽으면, 주소 없는
 * 컴포넌트(주소 부착이 안 된 프로젝트, 프로덕션 빌드)에서 sources 가 비어 own
 * 후보가 스킵된다 — /api/refactor 는 같은 경우 D6 저하 수집으로 내려가므로
 * 드래그 후보만 퇴행하는 셈이다. 여기서는 후보 API 가 같은 수집을 쓰는지 본다.
 */
describe('POST /api/candidates — source collection without an address', () => {
  let tmpDir: string;

  const CARD = `export function Card() {
  return (
    <div className="flex h-48 w-64">
      <span>card</span>
    </div>
  );
}
`;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wigss-candidates-'));
    await fs.mkdir(path.join(tmpDir, 'src', 'components'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'src', 'components', 'Card.tsx'), CARD, 'utf-8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const resize: ComponentChange = {
    componentId: 'c1',
    type: 'resize',
    from: { x: 0, y: 0, width: 256, height: 192 },
    to: { x: 0, y: 0, width: 256, height: 256 }, // h-48 → h-64
  };

  function component(over: Partial<DetectedComponent>): DetectedComponent {
    return {
      id: 'c1',
      name: 'Card',
      type: 'card',
      elementIds: ['el-1'],
      boundingBox: { x: 0, y: 0, width: 256, height: 192 },
      sourceFile: '',
      reasoning: 'test',
      fullClassName: 'flex h-48 w-64',
      ...over,
    };
  }

  async function own(body: unknown) {
    const res = await POST(mkRequest(body));
    const json = await res.json();
    expect(res.status).toBe(200);
    return {
      own: json.data.candidates.find((c: { id: string }) => c.id === 'own'),
      skipped: json.data.skipped as string[],
    };
  }

  it('no address, sourceFile given: reads that file and produces the own candidate', async () => {
    const { own: cand, skipped } = await own({
      change: resize,
      component: component({ sourceFile: 'src/components/Card.tsx' }),
      projectPath: tmpDir,
      viewportWidth: 1280,
    });
    expect(skipped.filter((s) => s.startsWith('own:'))).toEqual([]);
    expect(cand).toBeDefined();
    expect(cand.diffs[0].file).toBe('src/components/Card.tsx');
    expect(cand.diffs[0].modified).toContain('h-64');
  });

  it('no address, no sourceFile: discovers the project files and still produces the own candidate', async () => {
    const { own: cand } = await own({
      change: resize,
      component: component({ sourceFile: '' }),
      projectPath: tmpDir,
      viewportWidth: 1280,
    });
    expect(cand).toBeDefined();
    expect(cand.diffs[0].file).toBe('src/components/Card.tsx');
  });

  it('with an address: the address path still works', async () => {
    const { own: cand } = await own({
      change: resize,
      component: component({
        sourceFile: 'src/components/Card.tsx',
        sourceAddress: 'src/components/Card.tsx:3:5',
      }),
      projectPath: tmpDir,
      viewportWidth: 1280,
    });
    expect(cand).toBeDefined();
    expect(cand.diffs[0].range).toBeDefined(); // 주소 경로의 표식
    expect(cand.diffs[0].modified).toContain('h-64');
  });

  it('no address and nothing matches: own is skipped with a reason, not an error', async () => {
    const { own: cand, skipped } = await own({
      change: resize,
      component: component({ sourceFile: '', fullClassName: 'flex h-40 w-96 not-in-any-file' }),
      projectPath: tmpDir,
      viewportWidth: 1280,
    });
    expect(cand).toBeUndefined();
    expect(skipped.some((s) => s.startsWith('own:'))).toBe(true);
  });
});
