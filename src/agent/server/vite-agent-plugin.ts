import type { Connect, Plugin } from 'vite'
import { createDocumentProcessingTool } from '../tools/document-processing-tool'
import { runAgent } from '../orchestrator/run-agent'
import { AgentLLM } from '../shared/llm-adapter'
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
  documentPipeline: {
    mode: 'python'
    environment: string
    pythonCommand?: string
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
        const documentTool = createDocumentProcessingTool({
          ...config.documentPipeline,
          apiKey: config.apiKey,
        })
        const result = await documentTool.execute({
          input: documentPipelineInputSchema.parse(body.input),
          caseState: caseStateSchema.parse(body.caseState),
        })
        res.end(JSON.stringify(result))
      } catch (error) {
        res.statusCode = 422
        const message = error instanceof Error && error.message === 'DOCUMENT_PIPELINE_TIMEOUT'
            ? '문서 분석 시간이 너무 오래 걸려 중단했어. 잠시 후 다시 올려줘.'
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
      if (!config.apiKey) {
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
        }, { llm: solar })
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
          '다정하고 차분한 한국어 반말로 답변해. 해요체나 합니다체는 사용하지 말고, 친한 척하거나 가볍게 말하지 마. 법률적 결정을 대신하지 마.',
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
