#!/usr/bin/env node
// Build script for Vercel — runs web build then API build sequentially.
// Using a .mjs file avoids shell compatibility issues across platforms.

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const run = (cmd, cwd) => execSync(cmd, { cwd: resolve(__dirname, cwd), stdio: 'inherit' });

console.log('▶ Building web...');
run('npm run build', 'apps/web');

console.log('▶ Building API...');
run('npm run build', 'apps/api');

console.log('✓ Done.');
