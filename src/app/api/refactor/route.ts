import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import type { ComponentChange, DetectedComponent } from '@/types';
import {
  isPathSafe,
  listSourceFiles,
  readSourceFile,
} from '@/lib/file-utils';
import { generateRefactorResult } from '@/lib/agent/refactor-client';
import { parseAddress } from '@/lib/agent/address-resolver';
import { recordEditAttempt } from '@/lib/telemetry';
import { bpFromWidth } from '@/lib/agent/rewriters/breakpoint-tailwind';

type RefactorRequest = {
  changes: ComponentChange[];
  components: DetectedComponent[];
  projectPath: string;
  /** P3(PROD-633): 편집 시점 에디터 뷰포트 폭 — 지배 토큰 선택 기준 */
  viewportWidth?: number;
};

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/** Tailwind 프로젝트 판정 — 설정 파일 또는 의존성 (P3 · D4 정책 스위치) */
async function isTailwindProject(projectPath: string): Promise<boolean> {
  for (const name of ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.mjs', 'tailwind.config.cjs']) {
    try {
      await fs.access(path.join(projectPath, name));
      return true;
    } catch { /* keep looking */ }
  }
  try {
    const pkg = JSON.parse(await readSourceFile(path.join(projectPath, 'package.json')));
    return Boolean(pkg?.dependencies?.tailwindcss || pkg?.devDependencies?.tailwindcss);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RefactorRequest;
    const changes = Array.isArray(body.changes) ? body.changes : [];
    const components = Array.isArray(body.components) ? body.components : [];
    const viewportWidth = typeof body.viewportWidth === 'number' ? body.viewportWidth : undefined;
    let projectPath = typeof body.projectPath === 'string' ? body.projectPath : '';

    console.log('[Refactor API] changes:', changes.length, 'components:', components.length,
      'viewportWidth:', viewportWidth ?? '(미전달→1280)', 'projectPath:', projectPath);

    // Resolve 'auto' to the server's SOURCE_PATH (set by CLI)
    if (!projectPath || projectPath === 'auto') {
      projectPath = process.env.SOURCE_PATH || process.cwd();
    }

    // For demo-target, point to demo-target subdirectory
    if (projectPath && !projectPath.includes('demo-target')) {
      const demoPath = path.join(projectPath, 'demo-target');
      try {
        await fs.access(demoPath);
        projectPath = demoPath;
      } catch { /* not a demo setup, use projectPath as-is */ }
    }

    if (changes.length === 0) {
      return NextResponse.json({
        success: true,
        data: { diffs: [], skipped: [], message: 'No changes to refactor' },
      });
    }

    const changedComponentIds = new Set(changes.map((c) => c.componentId));

    /* ── P2(PROD-632): 주소 정규화 ─────────────────────────────────────────
     * jsx-dev-runtime 이 부착한 주소는 절대경로다. projectPath 기준 상대 경로로
     * 정규화해서 소스 목록의 path 와 정확히 일치하게 만든다. 프로젝트 밖을
     * 가리키는 주소는 버린다 (path traversal 방지 — 조인은 저하 경로로).
     */
    const addressedFiles = new Set<string>();
    for (const comp of components) {
      if (!changedComponentIds.has(comp.id) || !comp.sourceAddress) continue;
      const parsed = parseAddress(comp.sourceAddress);
      if (!parsed) {
        comp.sourceAddress = undefined;
        continue;
      }
      const rel = path.isAbsolute(parsed.file)
        ? path.relative(projectPath, parsed.file)
        : parsed.file;
      const abs = path.resolve(projectPath, rel);
      if (!isPathSafe(abs, projectPath) || rel.startsWith('..')) {
        comp.sourceAddress = undefined;
        continue;
      }
      comp.sourceAddress = `${rel}:${parsed.line}:${parsed.column}`;
      addressedFiles.add(rel);
    }

    const everyChangedHasAddress = [...changedComponentIds].every(
      (id) => components.find((c) => c.id === id)?.sourceAddress,
    );

    /* ── 소스 수집 ─────────────────────────────────────────────────────────
     * 전원이 주소를 가지면 그 파일들만 읽는다 — 저장 1회 40파일/162KB 읽기가
     * 실측된 낭비였다 (하네스 실험 3a). 하나라도 주소가 없으면 기존 수집을
     * 병행한다 (D6 저하 동작).
     */
    let targetFiles: string[];
    if (everyChangedHasAddress) {
      targetFiles = [...addressedFiles];
    } else {
      const explicitSourceFiles = components
        .filter((component) => changedComponentIds.has(component.id))
        .map((component) => component.sourceFile)
        .filter((file): file is string => typeof file === 'string' && file.length > 0);

      const discoveredFiles = await listSourceFiles(projectPath);
      const fallbackFiles = discoveredFiles
        .filter((file) =>
          file.startsWith('src/') ||
          file.startsWith('app/') ||
          file.endsWith('.tsx') ||
          file.endsWith('.ts') ||
          file.endsWith('.css'),
        )
        .slice(0, 40);

      targetFiles = unique([...addressedFiles, ...explicitSourceFiles, ...fallbackFiles]).slice(0, 50);
    }

    const sources: { path: string; content: string }[] = [];
    for (const relativePath of targetFiles) {
      const absolutePath = path.resolve(projectPath, relativePath);
      if (!isPathSafe(absolutePath, projectPath)) continue;
      try {
        const content = await readSourceFile(absolutePath);
        sources.push({ path: relativePath, content });
      } catch {
        continue;
      }
    }

    console.log('[Refactor API] Resolved projectPath:', projectPath);
    console.log('[Refactor API] Source files read:', sources.length, sources.map((s) => s.path));

    if (sources.length === 0) {
      return NextResponse.json({
        success: true,
        data: { diffs: [], skipped: [], message: '소스 파일을 찾을 수 없습니다. 프로젝트 경로를 확인해주세요.' },
      });
    }

    const tailwindProject = await isTailwindProject(projectPath);

    const { diffs, skipped } = await generateRefactorResult({
      changes,
      components,
      sources,
      viewportWidth,
      tailwindProject,
    });

    for (const s of skipped) {
      recordEditAttempt({
        tier: 'T0', intent: 'style', result: 'abandon',
        breakpoint: bpFromWidth(viewportWidth), failReason: s.reason,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        diffs,
        skipped,
        message: `Generated ${diffs.length} diff(s)` +
          (skipped.length > 0 ? `, skipped ${skipped.length}` : ''),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      },
      { status: 500 },
    );
  }
}
