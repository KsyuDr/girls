import react from '@vitejs/plugin-react';
import process from 'node:process';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Для GitHub Pages сайт живёт по адресу /girls/, поэтому сборка задаёт VITE_BASE=/girls/
  base: process.env.VITE_BASE || '/',
});
