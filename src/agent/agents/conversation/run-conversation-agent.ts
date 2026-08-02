import { COMMUNITY_TIP_DISCLAIMER } from '../../../schemas/community'
import { recordAgentMemoryEvent } from '../../memory/agent-memory'
import { agentOutputSchema } from '../../schemas/agent-output'
import { CaseState, caseStateSchema } from '../../schemas/case-state'
import { privacyFilter } from '../../safety/privacy-filter'
import { assessSafety } from '../../safety/safety-hooks'
import { RunAgentInput, RunAgentResult } from '../../shared/agent-run-contract'
import {
  CASE_WORKFLOW_HANDOFF_INTERACTION,
  declinesCaseWorkflowHandoff,
  hasPendingCaseWorkflowHandoff,
  isCasualGreeting,
  isDomainQuestion,
  shouldOfferCaseWorkflowHandoff,
} from '../../shared/domain-vocabulary'
import { AgentLLM } from '../../shared/llm-adapter'
import { buildStateSummary } from '../../shared/state-summary'
import { AgentTipCard, TipProvider } from '../../shared/tip-provider'
import { composeConversationMessage } from './conversation-responder'

const TIP_LIMIT = 3
const CASE_WORKFLOW_HANDOFF_MESSAGE = '많이 버겁게 느껴질 수 있어. 지금은 해결하려 하지 않고 이야기를 더 해도 돼. 원하면 나중에 확인된 일부터 하나씩 같이 정리해 줄 수 있어. 그렇게 해줄까?'
const CASE_WORKFLOW_HANDOFF_DECLINED_MESSAGE = '응, 지금은 정리하지 않고 이야기를 더 해도 돼. 하고 싶은 말이 있으면 편하게 들려줘.'

const conversationSystemPrompt = `너는 "애도할 시간"의 일상대화·일반 질문 전용 Agent다.
사건 상태를 변경하거나 문서 도구와 행정업무 도구를 호출하지 않는다.
항상 자연스러운 한국어로 답하고 다정하고 차분한 반말을 사용한다.
해요체와 합니다체, 강제적인 긍정, 과도한 위로를 사용하지 않는다.
사후 행정이나 문서 처리가 필요한 요청을 임의로 처리하지 않는다.
사용자에게 보여줄 메시지 본문만 반환한다.`

const tipGroundingPrompt = `아래 tips는 같은 일을 겪은 사람들이 커뮤니티에 남긴 실제 경험담이며 화면에 카드로 함께 표시된다.
tips에 있는 내용만 근거로 두세 문장으로 짧게 정리하고, 없는 사실이나 수치를 지어내지 마라.
카드에 이미 보이는 문장을 그대로 옮겨 적지 말고 어떤 흐름인지만 짚어줘라.
법령·세율·기한을 단정하지 말고 개인 경험이라는 점이 드러나게 말해라.
tips 원문은 존댓말이지만 그건 인용문일 뿐이다. 네 문장은 반드시 반말로 쓰고 원문 말투를 따라가지 마라.
문장을 "예요·에요·어요·해요·이에요·습니다·됩니다"로 끝내지 마라. "야·어·지·해·거야"로 끝내라.
예: "절차예요" → "절차야", "공유되고 있어요" → "공유되고 있어", "역할을 한다는 이야기가 있어요" → "역할을 한다는 얘기가 있어".`

export type ConversationAgentDependencies = {
  llm?: AgentLLM
  /** 커뮤니티 경험담 조회. 주입하지 않으면 팁 카드 없이 대화만 한다. */
  tips?: TipProvider
}

/**
 * 사건 데이터가 필요 없는 요청을 처리한다. 응답은 두 갈래다.
 *  - 인사·감사·감정 표현 → 짧은 대화 응답만
 *  - 사건 데이터 없이 답할 수 있는 도메인 질문 → 커뮤니티 팁 카드를 함께
 *
 * 팁 조회는 읽기 전용 콘텐츠 검색이라 사건 상태를 건드리지 않는다. 문서·금융·업무
 * 도구를 호출하지 않는다는 경계는 그대로 유지된다.
 */
