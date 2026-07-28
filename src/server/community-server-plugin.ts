import type { Connect, Plugin } from 'vite'
import { createCommunityPostSchema, updateCommunityPostSchema } from '../schemas/community'
import { createCommunityPost, listCommunityPosts, updateCommunityPost } from './community-store'

// agent_and_ui의 vite-agent-plugin.ts와 동일한 패턴(Vite dev 서버에 미들웨어로
// API를 붙이는 방식)을 그대로 따름. 합칠 때 vite.config.ts의 plugins 배열에
// createCommunityServerPlugin()만 추가하면 /api/community/posts 가 살아남.
const readBody = async (req: NodeJS.ReadableStream) => {
  const chunks: Uint8Array[] = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

export function createCommunityServerPlugin(): Plugin {
  const installApi = (middlewares: Connect.Server) => {
    middlewares.use('/api/community/posts', async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')

      if (req.method === 'GET') {
        const url = new URL(req.url ?? '', 'http://localhost')
        const category = url.searchParams.get('category') ?? undefined
        const posts = await listCommunityPosts(category)
        res.end(JSON.stringify(posts))
        return
      }

      if (req.method === 'POST') {
        try {
          const body = createCommunityPostSchema.parse(await readBody(req))
          const post = await createCommunityPost(body)
          res.statusCode = 201
          res.end(JSON.stringify(post))
        } catch {
          res.statusCode = 422
          res.end(JSON.stringify({ error: '글을 등록하지 못했어요. 입력값을 확인해 주세요.' }))
        }
        return
      }

      if (req.method === 'PATCH') {
        const id = (req.url ?? '').split('?')[0].replace(/^\/+/, '')
        if (!id) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: '수정할 글 id가 필요합니다.' }))
          return
        }
        try {
          const body = updateCommunityPostSchema.parse(await readBody(req))
          const updated = await updateCommunityPost(id, body)
          if (!updated) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: '글을 찾을 수 없어요.' }))
            return
          }
          res.end(JSON.stringify(updated))
        } catch {
          res.statusCode = 422
          res.end(JSON.stringify({ error: '수정하지 못했어요. 입력값을 확인해 주세요.' }))
        }
        return
      }

      res.statusCode = 405
      res.end(JSON.stringify({ error: 'GET, POST 또는 PATCH 요청만 지원합니다.' }))
    })
  }

  return {
    name: 'community-api',
    configureServer(server) {
      installApi(server.middlewares)
    },
    configurePreviewServer(server) {
      installApi(server.middlewares)
    },
  }
}
