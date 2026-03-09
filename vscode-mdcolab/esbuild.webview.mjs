import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['webview-ui/editor-app.tsx'],
  bundle: true,
  outfile: 'out/webview/editor-app.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  // Extract CSS into a separate file
  external: [],
  minify: !isWatch,
  sourcemap: isWatch,
});

if (isWatch) {
  await ctx.watch();
  console.log('⚡ Watching webview-ui for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('✅ Webview bundle built successfully');
}
