import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Default to repo name /Spatial-canvas/ in production or use VITE_BASE_PATH if provided
  const basePath = env.VITE_BASE_PATH || (mode === 'production' ? '/Spatial-canvas/' : '/');
  
  return {
    base: basePath,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom', 'zustand'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-tiptap': ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-placeholder'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
  };
});
