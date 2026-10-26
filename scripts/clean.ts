import { spawnSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function remove(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

function cleanPackageDirectories(parent: string): void {
  if (!existsSync(parent)) {
    return;
  }

  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageRoot = join(parent, entry.name);
    remove(join(packageRoot, 'node_modules'));
    remove(join(packageRoot, 'dist'));
    remove(join(packageRoot, '.turbo'));

    if (entry.name !== 'binding') {
      continue;
    }

    for (const file of readdirSync(packageRoot)) {
      if (
        file.endsWith('.node') ||
        file === 'index.js' ||
        file === 'index.d.ts' ||
        file === 'index.d.cts'
      ) {
        remove(join(packageRoot, file));
      }
    }
  }
}

remove(join(root, 'dist'));
remove(join(root, '.turbo'));
cleanPackageDirectories(join(root, 'packages'));
cleanPackageDirectories(join(root, 'examples'));
remove(join(root, 'packages/css-doctor-next/test/fixtures/next-app/.next'));
remove(join(root, 'node_modules'));

const cargo = spawnSync('cargo', ['clean'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (cargo.status !== 0) {
  process.exit(cargo.status ?? 1);
}
