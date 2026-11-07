import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/p2p-web-text-share/',
  plugins: [react()],
});
