import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import type { ComponentChange, DetectedComponent } from '@/types';
import { isPathSafe, readSourceFile } from '@/lib/file-utils';
import { parseAddress } from '@/lib/agent/address-resolver';
import { buildCandidates, type ParentContext } from '@/lib/agent/candidates';

/**
 * POST /api/candidates  (P13 · PROD-642)
 *
 * 드롭 하나에 대한 결정론 편집 후보들을 diff 와 함께 돌려준다. 아무것도
 * 적용하지 않는다 — 적용은 사용자가 고른 뒤 /api/apply 가 한다.
 *
 * Request:  { change, component, parent?, projectPath, viewportWidth? }
 * Response: { success, data: { candidates, skipped } }
 */

function normalizeAddress(address: string | undefined, projectPath: string): string | undefined {
  if (!address) return undefined;
  const parsed = parseAddress(address);
  if (!parsed) return undefined;
  const rel = path.isAbsolute(parsed.file) ? path.relative(projectPath, parsed.file) : parsed.file;
  const abs = path.resolve(projectPath, rel);
  if (!isPathSafe(abs, projectPath) || rel.startsWith('..')) return undefined;
  return `${rel}:${parsed.line}:${parsed.column}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      change?: ComponentChange;
      component?: DetectedComponent;
      parent?: ParentContext;
      projectPath?: string;
      viewportWidth?: number;
    };
    if (!body.change || !body.component) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'change and component required' } },
        { status: 400 },
      );
    }

    let projectPath = typeof body.projectPath === 'string' ? body.projectPath : '';
    if (!projectPath || projectPath === 'auto') {
      projectPath = process.env.SOURCE_PATH || process.cwd();
    }
    if (projectPath && !projectPath.includes('demo-target')) {
      const demoPath = path.join(projectPath, 'demo-target');
      try {
        await fs.access(demoPath);
        projectPath = demoPath;
      } catch { /* as-is */ }
    }

    const component = { ...body.component };
    component.sourceAddress = normalizeAddress(component.sourceAddress, projectPath);
    const parent = body.parent
      ? { ...body.parent, address: normalizeAddress(body.parent.address, projectPath) }
      : undefined;

    const files = new Set<string>();
    for (const addr of [component.sourceAddress, parent?.address]) {
      const parsed = addr ? parseAddress(addr) : null;
      if (parsed) files.add(parsed.file);
    }
    const sources: { path: string; content: string }[] = [];
    for (const rel of files) {
      const abs = path.resolve(projectPath, rel);
      if (!isPathSafe(abs, projectPath)) continue;
      try {
        sources.push({ path: rel, content: await readSourceFile(abs) });
      } catch { /* skip unreadable */ }
    }

    const out = await buildCandidates({
      change: body.change,
      component,
      parent,
      sources,
      viewportWidth: typeof body.viewportWidth === 'number' ? body.viewportWidth : undefined,
    });

    return NextResponse.json({ success: true, data: out });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : String(error) },
      },
      { status: 500 },
    );
  }
}
