import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const dev = process.argv.includes('--dev');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

const common = {
  bundle: true,
  target: 'chrome110',
  format: 'iife',
  minify: false,
  logLevel: 'info',
  define: { __DEV__: JSON.stringify(dev) },
};
await build({ ...common, entryPoints: ['src/popup.ts'], outfile: 'dist/popup.js' });
await build({ ...common, entryPoints: ['src/background.ts'], outfile: 'dist/background.js' });

cpSync('src/popup.html', 'dist/popup.html');
cpSync('src/popup.css', 'dist/popup.css');
cpSync('icons', 'dist/icons', { recursive: true });

// Production builds only trust the production web app; localhost is dev-only.
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
manifest.externally_connectable.matches = manifest.externally_connectable.matches.filter(
  (m) => dev || !m.includes('localhost'),
);
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2) + '\n');

console.log(`Extension built (${dev ? 'development' : 'production'}) → apps/extension/dist`);
