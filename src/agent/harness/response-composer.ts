import { Classification } from '../schemas/agent-output'
import { CaseState } from '../schemas/case-state'
import { composeResponsePrompt } from '../prompts/compose-response'
import { legalDisclaimer, SafetyAssessment } from '../safety/safety-hooks'
import { ActionSelection } from './action-selector'
import { ExecutionResult } from './tool-executor'
import { AgentLLM } from './llm-adapter'
import { buildResponsePolicy, validateComposedResponse } from './response-policy'

const casualMessage = (input: string) => {
  const text = input.replace(/\s/g, '')
  if (/굿굿|좋아/.test(text)) return '좋아요. 필요할 때 이어서 확인해볼게요.'
  if (/고마워|감사/.test(text)) return '천천히 진행하셔도 괜찮아요.'
  if (/알겠/.test(text)) return '네, 현재 상태로 저장해둘게요.'
  const greetings = [
    '안녕하세요. 오늘은 어떤 도움이 필요하신가요?',
    '반가워요. 궁금한 점이나 정리하고 싶은 일이 있다면 편하게 말씀해 주세요.',
    '안녕하세요. 서두르지 않아도 괜찮아요. 편한 이야기부터 들려주세요.',
    '안녕하세요. 지금 마음에 걸리는 일이나 궁금한 내용을 편하게 말씀해 주세요.',
  ]
  return greetings[Math.floor(Math.random() * greetings.length)]
}

