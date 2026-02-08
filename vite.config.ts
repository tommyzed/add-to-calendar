import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      'process.env.GEMINI_APP_KEY': JSON.stringify(env.GEMINI_APP_KEY),
      'process.env.GEMINI_MODEL': JSON.stringify(env.GEMINI_MODEL),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID),
      'process.env.AUTH_BRIDGE_URL': JSON.stringify(env.AUTH_BRIDGE_URL),
    },
    server: {
      proxy: {
        '/api/auth': {
          target: env.AUTH_BRIDGE_URL || 'https://auth-bridge-785229654842.europe-west1.run.app',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/auth/, ''),
        },
      },
    },
  }
})
