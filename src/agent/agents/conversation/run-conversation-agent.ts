import { agentOutputSchema } from '../../schemas/agent-output'
import { caseStateSchema } from '../../schemas/case-state'
import { privacyFilter } from '../../safety/privacy-filter'
import { assessSafety } from '../../safety/safety-hooks'
import { RunAgentInput, RunAgentResult } from '../../shared/agent-run-contract'
import { AgentLLM } from '../../shared/llm-adapter'
import { buildStateSummary } from '../../shared/state-summary'
import { composeConversationMessage } from './conversation-responder'

const conversationSystemPrompt = `너는 "애도할 시간"의 일상대화·일반 질문 전용 Agent다.
사건 상태를 변경하거나 문서 도구와 행정업무 도구를 호출하지 않는다.
항상 자연스러운 한국어로 답하고 다정하고 차분한 반말을 사용한다.
해요체와 합니다체, 강제적인 긍정, 과도한 위로를 사용하지 않는다.
사후 행정이나 문서 처리가 필요한 요청을 임의로 처리하지 않는다.
사용자에게 보여줄 메시지 본문만 반환한다.`

export async function runConversationAgent(
  request: RunAgentInput,
  dependencies: { llm?: AgentLLM } = {},
): Promise<RunAgentResult> {
  const state = caseStateSchema.parse(request.caseState)
  const input = privacyFilter.mask(request.input)
  const safety = assessSafety(input, 'CASUAL_CHAT')

  let message = composeConversationMessage(input)
  if (safety.immediateRiskSuspected) {
    message = '지금은 다른 이야기보다 안전을 먼저 확인해야 해. 혼자 감당하지 말고, 곁에 있는 믿을 수 있는 사람이나 지금 이용할 수 있는 검증된 긴급 지원에 바로 도움을 요청해줘.'
  } else if (dependencies.llm) {
    try {
      const response = await dependencies.llm.complete(
        conversationSystemPrompt,
        JSON.stringify({ input, memory: state.memory, recentMessages: request.recentMessages?.slice(-12) ?? [] }),
      )
      if (response.trim() && /[가-힣]/.test(response)) message = response.trim()
    } catch {
      // 대화 Agent 실패는 사건 상태에 영향을 주지 않고 안전한 로컬 응답으로 폴백합니다.
    }
  }

  return {
    caseState: state,
    output: agentOutputSchema.parse({
      message,
      ui: [],
      suggestedActions: [],
      stateSummary: buildStateSummary(state),
      meta: {
        intent: 'CASUAL_CHAT',
        emotionalSignal: safety.severeDistress ? 'DISTRESSED' : 'NEUTRAL',
        usedTools: [],
        requiresDisclaimer: false,
      },
    }),
  }
}
