import esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const serve = process.argv.includes('--serve');
const outdir = 'dist';

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });
cpSync('public', outdir, { recursive: true });

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'esm',
  outfile: `${outdir}/main.js`,
  sourcemap: serve ? 'inline' : false,
  minify: !serve,
  target: ['es2020', 'safari14'],
  logLevel: 'info',
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: outdir, host: '127.0.0.1', port: 8137 });
  console.log(`\n  VANGUARDA rodando em  http://127.0.0.1:${port}\n`);
} else {
  await esbuild.build(options);
  console.log('Build finalizado em dist/');
}
