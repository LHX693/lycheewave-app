import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('out', { recursive: true });
const common = { bundle: true, sourcemap: false, logLevel: 'info' };
await build({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'out/main.js', platform: 'node', format: 'cjs', external: ['electron'] });
await build({ ...common, entryPoints: ['src/preload.ts'], outfile: 'out/preload.js', platform: 'node', format: 'cjs', external: ['electron'] });
await build({ ...common, entryPoints: { app: 'src/renderer/app.tsx', indicator: 'src/renderer/indicator.tsx' }, outdir: 'out', platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
for (const f of ['index.html', 'indicator.html', 'styles.css']) cpSync(`src/renderer/${f}`, `out/${f}`);
cpSync('assets/icon.png', 'out/icon.png');
