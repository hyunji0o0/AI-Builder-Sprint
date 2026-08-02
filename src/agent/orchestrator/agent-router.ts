import { z } from 'zod'
import { AgentLLM, extractJson } from '../shared/llm-adapter'
import { AgentMemory } from '../schemas/case-state'

export const agentRouteSchema = z.enum(['CONVERSATION', 'CASE_WORKFLOW'])
export type AgentRoute = z.infer<typeof agentRouteSchema>

const routeResultSchema = z.object({
  route: agentRouteSchema,
  confidence: z.number().min(0).max(1),
})

const administrativeTerms =
  /사망|상속|서류|문서|신고|보험|채무|부채|자산|재산|기한|기관|업로드|금융|업무|진행|완료|준비|제출|접수|뭐부터|무엇부터|다음|단계|과정|상담|전문가|팁|후기|나중에|다했|다\s*했/
const casualTerms = /^(안녕|하이|반가워|고마워|감사|굿굿|좋아|알겠어)[!?.~]*$/i

export async function routeAgent(
  input: string,
  llm?: AgentLLM,
  recentMessages: Array<{ role: 'agent' | 'user'; text: string }> = [],
  memory?: AgentMemory,
): Promise<AgentRoute> {
  const compact = input.replace(/\s/g, '')
  if (administrativeTerms.test(compact)) return 'CASE_WORKFLOW'
  if (casualTerms.test(compact)) return 'CONVERSATION'
  if (!llm) return 'CONVERSATION'

  try {
    const raw = await llm.complete(
      `사용자 입력을 두 Agent 중 하나로 라우팅한다.
CONVERSATION: 일상대화, 감정 표현, 서비스 업무와 무관한 일반 질문.
CASE_WORKFLOW: 사후 행정, 기본정보 수집, 문서, 자산·채무, 보험, 기관, 기한, 업무 상태에 관한 요청.
JSON만 반환한다: {"route":"CONVERSATION|CASE_WORKFLOW","confidence":0~1}`,
      JSON.stringify({ input, memory, recentMessages: recentMessages.slice(-12) }),
    )
    const result = routeResultSchema.parse(extractJson(raw))
    return result.confidence >= 0.6 ? result.route : 'CONVERSATION'
  } catch {
    return 'CONVERSATION'
  }
}
