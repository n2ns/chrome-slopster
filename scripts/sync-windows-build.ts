import { cp, readFile, rm, stat } from 'node:fs/promises';
import { release } from 'node:os';
import path from 'node:path';
import process from 'node:process';

/** Refresh the unpacked Chrome extension in the shared Windows artifacts directory. */
export async function syncWindowsBuild(outDir: string): Promise<void> {
  if (process.env.CI) return;
  const isWsl = process.platform === 'linux' && (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP || /microsoft|wsl/i.test(release()));
  const target = process.platform === 'win32'
    ? 'D:\\_Dev\\_Artifacts\\chrome\\chrome-slopster-dist'
    : isWsl ? '/mnt/d/_Dev/_Artifacts/chrome/chrome-slopster-dist' : null;
  if (!target) return;

  const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8')) as {
    manifest_version?: number;
    name?: string;
    version?: string;
  } | null;
  if (manifest?.manifest_version !== 3 || typeof manifest.name !== 'string' || !manifest.name || typeof manifest.version !== 'string' || !manifest.version) {
    throw new Error(`Invalid Chrome extension manifest: ${path.join(outDir, 'manifest.json')}`);
  }
  if (!(await stat(path.dirname(target))).isDirectory()) {
    throw new Error(`Chrome artifacts directory not found: ${path.dirname(target)}`);
  }
  await rm(target, { recursive: true, force: true });
  await cp(outDir, target, { recursive: true });
  console.log(`Synced Chrome extension to ${target}`);
}
