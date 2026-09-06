import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api/chat': 'http://127.0.0.1:3001', '/api/casos': 'http://127.0.0.1:3001' },
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/api/**', '**/server/**'] },
  },
})
