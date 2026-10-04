#!/usr/bin/env node
/**
 * The `chronowiki` command. The tools are TypeScript, like the theme and like
 * a wiki's own `wiki.config.ts`, so they are run through tsx.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const main = fileURLToPath(new URL('../cli/main.ts', import.meta.url));
const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), main, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
