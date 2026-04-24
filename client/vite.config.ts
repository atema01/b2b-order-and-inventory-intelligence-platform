// vite.config.ts
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    // 🔹 Run on port 3000 (or change to 5173 if you prefer)
    server: {
      port: 3000,
      host: '0.0.0.0',
      // 🔹 PROXY: Forward /api requests to your backend
      proxy: {
        '/api': {
          target: 'http://localhost:5000', // Your Express backend
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            query: ['@tanstack/react-query'],
            realtime: ['socket.io-client']
          }
        }
      }
    }
  };
});
