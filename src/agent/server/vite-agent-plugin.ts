import type { Connect, Plugin } from 'vite'
import { createDocumentPipeline } from '../documents/document-pipeline-factory'
import { runDocumentPipeline } from '../documents/run-document-pipeline'
import { AgentLLM } from '../harness/llm-adapter'
import { runAgent } from '../harness/run-agent'
import { systemPrompt } from '../prompts/system'
import { agentRequestSchema } from '../schemas/agent-output'
import { caseStateSchema } from '../schemas/case-state'
import { documentPipelineInputSchema } from '../schemas/document-pipeline'

type UpstageChatResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

export type AgentServerConfig = {
  apiKey: string
  model: string
  agentMockMode: boolean
  documentPipeline: {
    mode: 'mock' | 'live'
    environment: string
    allowMockInProduction: boolean
  }
}

const createSolarAdapter = (apiKey: string, model: string): AgentLLM => ({
  async complete(system, user) {
    const upstream = await fetch('https://api.upstage.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `${systemPrompt.template}\n\n${system}` },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    const data = await upstream.json() as UpstageChatResponse
    if (!upstream.ok) throw new Error(data.error?.message || `UPSTAGE_${upstream.status}`)
    const content = data.choices?.[0]?.message?.content
    if (!content?.trim()) throw new Error('EMPTY_SOLAR_RESPONSE')
    return content.trim()
  },
})

const readBody = async (req: NodeJS.ReadableStream) => {
  const chunks: Uint8Array[] = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

export function createAgentServerPlugin(config: AgentServerConfig): Plugin {
  const installApi = (middlewares: Connect.Server) => {
    const solar = createSolarAdapter(config.apiKey, config.model)

    middlewares.use('/api/documents', async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end(JSON.stringify({ error: 'POST 요청만 지원합니다.' }))
        return
      }
      try {
        const body = await readBody(req) as { input?: unknown; caseState?: unknown }
        const pipeline = createDocumentPipeline({ ...config.documentPipeline, apiKey: config.apiKey })
        const result = await runDocumentPipeline(
          documentPipelineInputSchema.parse(body.input),
          caseStateSchema.parse(body.caseState),
          pipeline,
        )
        res.end(JSON.stringify(result))
      } catch (error) {
        res.statusCode = 422
        const message = error instanceof Error && error.message === 'MOCK_DOCUMENT_PIPELINE_BLOCKED_IN_PRODUCTION'
          ? '운영 환경에서는 mock 문서 파이프라인 사용이 차단되어 있어요.'
          : '문서 처리를 완료하지 못했어요. 현재 상태는 변경되지 않았습니다.'
        res.end(JSON.stringify({ error: message }))
      }
    })

    middlewares.use('/api/agent', async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end(JSON.stringify({ error: 'POST 요청만 지원합니다.' }))
        return
      }
      if (!config.apiKey && !config.agentMockMode) {
        res.statusCode = 503
        res.end(JSON.stringify({ error: '.env.local에 UPSTAGE_API_KEY를 설정해 주세요.' }))
        return
      }
      try {
        const body = agentRequestSchema.parse(await readBody(req))
        const result = await runAgent({
          input: body.input,
          caseState: caseStateSchema.parse(body.caseState),
          uiActionIntent: body.uiActionIntent,
          recentMessages: body.recentMessages,
        }, config.agentMockMode ? {} : { llm: solar })
        res.end(JSON.stringify(result))
      } catch {
        res.statusCode = 502
        res.end(JSON.stringify({ error: 'Agent 요청을 처리하지 못했어요. 현재 상태는 변경되지 않았습니다.' }))
      }
    })

    // 이전 클라이언트와의 호환 경로입니다. 신규 코드는 /api/agent를 사용합니다.
    middlewares.use('/api/chat', async (req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end(JSON.stringify({ error: 'POST 요청만 지원합니다.' }))
        return
      }
      if (!config.apiKey) {
        res.statusCode = 503
        res.end(JSON.stringify({ error: '.env.local에 UPSTAGE_API_KEY를 설정해 주세요.' }))
        return
      }
      try {
        const body = await readBody(req) as { messages?: Array<{ role: string; content: string }> }
        const conversation = Array.isArray(body.messages) ? body.messages.slice(-12) : []
        const message = await solar.complete(
          '따뜻하고 간결한 한국어로 답변하고 법률적 결정을 대신하지 마세요.',
          JSON.stringify(conversation),
        )
        res.end(JSON.stringify({ message }))
      } catch {
        res.statusCode = 502
        res.end(JSON.stringify({ error: 'Solar 연결에 실패했습니다.' }))
      }
    })
  }

  return {
    name: 'solar-agent-api',
    configureServer(server) {
      installApi(server.middlewares)
    },
    configurePreviewServer(server) {
      installApi(server.middlewares)
    },
  }
}

