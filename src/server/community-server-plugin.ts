import type { ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { createCommunityCommentSchema, createCommunityPostSchema, updateCommunityPostSchema } from '../schemas/community'
import { createCommunityComment, listCommunityComments } from './community-comment-store'
import { createCommunityPost, listCommunityPosts, setCommunityPostHelpful, updateCommunityPost } from './community-store'
import { recommendCommunityTips } from './community-recommend'

// agent_and_ui의 vite-agent-plugin.ts와 동일한 패턴(Vite dev 서버에 미들웨어로
// API를 붙이는 방식)을 그대로 따름. 합칠 때 vite.config.ts의 plugins 배열에
// createCommunityServerPlugin()만 추가하면 /api/community/posts 가 살아남.
const readBody = async (req: NodeJS.ReadableStream) => {
  const chunks: Uint8Array[] = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

// async 미들웨어에서 예외가 새어나가면 unhandled rejection이 되어 dev 서버 프로세스가
// 통째로 죽음(Node 15+ 기본 동작). 라우트마다 try/catch를 빠뜨리지 않도록 여기서 한 번 감쌈.
type Handler = (req: Connect.IncomingMessage, res: ServerResponse) => Promise<void>
const withErrorBoundary = (handler: Handler): Connect.NextHandleFunction => (req, res) => {
  handler(req as Connect.IncomingMessage, res as ServerResponse).catch((error) => {
    console.error('커뮤니티 API 처리 실패:', error)
    if (res.headersSent) {
      res.end()
      return
    }
    res.statusCode = 500
    res.end(JSON.stringify({ error: '요청을 처리하지 못했어요.' }))
  })
}

export function createCommunityServerPlugin(): Plugin {
  const installApi = (middlewares: Connect.Server) => {
    middlewares.use('/api/community/posts', withErrorBoundary(async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')

      const urlPath = (req.url ?? '').split('?')[0].replace(/^\/+|\/+$/g, '')
      const segments = urlPath ? urlPath.split('/') : []

      // /api/community/posts
      if (segments.length === 0) {
        if (req.method === 'GET') {
          const url = new URL(req.url ?? '', 'http://localhost')
          const category = url.searchParams.get('category') ?? undefined
          const keyword = url.searchParams.get('q') ?? undefined
          const sort = url.searchParams.get('sort') === 'helpful' ? 'helpful' : 'recent'
          const posts = await listCommunityPosts(category, keyword, sort)
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

        res.statusCode = 405
        res.end(JSON.stringify({ error: 'GET 또는 POST 요청만 지원합니다.' }))
        return
      }

      // /api/community/posts/:id
      if (segments.length === 1) {
        const id = segments[0]

        if (req.method === 'PATCH') {
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
        res.end(JSON.stringify({ error: 'PATCH 요청만 지원합니다.' }))
        return
      }

      // /api/community/posts/:id/helpful
      if (segments.length === 2 && segments[1] === 'helpful') {
        const id = segments[0]

        if (req.method === 'POST' || req.method === 'DELETE') {
          const updated = await setCommunityPostHelpful(id, req.method === 'POST')
          if (!updated) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: '글을 찾을 수 없어요.' }))
            return
          }
          res.end(JSON.stringify(updated))
          return
        }

        res.statusCode = 405
        res.end(JSON.stringify({ error: 'POST 또는 DELETE 요청만 지원합니다.' }))
        return
      }

      // /api/community/posts/:id/comments
      if (segments.length === 2 && segments[1] === 'comments') {
        const postId = segments[0]

        if (req.method === 'GET') {
          const comments = await listCommunityComments(postId)
          res.end(JSON.stringify(comments))
          return
        }

        if (req.method === 'POST') {
          try {
            const body = createCommunityCommentSchema.parse(await readBody(req))
            const comment = await createCommunityComment(postId, body)
            res.statusCode = 201
            res.end(JSON.stringify(comment))
          } catch {
            res.statusCode = 422
            res.end(JSON.stringify({ error: '댓글을 등록하지 못했어요. 입력값을 확인해 주세요.' }))
          }
          return
        }

        res.statusCode = 405
        res.end(JSON.stringify({ error: 'GET 또는 POST 요청만 지원합니다.' }))
        return
      }

      res.statusCode = 404
      res.end(JSON.stringify({ error: '알 수 없는 요청이에요.' }))
    }))

    // /api/community/recommend — 사용자 상황을 근거로 관련 커뮤니티 경험담을 검색해서
    // Solar Pro 3가 종합한 답을 돌려줌. merge 후 메인 챗 에이전트가 이 라우트를 호출.
    middlewares.use('/api/community/recommend', withErrorBoundary(async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')

      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end(JSON.stringify({ error: 'POST 요청만 지원합니다.' }))
        return
      }

      try {
        const body = (await readBody(req)) as { query?: string; category?: string; limit?: number }
        if (!body.query || !body.query.trim()) {
          res.statusCode = 422
          res.end(JSON.stringify({ error: 'query가 필요합니다.' }))
          return
        }
        const result = await recommendCommunityTips(body.query.trim(), body.category, body.limit)
        res.end(JSON.stringify(result))
      } catch (error) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: '추천을 생성하지 못했어요.', detail: `${error}` }))
      }
    }))
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
