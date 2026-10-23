#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const rootRepo = '/root/apidoct';
const hasLocalModules = existsSync(path.join(process.cwd(), 'node_modules', 'express'));
const hasRootModules = existsSync(path.join(rootRepo, 'node_modules', 'express'));

const targetDir = (!hasLocalModules && hasRootModules) ? rootRepo : process.cwd();

console.log(`Starting ApiDoct Gateway (running in ${targetDir})...`);
const child = spawn('npm', ['start', '-w', 'server'], {
  cwd: targetDir,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