export async function runConversationAgent(
  request: RunAgentInput,
  dependencies: ConversationAgentDependencies = {},
): Promise<RunAgentResult> {
  const state = caseStateSchema.parse(request.caseState)
  const input = privacyFilter.mask(request.input)
  const safety = assessSafety(input, 'CASUAL_CHAT')
  const awaitingHandoff = hasPendingCaseWorkflowHandoff(state.memory)

  // 위기 신호가 있으면 팁 검색도 LLM 생성도 태우지 않는다. 지연이나 실패로 안전
  // 안내가 늦어지면 안 되고, 이 상황에 경험담 카드를 같이 띄우는 것도 맞지 않다.
  if (safety.immediateRiskSuspected) {
    return buildResult(
      state,
      '지금은 다른 이야기보다 안전을 먼저 확인해야 해. 혼자 감당하지 말고, 곁에 있는 믿을 수 있는 사람이나 지금 이용할 수 있는 검증된 긴급 지원에 바로 도움을 요청해줘.',
      [],
      'CASUAL_CHAT',
      true,
      null,
    )
  }

  const offerHandoff = !awaitingHandoff && shouldOfferCaseWorkflowHandoff(input)
  const handoffDeclined = awaitingHandoff && declinesCaseWorkflowHandoff(input)
  const tips = offerHandoff || handoffDeclined ? [] : await lookupTips(input, dependencies.tips)
  let message = offerHandoff
    ? CASE_WORKFLOW_HANDOFF_MESSAGE
    : handoffDeclined
      ? CASE_WORKFLOW_HANDOFF_DECLINED_MESSAGE
      : composeConversationMessage(input, tips.length > 0)

  if (dependencies.llm && !offerHandoff && !handoffDeclined) {
    const generated = await generateMessage(dependencies.llm, input, state, request.recentMessages, tips)
    if (generated) message = generated
  }

  const pendingInteraction = offerHandoff
    ? {
        type: CASE_WORKFLOW_HANDOFF_INTERACTION,
        targetId: null,
        expectedInput: '확인된 사건 업무를 함께 정리할지에 대한 동의 또는 거절',
      }
    : awaitingHandoff ? null : state.memory.pendingInteraction

  return buildResult(
    state,
    message,
    tips,
    tips.length ? 'ASK_COMMUNITY_TIP' : 'CASUAL_CHAT',
    safety.severeDistress,
    pendingInteraction,
  )
}

/** 도메인 질문일 때만 커뮤니티를 찾는다. 조회가 실패해도 대화는 그대로 이어간다. */
async function lookupTips(input: string, provider?: TipProvider): Promise<AgentTipCard[]> {
  if (!provider) return []
  if (isCasualGreeting(input) || !isDomainQuestion(input)) return []
  try {
    return await provider.search({ situation: input, limit: TIP_LIMIT })
  } catch {
    return []
  }
}

async function generateMessage(
  llm: AgentLLM,
  input: string,
  state: CaseState,
  recentMessages: RunAgentInput['recentMessages'],
  tips: AgentTipCard[],
): Promise<string | null> {
  const system = tips.length ? `${conversationSystemPrompt}\n\n${tipGroundingPrompt}` : conversationSystemPrompt
  try {
    const response = await llm.complete(
      system,
      JSON.stringify({
        input,
        memory: state.memory,
        recentMessages: recentMessages?.slice(-12) ?? [],
        tips: tips.map((tip) => ({ excerpt: tip.excerpt, reason: tip.reason })),
      }),
    )
    const trimmed = response.trim()
    return trimmed && /[가-힣]/.test(trimmed) ? trimmed : null
  } catch {
    // 대화 Agent 실패는 사건 상태에 영향을 주지 않고 안전한 로컬 응답으로 폴백합니다.
    return null
  }
}

/**
 * 대화 턴도 메모리에 남긴다. 사건 데이터(문서·금융·업무·기한)는 그대로 두고 memory만
 * 갱신한다. 이걸 안 하면 lastIntent가 직전 사건 업무에 멈춰 있어서 다음 턴 판단이
 * 어긋나고, 일상 대화가 대화 이력에서 통째로 빠진다.
 */
function buildResult(
  state: CaseState,
  message: string,
  tips: AgentTipCard[],
  intent: 'CASUAL_CHAT' | 'ASK_COMMUNITY_TIP',
  distressed: boolean,
  pendingInteraction: CaseState['memory']['pendingInteraction'] = state.memory.pendingInteraction,
): RunAgentResult {
  const description = tips.length
    ? `일상 대화에서 커뮤니티 경험담 ${tips.length}건을 함께 안내함`
    : '일상 대화로 응답함'
  const stateWithPendingInteraction = caseStateSchema.parse({
    ...state,
    memory: { ...state.memory, pendingInteraction },
  })
  const nextState = recordAgentMemoryEvent(stateWithPendingInteraction, 'CONVERSATION_TURN', description, intent)

  return {
    caseState: nextState,
    output: agentOutputSchema.parse({
      message,
      ui: tips.length
        ? [{ type: 'COMMUNITY_REVIEW', reviews: tips, disclaimer: COMMUNITY_TIP_DISCLAIMER }]
        : [],
      suggestedActions: [],
      stateSummary: buildStateSummary(nextState),
      meta: {
        intent,
        emotionalSignal: distressed ? 'DISTRESSED' : 'NEUTRAL',
        usedTools: tips.length ? ['searchCommunityTips'] : [],
        requiresDisclaimer: tips.length > 0,
      },
    }),
  }
}
