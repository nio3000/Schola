export {};
/**
 * Phase 3-4-Lite-B R2-2: security boundary tests.
 * CJS mode.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const pkg = require(path.join(ROOT, 'package.json'));

// no pip in scripts
const scripts = Object.values(pkg.scripts ?? {});
const hasPip = scripts.some(s => String(s).includes('pip'));
assert.ok(!hasPip, 'no pip in scripts');

// no venv in scripts
const hasVenv = scripts.some(s => String(s).includes('venv') || String(s).includes('virtualenv'));
assert.ok(!hasVenv, 'no venv in scripts');

// no Marker adapter files
const engineDir = path.resolve(ROOT, 'electron', 'services', 'engines', 'import');
assert.ok(!fs.existsSync(path.join(engineDir, 'marker.engine.ts')), 'no marker.engine.ts');
assert.ok(!fs.existsSync(path.join(engineDir, 'marker-adapter.ts')), 'no marker-adapter.ts');
assert.ok(!fs.existsSync(path.join(engineDir, 'marker-bridge.ts')), 'no marker-bridge.ts');
assert.ok(!fs.existsSync(path.join(engineDir, 'plugin-manager.ts')), 'no plugin-manager.ts');
assert.ok(!fs.existsSync(path.join(engineDir, 'ocr.engine.ts')), 'no OCR');
assert.ok(!fs.existsSync(path.join(engineDir, 'formula.engine.ts')), 'no formula');

// no banned IPC channels (as registered constants, not comments)
const ipcTypesPath = path.resolve(ROOT, 'src', 'lib', 'contracts', 'import-export-ipc.types.ts');
const ipcContent = fs.readFileSync(ipcTypesPath, 'utf-8');
assert.ok(!ipcContent.includes('LIST_ENGINES_CHANNEL'), 'no LIST_ENGINES_CHANNEL');
assert.ok(!ipcContent.includes('SET_ENGINE_CHANNEL'), 'no SET_ENGINE_CHANNEL');
assert.ok(!ipcContent.includes('RUN_PYTHON_CHANNEL'), 'no RUN_PYTHON_CHANNEL');
assert.ok(!ipcContent.includes('INSTALL_RUNTIME_CHANNEL'), 'no INSTALL_RUNTIME_CHANNEL');

// no bundled PyMuPDF4LLM/MuPDF/Marker
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
assert.ok(!allDeps['pymupdf4llm'], 'no pymupdf4llm');
assert.ok(!allDeps['pymupdf'], 'no pymupdf');
assert.ok(!allDeps['mupdf'], 'no mupdf');
assert.ok(!allDeps['marker-pdf'], 'no marker-pdf');

// no HuggingFace
const depNames = Object.keys(allDeps);
const hasHF = depNames.some(n => n.toLowerCase().includes('huggingface'));
assert.ok(!hasHF, 'no HuggingFace');

// no model files
const importFiles = fs.readdirSync(engineDir);
const hasModel = importFiles.some((f: string) => f.endsWith('.bin') || f.endsWith('.safetensors') || f.endsWith('.gguf'));
assert.ok(!hasModel, 'no model files');

// baseline engine source safety
const distDir = path.resolve(ROOT, 'dist-electron');
const engineJs = require(path.join(distDir, 'electron', 'services', 'engines', 'import', 'baseline-paper.engine'));
const src = engineJs.baselinePaperEngine.convert.toString();
assert.ok(!src.includes('child_process'), 'no child_process');
assert.ok(!src.includes('execFile'), 'no execFile');
assert.ok(!src.includes('spawn'), 'no spawn');
assert.ok(!src.includes('fetch('), 'no fetch');
assert.ok(!src.includes('python'), 'no python');
assert.ok(!src.includes('pip'), 'no pip');

// pdfjs-dist is only new dep (sanity)
assert.ok(pkg.dependencies['pdfjs-dist'], 'pdfjs-dist in deps');

console.log('[PASS] import-security-boundary-lite');


