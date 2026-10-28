import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
await build({ entryPoints: ['test/unit.test.ts'], outfile: 'out-test/unit.test.cjs', bundle: true, platform: 'node', format: 'cjs', alias: { electron: './test/electron-mock.ts' }, logLevel: 'error' });
execFileSync(process.execPath, ['--test', 'out-test/unit.test.cjs'], { stdio: 'inherit' });
