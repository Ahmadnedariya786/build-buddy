import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { ProjectFile, ProjectOverview } from './types';

// Extensions recognized as source or config files
const CODE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx',
  '.ts', '.mts', '.cts', '.tsx',
  '.py', '.json', '.html', '.htm',
  '.css', '.scss', '.sass', '.less',
  '.vue', '.svelte', '.astro',
  '.sql', '.yaml', '.yml', '.toml',
  '.go', '.rs', '.php', '.rb', '.sh'
]);

// Ignored directories and globs
const DEFAULT_IGNORES = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.astro/**',
  '**/.cache/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/.vercel/**',
  '**/.output/**',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '**/bun.lockb',
  '**/.env*',
  '**/BUDDY-REPORT.md',
  '**/.buddy-agent-fix.md',
  '**/.buddy.bak/**',
  '**/*.pyc',
  '**/__pycache__/**'
];

const MAX_FILE_SIZE = 150 * 1024; // 150 KB max per file

/**
 * Checks if a buffer contains binary/non-text data
 */
function isBinaryBuffer(buffer: Buffer): boolean {
  const checkLen = Math.min(buffer.length, 512);
  for (let i = 0; i < checkLen; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

/**
 * Infers the framework/project type for helpful context
 */
function detectProjectType(rootDir: string, files: string[]): string {
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (allDeps['next']) return 'Next.js App';
      if (allDeps['react'] && allDeps['vite']) return 'Vite + React App';
      if (allDeps['react-scripts']) return 'Create React App';
      if (allDeps['vue']) return 'Vue.js App';
      if (allDeps['svelte'] || allDeps['@sveltejs/kit']) return 'Svelte App';
      if (allDeps['express'] || allDeps['fastify'] || allDeps['koa']) return 'Node.js Backend Server';
      if (allDeps['react']) return 'React Application';
      return 'Node.js / TypeScript Project';
    } catch {
      return 'Node.js Project';
    }
  }

  if (files.some(f => f.endsWith('requirements.txt') || f.endsWith('pyproject.toml') || f.endsWith('.py'))) {
    return 'Python Application';
  }

  if (files.some(f => f.endsWith('index.html'))) {
    return 'Vanilla Web Application (HTML/CSS/JS)';
  }

  return 'General Software Project';
}

/**
 * Generates an ASCII tree visualization of the project files
 */
function generateFileTree(relativePaths: string[]): string {
  const treeLines: string[] = [];
  const sorted = [...relativePaths].sort();
  for (const rel of sorted) {
    const depth = rel.split('/').length - 1;
    const indent = '  '.repeat(depth);
    const basename = path.basename(rel);
    treeLines.push(`${indent}├── ${basename} (${rel})`);
  }
  return treeLines.join('\n');
}

/**
 * Scans the target project directory and returns all source files and metadata
 */
export async function scanProject(targetDir: string): Promise<ProjectOverview> {
  const resolvedRoot = path.resolve(targetDir);

  if (!fs.existsSync(resolvedRoot)) {
    throw new Error(`Target directory does not exist: "${resolvedRoot}"`);
  }

  const stat = fs.statSync(resolvedRoot);
  if (!stat.isDirectory()) {
    throw new Error(`Target path is not a directory: "${resolvedRoot}"`);
  }

  // Scan files using fast-glob
  const rawFilePaths = await fg(['**/*'], {
    cwd: resolvedRoot,
    ignore: DEFAULT_IGNORES,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false
  });

  const validFiles: ProjectFile[] = [];
  let totalLines = 0;

  for (const relPath of rawFilePaths) {
    const ext = path.extname(relPath).toLowerCase();
    const baseName = path.basename(relPath).toLowerCase();

    // Check if it's a known code/config file or a file like Dockerfile / Makefile
    const isCode = CODE_EXTENSIONS.has(ext) || baseName === 'dockerfile' || baseName === 'makefile';
    if (!isCode) continue;

    const fullPath = path.join(resolvedRoot, relPath);

    try {
      const stats = fs.statSync(fullPath);
      if (stats.size > MAX_FILE_SIZE) {
        // Skip excessively large files
        continue;
      }

      const fileBuffer = fs.readFileSync(fullPath);
      if (isBinaryBuffer(fileBuffer)) {
        continue;
      }

      const content = fileBuffer.toString('utf8');
      const lineCount = content.split('\n').length;
      totalLines += lineCount;

      // Normalize path to forward slashes for cross-platform consistency
      const normalizedRelPath = relPath.replace(/\\/g, '/');

      validFiles.push({
        path: normalizedRelPath,
        absolutePath: fullPath,
        extension: ext,
        content,
        lineCount,
        sizeBytes: stats.size
      });
    } catch {
      // Ignore unreadable or locked files
      continue;
    }
  }

  const projectType = detectProjectType(resolvedRoot, rawFilePaths);
  const relativeList = validFiles.map(f => f.path);
  const fileTree = generateFileTree(relativeList);

  let dependencies: Record<string, string> | undefined;
  const pkgPath = path.join(resolvedRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      dependencies = {
        ...pkg.dependencies,
        ...pkg.devDependencies
      };
    } catch {
      // ignore JSON parse error in package.json
    }
  }

  return {
    rootDir: resolvedRoot,
    projectType,
    totalFiles: validFiles.length,
    totalLines,
    fileTree,
    dependencies,
    files: validFiles
  };
}
