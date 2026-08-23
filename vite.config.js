// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'client',
  server: {
    port: 3000,
    // Отключаем автоматическое открытие браузера
    open: false,
    // Настраиваем HMR
    hmr: {
      // Используем отдельный порт для WebSocket
      port: 24678,
      host: 'localhost',
      // Отключаем протокол wss
      protocol: 'ws'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'client/src'),
      '@shared': resolve(__dirname, 'shared')
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'client/index.html')
      }
    }
  },
  optimizeDeps: {
    include: ['three']
  }
});