import { build } from 'esbuild';

// Bundle the extension entry point into a single CommonJS file so the VSIX
// does not need to ship node_modules. `vscode` is always provided by the
// host and must stay external.
await build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: ['vscode'],
  sourcemap: true,
  minify: false,
  logLevel: 'info',
});
