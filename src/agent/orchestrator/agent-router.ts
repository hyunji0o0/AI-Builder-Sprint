import { z } from 'zod'
import { AgentLLM, extractJson } from '../shared/llm-adapter'
import { AgentMemory } from '../schemas/case-state'
import {
  hasEmotionalSignal,
  isCasualGreeting,
  isDomainQuestion,
  mentionsDomain,
  needsCaseData,
} from '../shared/domain-vocabulary'

export const agentRouteSchema = z.enum(['CONVERSATION', 'CASE_WORKFLOW'])
export type AgentRoute = z.infer<typeof agentRouteSchema>

const routeResultSchema = z.object({
  route: agentRouteSchema,
  confidence: z.number().min(0).max(1),
})

const routingPrompt = `사용자 입력을 두 Agent 중 하나로 라우팅한다.
판단 기준은 "이 요청에 답하려면 사용자의 사건 데이터(문서, 자산·채무, 업무 상태, 기한)가 필요한가"이다.
CONVERSATION: 일상대화, 감정 표현, 사건 데이터 없이 답할 수 있는 일반 지식 질문.
CASE_WORKFLOW: 사용자 본인의 사건 처리. 문서 업로드·확인, 자산·채무, 기한 계산, 다음 업무, 진행 상태.
JSON만 반환한다: {"route":"CONVERSATION|CASE_WORKFLOW","confidence":0~1}`

/**
 * 규칙 우선, LLM 보조로 라우팅한다.
 *
 * 규칙을 앞에 두는 이유는 두 가지다. 확실한 입력에 LLM 왕복을 낭비하지 않고,
 * LLM이 없거나 실패해도 라우팅이 무너지지 않는다.
 *
 * 순서가 곧 우선순위다.
 *  1) 인사 한 마디 → 대화
 *  2) 감정 표현뿐이고 주제도 처리 요청도 없음 → 대화 (위로가 먼저다)
 *  3) 사건 데이터 없이 답할 수 있는 순수 지식 질문 → 대화 (팁 카드가 붙는 경로)
 *  4) 처리 요청이거나 도메인 주제 → 사건 업무
 *  5) 그래도 애매하면 LLM 판단, 확신이 낮으면 규칙 폴백
 *
 * 3번을 4번보다 앞에 둔 게 핵심이다. "상속포기가 뭐야?"는 주제어가 있어도 사용자
 * 사건을 볼 필요가 없으니 대화 쪽에서 경험담과 함께 답한다. 반대로 "상속포기해야
 * 해?"는 본인 사건에 대한 판단이라 정의 질문으로 보지 않고 사건 Agent로 보낸다.
 *
 * 폴백 방향을 주제어 유무로 가르는 것도 바뀐 점이다. 예전에는 무조건 대화로
 * 떨어뜨려서, LLM이 죽으면 "아버지 통장 정리" 같은 행정 요청이 통째로 묻혔다.
 */
export async function routeAgent(
  input: string,
  llm?: AgentLLM,
  recentMessages: Array<{ role: 'agent' | 'user'; text: string }> = [],
  memory?: AgentMemory,
): Promise<AgentRoute> {
  if (isCasualGreeting(input)) return 'CONVERSATION'
  if (hasEmotionalSignal(input) && !needsCaseData(input) && !mentionsDomain(input)) return 'CONVERSATION'
  if (isDomainQuestion(input)) return 'CONVERSATION'
  if (needsCaseData(input) || mentionsDomain(input)) return 'CASE_WORKFLOW'

  const ruleFallback: AgentRoute = mentionsDomain(input) ? 'CASE_WORKFLOW' : 'CONVERSATION'
  if (!llm) return ruleFallback

  try {
    const raw = await llm.complete(
      routingPrompt,
      JSON.stringify({ input, memory, recentMessages: recentMessages.slice(-12) }),
    )
    const result = routeResultSchema.parse(extractJson(raw))
    return result.confidence >= 0.6 ? result.route : ruleFallback
  } catch {
    return ruleFallback
  }
}
