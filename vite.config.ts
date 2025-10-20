import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

const apiPort = 3001;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${apiPort}`,
      '/u': `http://localhost:${apiPort}`
    }
  },
  build: {
    outDir: 'dist'
  }
});


