await Bun.build({
  entrypoints: ['./src/index.ts'],
  tsconfig: './tsconfig.build.json',
  outdir: 'dist',
  external: ['react-dom', 'react'], // default: []
});
