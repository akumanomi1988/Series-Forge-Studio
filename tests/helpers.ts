/** Test helpers: isolated temp workspace with a copy of the pilot project. Must be imported before src modules. */
import { mkdtempSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export const REPO = join(import.meta.dirname, '..');
export function tempWorkspace(withPilot = true): string {
  const root = mkdtempSync(join(tmpdir(), 'sf-test-'));
  if (withPilot) cpSync(join(REPO, 'examples', 'projects', 'el-ultimo-turno'), join(root, 'el-ultimo-turno'), { recursive: true });
  process.env.SERIES_FORGE_WORKSPACE = root;
  return root;
}
export const hasFfmpeg = () => spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status === 0;
export const hasBrowser = () => [process.env.SERIES_FORGE_CHROMIUM, join(process.env.PROGRAMFILES ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'), join(process.env['PROGRAMFILES(X86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), '/usr/bin/chromium'].some(p => p && existsSync(p));
export const hasOneCore = () => process.platform === 'win32' && spawnSync('powershell.exe', ['-NoProfile', '-Command', "if (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Speech_OneCore\\Voices\\Tokens\\MSTTS_V110_esES_PabloM') { exit 0 } else { exit 1 }"], { windowsHide: true }).status === 0;
