#!/usr/bin/env node

// Starts the dev server for one app: `node scripts/start-variant.js normal`.
// --clear because the variant is built into the bundle.
const { spawn } = require('node:child_process');

const variant = process.argv[2] ?? 'restaurant';
const child = spawn('npx', ['expo', 'start', '--clear', ...process.argv.slice(3)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_APP_VARIANT: variant },
});
child.on('exit', (code) => process.exit(code ?? 0));
