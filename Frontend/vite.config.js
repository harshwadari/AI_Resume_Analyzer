import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { resolveApiOrigin } from './src/services/api-base.js'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    // Fail the build rather than shipping a localhost URL or a blank auth page.
    resolveApiOrigin(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL, true)
  }
  return { plugins: [react()], server: { port: 5173, strictPort: true } }
})
