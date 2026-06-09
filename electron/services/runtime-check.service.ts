/**
 * Runtime availability detection — Phase 3-1-B / 3-1-C / 3-4-D-R2.
 *
 * Detects whether runtimes (MarkItDown, Pandoc, LaTeX) are available.
 * Uses child_process.execFile (no shell), sanitizes all output,
 * and never exposes system paths, stderr, or stack traces.
 *
 * Phase 3-4-D-R2: resolvePythonExe() is the canonical Python resolver.
 * All Python discovery (bundled, system) goes through this single function.
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

// ── Types ───────────────────────────────────────

export type DetectableRuntime = 'markitdown' | 'pandoc' | 'latex';

export interface RuntimeAvailabilityResult {
  readonly runtime: DetectableRuntime;
  readonly available: boolean;
  readonly version: string | null;
  readonly errorCode:
    | 'NOT_INSTALLED'
    | 'VERSION_UNSUPPORTED'
    | 'CHECK_FAILED'
    | 'VERSION_UNREADABLE'
    | null;
  readonly message: string;
}

// ── Internal ─────────────────────────────────────

const SYSTEM_PYTHON_CANDIDATES = ['python3', 'python', 'py'];
const DEFAULT_TIMEOUT_MS = 15_000;

// ── Bundled runtime path (Phase 3-4-D-R2) ────────

function getBundledPythonPath(): string | null {
  const exeName = process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python';

  // Try candidates in order:
  // 1. Packaged: process.resourcesPath/runtimes/docling-venv/
  // 2. Dev (npm run electron:dev): process.cwd()/resources/runtimes/docling-venv/
  // 3. Dev fallback: __dirname-based (tsc output in dist-electron/)

  // Cast to access Electron-specific process properties not in @types/node
  const resourcesPath: string | undefined = (process as { resourcesPath?: string }).resourcesPath;

  const candidates: string[] = [];

  if (typeof resourcesPath === 'string') {
    candidates.push(path.join(resourcesPath, 'runtimes', 'docling-venv'));
  }

  // Dev paths: cwd() is project root for npm run electron:dev
  candidates.push(path.resolve(process.cwd(), 'resources', 'runtimes', 'docling-venv'));
  candidates.push(path.resolve(__dirname, '..', '..', 'resources', 'runtimes', 'docling-venv'));

  for (const basePath of candidates) {
    const fullPath = path.join(basePath, exeName);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

async function execFileAsync(
  file: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean },
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    execFile(file, args, options, (err) => resolve(!err));
  });
}

async function findPython(): Promise<string> {
  // Phase 3-4-D-R2: bundled-first, then system fallback
  // 1. Bundled Python
  const bundledPath = getBundledPythonPath();
  if (bundledPath) {
    const ok = await execFileAsync(bundledPath, ['--version'], { timeout: 5000, windowsHide: true });
    if (ok) return bundledPath;
  }

  // 2. System Python candidates
  return new Promise((resolve, reject) => {
    let idx = 0;
    function tryNext(): void {
      if (idx >= SYSTEM_PYTHON_CANDIDATES.length) {
        reject(new Error('No Python executable found'));
        return;
      }
      const candidate = SYSTEM_PYTHON_CANDIDATES[idx];
      idx += 1;
      execFile(candidate, ['--version'], { timeout: 5000, windowsHide: true }, (err) => {
        if (err) { tryNext(); return; }
        resolve(candidate);
      });
    }
    tryNext();
  });
}

// ── Public API ───────────────────────────────────

export async function checkMarkItDownAvailability(): Promise<RuntimeAvailabilityResult> {
  let pythonExe: string;
  try {
    pythonExe = await findPython();
  } catch {
    return {
      runtime: 'markitdown',
      available: false,
      version: null,
      errorCode: 'CHECK_FAILED',
      message: 'No Python installation found. MarkItDown requires Python 3.8+.',
    };
  }

  // Step 1: Check if markitdown module is importable
  let importOk = false;
  try {
    importOk = await new Promise<boolean>((resolve) => {
      execFile(
        pythonExe,
        ['-c', 'import markitdown'],
        { timeout: DEFAULT_TIMEOUT_MS, windowsHide: true },
        (err) => resolve(!err),
      );
    });
  } catch {
    // execFile threw — treat as not installed
  }

  if (!importOk) {
    return {
      runtime: 'markitdown',
      available: false,
      version: null,
      errorCode: 'NOT_INSTALLED',
      message: 'MarkItDown is not available. Please install it via: pip install markitdown',
    };
  }

  // Step 2: Read version via importlib.metadata (no __version__ dunder)
  let version: string | null = null;
  try {
    version = await new Promise<string | null>((resolve) => {
      execFile(
        pythonExe,
        ['-c', "import importlib.metadata; print(importlib.metadata.version('markitdown'))"],
        { timeout: DEFAULT_TIMEOUT_MS, windowsHide: true },
        (err, stdout) => {
          if (err) { resolve(null); return; }
          const v = (stdout ?? '').trim();
          resolve(v.length > 0 ? v : null);
        },
      );
    });
  } catch {
    version = null;
  }

  if (version === null) {
    return {
      runtime: 'markitdown',
      available: true,
      version: null,
      errorCode: 'VERSION_UNREADABLE',
      message: 'MarkItDown is available but its version could not be determined.',
    };
  }

  return {
    runtime: 'markitdown',
    available: true,
    version,
    errorCode: null,
    message: `MarkItDown ${version} is available.`,
  };
}

// ── Pandoc Detection (Phase 3-1-C) ───────────────

const PANDOC_CANDIDATES = ['pandoc'];

function findPandoc(): Promise<string> {
  return new Promise((resolve, reject) => {
    let idx = 0;
    function tryNext(): void {
      if (idx >= PANDOC_CANDIDATES.length) {
        reject(new Error('Pandoc not found'));
        return;
      }
      const candidate = PANDOC_CANDIDATES[idx];
      idx += 1;
      execFile(candidate, ['--version'], { timeout: 5000, windowsHide: true }, (err) => {
        if (err) { tryNext(); return; }
        resolve(candidate);
      });
    }
    tryNext();
  });
}

export async function checkPandocAvailability(): Promise<RuntimeAvailabilityResult> {
  let pandocExe: string;
  try {
    pandocExe = await findPandoc();
  } catch {
    return {
      runtime: 'pandoc',
      available: false,
      version: null,
      errorCode: 'NOT_INSTALLED',
      message: 'Pandoc is not available. Please install it from https://pandoc.org/installing.html',
    };
  }

  let version: string | null = null;
  try {
    version = await new Promise<string | null>((resolve) => {
      execFile(
        pandocExe,
        ['--version'],
        { timeout: DEFAULT_TIMEOUT_MS, windowsHide: true },
        (err, stdout) => {
          if (err) { resolve(null); return; }
          const firstLine = (stdout ?? '').split(/[\r\n]+/)[0] ?? '';
          const match = firstLine.match(/pandoc\s+([\d.]+)/i);
          resolve(match ? match[1] : null);
        },
      );
    });
  } catch {
    version = null;
  }

  if (version === null) {
    return {
      runtime: 'pandoc',
      available: true,
      version: null,
      errorCode: 'VERSION_UNREADABLE',
      message: 'Pandoc is available but its version could not be determined.',
    };
  }

  return {
    runtime: 'pandoc',
    available: true,
    version,
    errorCode: null,
    message: 'Pandoc ' + version + ' is available.',
  };
}

let _pandocExe: string | null | undefined;

async function resolvePandocExe(): Promise<string | null> {
  if (_pandocExe !== undefined) return _pandocExe;
  try {
    _pandocExe = await findPandoc();
  } catch {
    _pandocExe = null;
  }
  return _pandocExe;
}

// ── LaTeX Detection (Phase 3-1-C) ────────────────

const LATEX_CANDIDATES = ['pdflatex'];

function findLatex(): Promise<string> {
  return new Promise((resolve, reject) => {
    let idx = 0;
    function tryNext(): void {
      if (idx >= LATEX_CANDIDATES.length) {
        reject(new Error('LaTeX not found'));
        return;
      }
      const candidate = LATEX_CANDIDATES[idx];
      idx += 1;
      execFile(candidate, ['--version'], { timeout: 5000, windowsHide: true }, (err) => {
        if (err) { tryNext(); return; }
        resolve(candidate);
      });
    }
    tryNext();
  });
}

export async function checkLatexAvailability(): Promise<RuntimeAvailabilityResult> {
  let latexExe: string;
  try {
    latexExe = await findLatex();
  } catch {
    return {
      runtime: 'latex',
      available: false,
      version: null,
      errorCode: 'NOT_INSTALLED',
      message: 'LaTeX is not available. PDF export requires a LaTeX installation (e.g. TeX Live or MiKTeX).',
    };
  }

  let version: string | null = null;
  try {
    version = await new Promise<string | null>((resolve) => {
      execFile(
        latexExe,
        ['--version'],
        { timeout: DEFAULT_TIMEOUT_MS, windowsHide: true },
        (err, stdout) => {
          if (err) { resolve(null); return; }
          const firstLine = (stdout ?? '').split(/[\r\n]+/)[0] ?? '';
          const match = firstLine.match(/(\d[\d.-]+)/);
          resolve(match ? match[1] : null);
        },
      );
    });
  } catch {
    version = null;
  }

  if (version === null) {
    return {
      runtime: 'latex',
      available: true,
      version: null,
      errorCode: 'VERSION_UNREADABLE',
      message: 'LaTeX is available but its version could not be determined.',
    };
  }

  return {
    runtime: 'latex',
    available: true,
    version,
    errorCode: null,
    message: `LaTeX ${version} is available.`,
  };
}

/**
 * Resolve the Python executable path (cached after first successful find).
 * Returns null if Python is not available.  The path is NEVER exposed
 * to the renderer.
 */
let _pythonExe: string | null | undefined;

async function resolvePythonExe(): Promise<string | null> {
  if (_pythonExe !== undefined) return _pythonExe;
  try {
    _pythonExe = await findPython();
  } catch {
    _pythonExe = null;
  }
  return _pythonExe;
}

export { resolvePythonExe, resolvePandocExe };