const normalizedBigrams = (text: string) => {
  const normalized = text.replace(/[\s.,!?'"“”‘’]/g, '')
  return new Set(Array.from({ length: Math.max(0, normalized.length - 1) }, (_, index) => normalized.slice(index, index + 2)))
}

export const responseSimilarity = (left: string, right: string) => {
  const a = normalizedBigrams(left)
  const b = normalizedBigrams(right)
  if (!a.size || !b.size) return 0
  const intersection = [...a].filter((token) => b.has(token)).length
  return intersection / (a.size + b.size - intersection)
}

const isRepeatedResponse = (message: string, recentMessages: Array<{ role: 'agent' | 'user'; text: string }>) =>
  recentMessages
    .filter((item) => item.role === 'agent')
    .slice(-3)
    .some((item) => responseSimilarity(message, item.text) >= 0.62)

export function deterministicMessage(
  input: string,
  classification: Classification,
  selection: ActionSelection,
  execution: ExecutionResult,
  state: CaseState,
  safety: SafetyAssessment,
) {
  if (safety.immediateRiskSuspected) {
    return '지금은 행정업무보다 안전을 먼저 확인해야 해요. 혼자 감당하지 말고 곁에 있는 믿을 수 있는 사람이나 현재 이용할 수 있는 검증된 긴급 지원에 바로 도움을 요청해 주세요.'
  }
  if (execution.failed) return '자동 처리를 끝내지 못했지만 현재 상태는 그대로 보존했어요. 직접 입력하거나 나중에 다시 이어갈 수 있습니다.'
  if (classification.intent === 'CASUAL_CHAT') return casualMessage(input)
  if (classification.intent === 'REQUEST_PAUSE') return '네, 지금 상태로 저장해둘게요. 필요할 때 여기서 다시 이어갈 수 있어요.'
  if (classification.intent === 'ASK_LEGAL_DECISION') {
    return `제가 상속 방법을 대신 결정할 수는 없어요. 현재 확인된 자료를 기준으로 위험 신호와 전문가 상담에 필요한 내용을 정리해드릴게요. ${legalDisclaimer}`
  }

  const prefix = classification.emotion.signal === 'DISTRESSED' && state.emotionalContext.recentComfortCount === 0
    ? '지금 무엇부터 해야 할지 막막하실 수 있어요. 오늘은 한 가지만 함께 확인해볼게요. '
    : ''
  if (classification.emotion.signal === 'DISTRESSED' && selection.action === 'FALLBACK') {
    if (/빚|채무|부채/.test(input)) {
      return '빚 문제까지 함께 떠올라 더 막막하게 느껴질 수 있어요. 지금 당장 정리하려 하지 않아도 괜찮습니다. 잠시 멈추거나, 원하실 때 확인된 내용 하나만 함께 살펴볼 수 있어요.'
    }
    return state.emotionalContext.recentComfortCount === 0
      ? '많이 버겁게 느껴지는 순간일 수 있어요. 지금은 아무것도 서두르지 않아도 괜찮아요. 잠시 쉬어가거나, 원하실 때 편한 이야기부터 들려주세요.'
      : '지금은 해야 할 일을 정하지 않아도 괜찮아요. 잠시 멈춰 있고 싶다면 현재 상태 그대로 기다릴게요.'
  }
  const messages: Record<ActionSelection['action'], string> = {
    CHAT: casualMessage(input),
    ONBOARD: '기본 상황부터 천천히 확인해볼게요.',
    UPLOAD: '네, 문서 종류를 미리 고르지 않아도 가지고 계신 서류를 한 번에 올려주시면 돼요. JPG, PNG, WEBP, PDF 파일을 최대 10개까지 올릴 수 있고, 제가 종류와 중요 정보를 먼저 정리한 뒤 확인이 필요한 내용만 하나씩 보여드릴게요.',
    CONFIRM_EXTRACTION: '추출된 정보를 확인하거나 수정해 주세요.',
    FINANCIAL_INPUT: '현재 알고 있는 자산이나 채무 금액을 입력해 주세요. 추정 금액도 따로 표시할 수 있어요.',
    SHOW_STATUS: '현재 진행 상황을 정리했어요.',
    SHOW_NEXT_TASK: '지금 가장 먼저 확인할 한 가지를 골랐어요.',
    SHOW_DOCUMENTS: '현재 업무에 필요한 서류를 정리했어요.',
    SHOW_DEADLINE: execution.facts.join('\n'),
    CHECK_FINANCIAL_RISK: execution.financialSummary?.riskLevel === 'URGENT_REVIEW'
      ? `현재 확인된 자료에서는 부채가 자산보다 ${Math.abs(execution.financialSummary.difference).toLocaleString('ko-KR')}원 많습니다. 미확인 항목 여부와 검토 기한을 함께 확인하고 전문가 상담을 준비해 주세요. ${legalDisclaimer}`
      : `현재 입력된 자산과 채무를 비교했어요. ${legalDisclaimer}`,
    SHOW_INSTITUTION: '현재는 검증된 기관 데이터가 연결되지 않아, 방문 기관은 공식 출처에서 추가 확인이 필요해요.',
    SHOW_COMMUNITY_REVIEW: '비슷한 상황의 사용자 경험을 찾았어요. 개인 경험이므로 공식 기관 안내도 함께 확인해 주세요.',
    COMPLETE_TASK: '업무를 완료 처리하고 진행 상황에 반영했어요.',
    LEGAL_BOUNDARY: `제가 법률적 결정을 대신할 수는 없지만, 현재 확인된 자료와 검토할 항목을 정리해드릴게요. ${legalDisclaimer}`,
    PAUSE: '네, 지금 상태로 저장해둘게요.',
    FALLBACK: '요청을 정확히 이해하지 못했어요. 지금 할 일, 필요한 서류, 기한 중 하나를 선택해 주세요.',
  }
  return prefix + messages[selection.action]
}

export async function composeMessage(
  input: string,
  classification: Classification,
  selection: ActionSelection,
  execution: ExecutionResult,
  state: CaseState,
  safety: SafetyAssessment,
  llm?: AgentLLM,
  recentMessages: Array<{ role: 'agent' | 'user'; text: string }> = [],
) {
  const fallback = deterministicMessage(input, classification, selection, execution, state, safety)
  if (!llm || safety.immediateRiskSuspected) return fallback
  const policy = buildResponsePolicy(classification, selection, execution)
  try {
    const compose = (retryInstruction = '') => llm.complete(
      `${composeResponsePrompt.template}
영어 문장이나 영문 안내를 포함하지 마세요.
아래 verifiedFacts 밖의 구체적인 사실을 추가하지 마세요.
requiredMeaningGroups의 각 그룹에서는 의미가 같은 표현을 최소 하나 포함하세요.
prohibitedExpressions는 사용하지 마세요.
같은 뜻이라도 최근 Agent 답변과 다른 어휘와 문장 구조를 사용하세요.
사용자가 새롭게 언급한 걱정이나 상황이 있으면 그 부분에 먼저 반응하세요.
이미 위로를 전했다면 같은 위로를 반복하지 말고, 쉬기·이야기하기·작은 행동 중 사용자가 선택할 여지를 남기세요.
${retryInstruction}
한국어 메시지 본문만 반환하고 JSON이나 설명을 덧붙이지 마세요.`,
      JSON.stringify({
        input,
        classification,
        action: selection.action,
        verifiedFacts: policy.verifiedFacts,
        requiredMeaningGroups: policy.requiredMeaningGroups,
        prohibitedExpressions: policy.prohibitedExpressions,
        style: policy.style,
        tonePreference: state.emotionalContext.tonePreference,
        recentConversation: recentMessages.slice(-6),
      }),
    )
    const first = (await compose()).trim()
    if (first && validateComposedResponse(first, policy) && !isRepeatedResponse(first, recentMessages)) return first

    const previousAgentReplies = recentMessages.filter((item) => item.role === 'agent').slice(-3).map((item) => item.text)
    const second = (await compose(`다음 previousAgentReplies와 유사한 문장을 쓰지 마세요: ${JSON.stringify(previousAgentReplies)}`)).trim()
    return second && validateComposedResponse(second, policy) && !isRepeatedResponse(second, recentMessages) ? second : fallback
  } catch {
    return fallback
  }
}
