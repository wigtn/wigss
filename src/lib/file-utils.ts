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
 * Write source file with automatic backup creation.
 * Creates a timestamped .bak file before writing.
 */
export async function writeSourceFile(filePath: string, content: string): Promise<void> {
  // Ensure file exists before creating backup
  try {
    await fs.access(filePath);
    await createBackup(filePath);
  } catch {
    // File doesn't exist yet; no backup needed.
    // Ensure parent directory exists.
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  }

  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Create a timestamped backup of a file.
 * Returns the backup file path.
 */
export async function createBackup(filePath: string): Promise<string> {
  const backupPath = `${filePath}.bak.${Date.now()}`;
  await fs.copyFile(filePath, backupPath);
  return backupPath;
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
