/**
 * Runtime Pack diagnostics service — Phase 3-4-G3-B.
 *
 * Provides sanitized diagnostic checks and log export.
 * ⚠️  NEVER exposes system paths, Python paths, API keys, or raw tracebacks.
 */

import os from 'node:os';
import type {
  DiagnoseCheck,
  DiagnoseRuntimePackResult,
  PlatformCheckResult,
  RuntimePackId,
  RuntimePackValidationIssue,
} from '../../../src/lib/contracts/runtime-pack.types';
import { getStatus } from './runtime-pack-status-store.service';
import { loadManifest, validateManifestStructure, validateManifestBusiness } from './runtime-pack-manifest.service';
import type { RuntimePackManifest } from '../../../src/lib/contracts/runtime-pack.types';
import { validateDownloadUrl } from './runtime-pack-security.service';

// ── Public API ───────────────────────────────────

export function diagnose(manifest: RuntimePackManifest, packId: RuntimePackId): DiagnoseRuntimePackResult {
  const checks: DiagnoseCheck[] = [];

  // 1. Platform check
  const platformResult = diagnosePlatform(manifest);
  checks.push({
    id: 'platform',
    label: '平台兼容性',
    ok: platformResult.ok,
    message: platformResult.ok ? '平台兼容' : sanitizeMessage(platformResult.issues.map((i) => i.message).join('; ')),
  });

  // 2. Manifest integrity
  const structuralResult = validateManifestStructure(manifest);
  checks.push({
    id: 'manifest-structure',
    label: '模块文件完整性',
    ok: structuralResult.ok,
    message: structuralResult.ok ? '模块文件完整' : sanitizeMessage(structuralResult.issues.map((i) => i.message).join('; ')),
  });

  // 3. Business rules
  const businessResult = validateManifestBusiness(manifest);
  checks.push({
    id: 'manifest-business',
    label: '模块校验',
    ok: businessResult.ok,
    message: businessResult.ok ? '校验通过' : sanitizeMessage(businessResult.issues.map((i) => i.message).join('; ')),
  });

  // 4. downloadUrl check
  try {
    validateDownloadUrl(manifest.runtime.downloadUrl);
    checks.push({ id: 'download-url', label: '下载来源', ok: true, message: '来源校验通过' });
  } catch (e) {
    checks.push({ id: 'download-url', label: '下载来源', ok: false, message: sanitizeMessage(e) });
  }

  // 5. RuntimeHash check
  checks.push({
    id: 'integrity',
    label: '完整性校验',
    ok: manifest.runtime.integrity.runtimeHash.length > 0,
    message: manifest.runtime.integrity.runtimeHash.length > 0 ? '校验值存在' : '缺少校验值',
  });

  // 6. pip dependencies (empty-shell: always ok)
  checks.push({
    id: 'pip-deps',
    label: '依赖完整性',
    ok: true,
    message: manifest.install.pip.length === 0 ? '无外部依赖' : `${manifest.install.pip.length} 个依赖声明`,
  });

  // 7. Last error
  const status = getStatus(packId);
  if (status?.lastErrorCode) {
    checks.push({
      id: 'last-error',
      label: '上次运行',
      ok: false,
      message: sanitizeMessage(status.lastErrorCode),
    });
  } else {
    checks.push({ id: 'last-error', label: '上次运行', ok: true, message: '无错误记录' });
  }

  const allOk = checks.every((c) => c.ok);

  return {
    ok: allOk,
    checks,
    suggestion: allOk ? '所有检查通过' : '请查看失败项并尝试重新安装或清理缓存',
  };
}

export function diagnosePlatform(manifest: RuntimePackManifest): PlatformCheckResult {
  const issues: RuntimePackValidationIssue[] = [];
  const detected = {
    os: process.platform as 'win32' | 'darwin' | 'linux',
    arch: (process.arch === 'arm' ? 'arm64' : process.arch) as 'x64' | 'arm64',
    memoryMb: Math.round(os.totalmem() / (1024 * 1024)),
    diskFreeMb: null as number | null,
    gpuAvailable: null as boolean | null,
    scholaVersion: '0.1.0', // TODO: from app.getVersion()
  };

  const req = manifest.platformRequirements;

  if (!req.os.includes(detected.os)) {
    issues.push({ code: 'OS_MISMATCH', severity: 'error', message: `当前系统 ${detected.os} 不支持` });
  }
  if (!req.arch.includes(detected.arch)) {
    issues.push({ code: 'ARCH_MISMATCH', severity: 'error', message: `当前架构 ${detected.arch} 不支持` });
  }
  if (detected.diskFreeMb !== null && detected.diskFreeMb < req.diskFreeMbMin) {
    issues.push({ code: 'DISK_SPACE_INSUFFICIENT', severity: 'error', message: `磁盘空间不足` });
  }
  if (detected.memoryMb < req.memoryMbMin) {
    issues.push({ code: 'MEMORY_BELOW_MINIMUM', severity: 'warning', message: `内存可能不足` });
  }
  if (req.gpuRequired && detected.gpuAvailable !== true) {
    issues.push({ code: 'GPU_REQUIRED_BUT_UNAVAILABLE', severity: 'error', message: '需要独立显卡' });
  }

  return {
    ok: !issues.some((i) => i.severity === 'error'),
    issues,
    detected,
  };
}

// ── Helpers ──────────────────────────────────────

function sanitizeMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Truncate and remove newlines
  return msg.slice(0, 200).replace(/[\n\r\t]/g, ' ').replace(/[\\]/g, '/');
}
