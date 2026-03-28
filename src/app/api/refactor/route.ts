import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import type { ComponentChange, DetectedComponent } from '@/types';
import {
  isPathSafe,
  listSourceFiles,
  readSourceFile,
} from '@/lib/file-utils';
import { generateRefactorDiffs } from '@/lib/agent/refactor-client';

type RefactorRequest = {
  changes: ComponentChange[];
  components: DetectedComponent[];
  projectPath: string;
};

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RefactorRequest;
    const changes = Array.isArray(body.changes) ? body.changes : [];
    const components = Array.isArray(body.components) ? body.components : [];
    let projectPath = typeof body.projectPath === 'string' ? body.projectPath : '';

    console.log('[Refactor API] changes:', changes.length, 'components:', components.length, 'projectPath:', projectPath);

    // Log each change with its component info for debugging
    for (const change of changes) {
      const comp = components.find(c => c.id === change.componentId);
      console.log(`[Refactor API] Change: ${change.type} ${change.componentId}`);
      console.log(`  component: ${comp?.name || 'NOT FOUND'}`);
      console.log(`  fullClassName: "${(comp as any)?.fullClassName || 'EMPTY'}"`);
      console.log(`  sourceFile: "${comp?.sourceFile || 'EMPTY'}"`);
      console.log(`  from:`, change.from, '→ to:', change.to);
    }

    // Resolve 'auto' to the server's SOURCE_PATH (set by CLI)
    if (!projectPath || projectPath === 'auto') {
      projectPath = process.env.SOURCE_PATH || process.cwd();
    }

    // For demo-target, point to demo-target subdirectory
    if (projectPath && !projectPath.includes('demo-target')) {
      const demoPath = path.join(projectPath, 'demo-target');
      try {
        const fs = await import('fs/promises');
        await fs.access(demoPath);
        projectPath = demoPath;
      } catch { /* not a demo setup, use projectPath as-is */ }
    }

    if (changes.length === 0) {
      return NextResponse.json({
        success: true,
        data: { diffs: [], message: 'No changes to refactor' },
      });
    }

    const changedComponentIds = new Set(changes.map((c) => c.componentId));
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

    const targetFiles = unique([...explicitSourceFiles, ...fallbackFiles]).slice(0, 50);

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
    console.log('[Refactor API] Source files found:', sources.length, sources.map(s => s.path));

    if (sources.length === 0) {
      return NextResponse.json({
        success: true,
        data: { diffs: [], message: '소스 파일을 찾을 수 없습니다. 프로젝트 경로를 확인해주세요.' },
      });
    }

    const diffs = await generateRefactorDiffs({
      changes,
      components,
      sources,
    });

    return NextResponse.json({
      success: true,
      data: {
        diffs,
        message: `Generated ${diffs.length} diff(s)`,
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
