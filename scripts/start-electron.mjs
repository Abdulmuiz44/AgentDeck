#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let electronCli;
try {
  electronCli = require.resolve('electron/cli.js');
} catch {
  console.error('Electron is not installed. Run npm install with optional dependencies enabled, then retry. The daemon CLI still works with: node dist/cli/index.js start');
  process.exit(1);
}

const child = spawn(process.execPath, [electronCli, '.'], { stdio: 'inherit', shell: false });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
