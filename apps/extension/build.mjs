import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

const common = { bundle: true, target: 'chrome110', format: 'iife', minify: false, logLevel: 'info' };
await build({ ...common, entryPoints: ['src/popup.ts'], outfile: 'dist/popup.js' });
await build({ ...common, entryPoints: ['src/background.ts'], outfile: 'dist/background.js' });

cpSync('src/popup.html', 'dist/popup.html');
cpSync('src/popup.css', 'dist/popup.css');
cpSync('manifest.json', 'dist/manifest.json');
cpSync('icons', 'dist/icons', { recursive: true });
console.log('Extension built → apps/extension/dist (load unpacked in chrome://extensions)');
