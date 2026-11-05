/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Keep in sync with vercel.json.
const CSP = "frame-ancestors 'self' https://quizlet.com https://*.quizlet.com http://localhost:*";

export default defineConfig({
  plugins: [react()],
  server: { headers: { 'Content-Security-Policy': CSP } },
  preview: { headers: { 'Content-Security-Policy': CSP } },
  test: { environment: 'node' },
});
