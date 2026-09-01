import fs from 'fs/promises';
import path from 'path';

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  '.turbo',
  '.cache',
  'coverage',
]);

const SOURCE_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js', '.css']);

/**
 * Recursively list source files in a project directory.
 * Returns relative paths from projectPath.
 * Excludes node_modules, .next, .git, dist, etc.
 */
export async function listSourceFiles(projectPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      // Skip directories we can't read
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.isDirectory()) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SOURCE_EXTENSIONS.has(ext)) {
          results.push(path.relative(projectPath, fullPath));
        }
      }
    }
  }

  await walk(projectPath);
  return results.sort();
}

/**
 * Read source file contents as UTF-8 string.
 */
export async function readSourceFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

/**
 * Write source file.
 *
 * P4(PROD-634): `.bak.<timestamp>` 사이드카 생성을 없앴다. 버전 관리되는
 * 저장소에 정리되지 않는 잔여물을 남기는 것 자체가 오염이고(C2), 되돌리기는
 * apply-backup 의 역치환 스토어가 담당한다.
 */
export async function writeSourceFile(filePath: string, content: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    // File doesn't exist yet — ensure parent directory exists.
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Security check: prevent path traversal attacks.
 * Ensures the resolved file path is within the project directory.
 */
export function isPathSafe(filePath: string, projectPath: string): boolean {
  const resolved = path.resolve(filePath);
  const resolvedProject = path.resolve(projectPath);

  // Must be within project and not contain explicit traversal
  return resolved.startsWith(resolvedProject + path.sep) || resolved === resolvedProject;
}
