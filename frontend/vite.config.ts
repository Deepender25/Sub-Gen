import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
      '/process': 'http://localhost:5000',
      '/save_srt': 'http://localhost:5000',
      '/burn': 'http://localhost:5000',
      '/download': 'http://localhost:5000',
      '/export_soft_subs': 'http://localhost:5000',
    }
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  }
});
