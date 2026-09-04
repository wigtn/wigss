import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

/**
 * GET /api/routes  (P10 보강 · PROD-639)
 *
 * 타깃 프로젝트의 App Router 디렉터리를 정적으로 걸어 page.tsx 를 라우트로
 * 수집한다. 캔버스 레일의 ROUTES 섹션이 소비한다 — 파일 시스템이 곧 라우트
 * 테이블이므로 실행 없이 목록이 나온다.
 *
 * 동적 세그먼트([slug])는 값이 있어야 렌더 가능하므로 needsValue 로 표시만
 * 하고 이동 대상에서는 제외한다.
 */

const SKIP_DIRS = new Set(['api', 'node_modules', '.next']);
const MAX_ROUTES = 50;

async function collectRoutes(dir: string, urlPath: string, out: { path: string; needsValue: boolean }[]) {
  if (out.length >= MAX_ROUTES) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  if (entries.some((e) => e.isFile() && /^page\.(tsx|jsx|ts|js)$/.test(e.name))) {
    out.push({ path: urlPath || '/', needsValue: /\[[^\]]+\]/.test(urlPath) });
  }
  for (const e of entries) {
    if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue;
    // 라우트 그룹 (group) 은 URL 에 나타나지 않는다
    const seg = /^\(.*\)$/.test(e.name) ? '' : `/${e.name}`;
    await collectRoutes(path.join(dir, e.name), `${urlPath}${seg}`, out);
  }
}

export async function GET() {
  let projectPath = process.env.SOURCE_PATH || process.cwd();
  if (!projectPath.includes('demo-target')) {
    const demoPath = path.join(projectPath, 'demo-target');
    try {
      await fs.access(demoPath);
      projectPath = demoPath;
    } catch { /* as-is */ }
  }

  for (const appDir of ['src/app', 'app']) {
    const abs = path.join(projectPath, appDir);
    try {
      await fs.access(abs);
      const routes: { path: string; needsValue: boolean }[] = [];
      await collectRoutes(abs, '', routes);
      routes.sort((a, b) => a.path.localeCompare(b.path));
      return NextResponse.json({ success: true, data: { routes } });
    } catch { /* try next */ }
  }
  return NextResponse.json({ success: true, data: { routes: [] } });
}
