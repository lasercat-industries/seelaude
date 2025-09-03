await Bun.build({
  entrypoints: ['./src/ui/index.ts'],
  tsconfig: './src/ui/tsconfig.build.json',
  outdir: 'dist/ui',
  external: ['react-dom', 'react'], // default: []
});

await Bun.build({
  entrypoints: ['./src/server/index.ts'],
  tsconfig: './src/api/tsconfig.build.json',
  outdir: 'dist/server',
  target: 'bun',
  external: ['bun'], // default: []
});