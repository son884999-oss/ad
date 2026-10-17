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

// `npm run dev:mock`: the same app with made-up AI answers, so it can be tried or shown without using the Gemini
// daily quota or paying for a video. No key is loaded and nothing leaves the computer.
const readBody = (req: import('node:http').IncomingMessage) =>
  new Promise<Record<string, unknown>>((resolve) => {
    // Joined as bytes and decoded once, so a Korean character split across chunks stays whole.
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { resolve({}) } })
  })
const field = (body: Record<string, unknown>, key: string) => (typeof body[key] === 'string' ? (body[key] as string).trim() : '')

function mockAnswer(path: string, body: Record<string, unknown>) {
  if (path === '/api/analyze-photo') {
    return [200, {
      productName: '오늘의 대표 메뉴',
      description: '매일 아침 가게에서 직접 만드는 메뉴예요',
      highlights: '매일 아침 직접 만듦, 동네 단골이 많이 찾음',
      keyFeatures: ['직접 만듦', '매일 준비'],
      targetAudience: '동네 손님',
      tones: ['friendly'],
      visualDetails: ['따뜻한 색감', '나무 테이블'],
      subjectBox: null,
      photoCheck: { isRealPhoto: true, isBlurry: false, reason: '' },
    }] as const
  }
  if (path === '/api/promo-text') {
    const name = field(body, 'productName') || '대표 메뉴'
    const shop = field(body, 'shopName')
    const where = shop ? `${shop}에서` : '가게에서'
    // 을/를 by the last syllable's final consonant (받침)
    const last = name.charCodeAt(name.length - 1)
    const object = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 ? '을' : '를'
    const tag = (text: string) => `#${text.replace(/\s+/g, '')}`
    return [200, {
      copy: `매일 아침 새로 만드는 ${name}`,
      sns: `${where} 매일 아침 ${name}${object} 새로 준비해요.\n지나가는 길에 들러 보세요.`,
      intro: `${shop ? `${shop}의 ` : ''}${name}입니다. 그날 만든 것만 내놓아요.`,
      hashtags: [tag(name), ...(shop ? [tag(shop)] : []), '#동네가게', '#오늘의메뉴'].slice(0, 5),
      copyCandidates: [`매일 아침 새로 만드는 ${name}`, `오늘 만든 ${name}, 오늘 드세요`, `${name}, 동네에서 만나요`],
      videoHeadline: `오늘 만든 ${name}`,
      cta: '들러 보세요',
    }] as const
  }
  // Real AI video is never started in mock mode; the app shows its own sample video.
  return [503, { error: 'VIDEO_NOT_CONFIGURED' }] as const
}

function aiApiDevServer(): Plugin {
  return {
    name: 'hongboitda-ai-api-dev',
    apply: 'serve',
    configureServer(server) {
      if (server.config.mode === 'mock') {
        server.middlewares.use(async (req, res, next) => {
          const path = (req.url ?? '').split('?')[0]
          if (!aiRoutes[path]) return next()
          const body = req.method === 'POST' ? await readBody(req) : {}
          const [status, answer] = mockAnswer(path, body)
          await new Promise((done) => setTimeout(done, path === '/api/analyze-photo' ? 1500 : 900)) // feel like a real call
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(answer))
        })
        return
      }
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
