import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const port = process.env['PORT'] || 3000;

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  envPrefix: ['VITE_', 'SUPABASE_'],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${port}`,
        changeOrigin: true,
      },
    },
  },
});
