import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Dev only: serve the Vercel functions in api/ from the Vite dev server so `pnpm dev` behaves like
// the deployment. The Gemini and Higgsfield settings are copied into process.env on the server side only; they
// have no VITE_ prefix, so Vite never exposes them to client code.
const aiRoutes: Record<string, string> = {
  '/api/analyze-photo': '/api/analyze-photo.js',
  '/api/promo-text': '/api/promo-text.js',
  '/api/video-start': '/api/video-start.js',
  '/api/video-status': '/api/video-status.js',
  '/api/video-cancel': '/api/video-cancel.js',
}

function aiApiDevServer(): Plugin {
  return {
    name: 'hongboitda-ai-api-dev',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const key of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'HF_CREDENTIALS', 'HF_VIDEO_MODEL', 'HF_VIDEO_DURATION', 'HF_VIDEO_RESOLUTION']) {
        if (env[key] && !process.env[key]) process.env[key] = env[key]
      }
      server.middlewares.use(async (req, res, next) => {
        const route = aiRoutes[(req.url ?? '').split('?')[0]]
        if (!route) return next()
        try {
          const module = await server.ssrLoadModule(route)
          await module.default(req, res)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    aiApiDevServer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
