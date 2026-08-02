import { Classification } from '../../schemas/agent-output'
import { CaseState } from '../../schemas/case-state'
import { composeResponsePrompt } from '../../prompts/compose-response'
import { legalDisclaimer, SafetyAssessment } from '../../safety/safety-hooks'
import { ActionSelection } from './action-selector'
import { ExecutionResult } from './tool-executor'
import { AgentLLM } from '../../shared/llm-adapter'
import { buildResponsePolicy, validateComposedResponse } from './response-policy'

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
    return '지금은 행정업무보다 안전을 먼저 확인해야 해. 혼자 감당하지 말고, 곁에 있는 믿을 수 있는 사람이나 지금 이용할 수 있는 검증된 긴급 지원에 바로 도움을 요청해줘.'
  }
  if (execution.failed) return '자동 처리를 끝내지 못했지만 지금 상태는 그대로 보존했어. 직접 입력하거나 나중에 다시 이어갈 수 있어.'
  if (classification.intent === 'CASUAL_CHAT') return '행정업무가 아닌 대화는 대화 Agent에서 이어갈게.'
  if (classification.intent === 'REQUEST_PAUSE') return '응, 지금 상태로 저장해둘게. 필요할 때 여기서 다시 이어갈 수 있어.'
  if (classification.intent === 'ASK_LEGAL_DECISION') {
    return `상속 방법을 대신 결정할 수는 없어. 지금 확인된 자료를 기준으로 위험 신호와 전문가 상담에 필요한 내용을 정리해줄게. ${legalDisclaimer}`
  }
  if (selection.action === 'PROCEED_AVAILABLE') {
    return '알겠어. 아직 확인하지 못한 금융기관 자료는 미확인 상태로 남겨뒀어. 같은 자료를 다시 요청하지 않고, 지금 확인된 내용만 기준으로 다음 절차를 만들었어. 아래에서 가장 먼저 할 일을 확인하면 돼.'
  }
  if (selection.action === 'START_CONSULTATION') {
    const blockType = execution.ui[0]?.type
    if (blockType === 'MISSING_INFORMATION_QUESTION') {
      return '전문가 상담 준비를 시작했어. 먼저 검토 기한과 상담 순서를 정하는 데 필요한 날짜 하나를 확인할게. 아래에서 날짜를 알려주면, 다음 준비 항목으로 바로 이어갈게.'
    }
    if (blockType === 'TASK_READINESS') {
      return '전문가 상담에 가져갈 자료를 확인된 것과 아직 확인이 필요한 것으로 나눴어. 없는 자료를 무조건 다시 요구하지 않고, 지금 가진 자료를 기준으로 상담 준비를 이어갈게.'
    }
    return '전문가 상담 준비 업무를 선택했어. 선행 항목부터 하나씩 이어서 확인할게.'
  }
  if (selection.action === 'ADVANCE_WORKFLOW') {
    const blockType = execution.ui[0]?.type
    const workflowMessages: Partial<Record<typeof blockType, string>> = {
      PROCEDURE_PLAN: '지금 확인된 자료를 기준으로 개인별 사후 절차를 만들었어. 먼저 처리할 업무부터 하나씩 진행할게.',
      TASK_CARD: '지금 위험도와 선행 관계를 기준으로 가장 먼저 확인할 업무를 골랐어.',
      MISSING_INFORMATION_QUESTION: '업무를 준비하기 전에 부족한 정보와 서류를 확인했어. 한 번에 하나씩 채워가면 돼.',
      TASK_READINESS: '지금 가진 서류와 부족한 서류를 연결해 준비도를 계산했어.',
      PREPARATION_PACKAGE: '확인된 정보와 아직 확인할 내용을 상담·방문 준비 패키지로 정리했어.',
      OFFICIAL_PROCESS: '준비한 내용을 실제 처리로 이어갈 수 있도록 공식 확인 단계와 방문 전 체크사항을 연결했어.',
      COMPLETION_CONFIRMATION: '처리 완료를 사건 상태에 반영했어. 이어서 다음 업무를 만들 수 있어.',
    }
    return workflowMessages[blockType] ?? '지금 사건 상태를 반영해 다음 준비 단계로 이동했어.'
  }

  const prefix = classification.emotion.signal === 'DISTRESSED' && state.emotionalContext.recentComfortCount === 0
    ? '지금 무엇부터 해야 할지 막막할 수 있어. 오늘은 한 가지만 함께 확인해볼게. '
    : ''
  if (classification.emotion.signal === 'DISTRESSED' && selection.action === 'FALLBACK') {
    if (/빚|채무|부채/.test(input)) {
      return '빚 문제까지 함께 떠올라 더 막막할 수 있어. 지금 당장 다 정리하려 하지 않아도 괜찮아. 잠시 멈추거나, 원할 때 확인된 내용 하나만 함께 살펴볼 수 있어.'
    }
    return state.emotionalContext.recentComfortCount === 0
      ? '많이 버겁게 느껴지는 순간일 수 있어. 지금은 아무것도 서두르지 않아도 괜찮아. 잠시 쉬어가거나, 원할 때 편한 이야기부터 들려줘.'
      : '지금은 해야 할 일을 정하지 않아도 괜찮아. 잠시 멈춰 있고 싶다면 지금 상태 그대로 기다릴게.'
  }
  const messages: Record<ActionSelection['action'], string> = {
    CHAT: '행정업무가 아닌 대화는 대화 Agent에서 이어갈게.',
    ONBOARD: '서비스를 시작하기 전에 현재 처리 상태부터 차례로 확인할게. 한 번에 하나씩 물어볼게. 먼저, 사망신고는 이미 마쳤어?',
    UPLOAD: '문서 종류를 미리 고르지 않아도 돼. 가진 서류를 한 번에 올려주면 종류와 중요한 정보를 먼저 정리한 뒤, 확인이 필요한 내용만 하나씩 보여줄게. JPG, PNG, WEBP, PDF 파일을 최대 10개까지 올릴 수 있어.',
    CONFIRM_EXTRACTION: '추출된 정보가 맞는지 확인하거나 수정해줘.',
    FINANCIAL_INPUT: '지금 알고 있는 자산이나 채무 금액을 입력해줘. 추정 금액도 따로 표시할 수 있어.',
    SHOW_STATUS: '지금 진행 상황을 정리했어.',
    SHOW_NEXT_TASK: execution.facts[0] ?? '현재 저장된 상태를 기준으로 다음 업무를 확인했어.',
    SHOW_DOCUMENTS: '지금 업무에 필요한 서류를 정리했어.',
    SHOW_DEADLINE: execution.facts.join('\n'),
    CHECK_FINANCIAL_RISK: execution.financialSummary?.riskLevel === 'URGENT_REVIEW'
      ? `지금 확인된 자료에서는 부채가 자산보다 ${Math.abs(execution.financialSummary.difference).toLocaleString('ko-KR')}원 많아. 미확인 항목과 검토 기한을 함께 확인하고 전문가 상담을 준비해줘. ${legalDisclaimer}`
      : `지금 입력된 자산과 채무를 비교했어. ${legalDisclaimer}`,
    SHOW_INSTITUTION: '지금은 검증된 기관 데이터가 연결되지 않아서, 방문 기관은 공식 출처에서 한 번 더 확인해야 해.',
    SHOW_COMMUNITY_REVIEW: '비슷한 상황의 사용자 경험을 찾았어. 개인 경험이니 공식 기관 안내도 함께 확인해줘.',
    SHOW_DEATH_REPORT: '사망신고에 필요한 서류와 공식 양식을 준비했어. 아래에서 준비물을 확인하고 신고서를 내려받은 뒤, 방문이나 우편 접수를 준비하면 돼.',
    COMPLETE_TASK: '업무를 완료 처리하고 진행 상황에 반영했어.',
    COMPLETE_DEATH_REPORT: execution.facts[0]
      ? `사망신고를 마친 것으로 반영했어.\n\n${execution.facts[0]}부터 이어서 확인해보자. 아래 버튼을 누르면 바로 시작할 수 있어.`
      : '사망신고를 마친 것으로 반영했어.\n\n지금 상태를 기준으로 다음 업무를 확인했어.',
    ADVANCE_WORKFLOW: '지금 사건 상태를 반영해 다음 준비 단계로 이동했어.',
    START_CONSULTATION: '전문가 상담 준비를 시작했어.',
    PROCEED_AVAILABLE: '미확인 자료는 그대로 표시하고, 현재 확인된 자료를 기준으로 다음 단계로 이동했어.',
    LEGAL_BOUNDARY: `법률적 결정을 대신할 수는 없지만, 지금 확인된 자료와 검토할 항목을 정리해줄게. ${legalDisclaimer}`,
    PAUSE: '응, 지금 상태로 저장해둘게.',
    FALLBACK: '요청을 정확히 이해하지 못했어. 지금 할 일, 필요한 서류, 기한 중 하나를 골라줘.',
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
  if (!llm || safety.immediateRiskSuspected || ['ADVANCE_WORKFLOW', 'START_CONSULTATION', 'PROCEED_AVAILABLE', 'COMPLETE_DEATH_REPORT', 'SHOW_NEXT_TASK'].includes(selection.action)) return fallback
  const policy = buildResponsePolicy(classification, selection, execution)
  try {
    const compose = (retryInstruction = '') => llm.complete(
      `${composeResponsePrompt.template}
영어 문장이나 영문 안내를 포함하지 마세요.
다정하고 차분한 반말을 사용하세요. "해요·하세요·습니다" 같은 존댓말은 사용하지 마세요.
사용자를 "너"라고 직접 부르거나 지나치게 친한 척하지 마세요.
아래 verifiedFacts 밖의 구체적인 사실을 추가하지 마세요.
requiredMeaningGroups의 각 그룹에서는 의미가 같은 표현을 최소 하나 포함하세요.
prohibitedExpressions는 사용하지 마세요.
같은 뜻이라도 최근 Agent 답변과 다른 어휘와 문장 구조를 사용하세요.
긴 답변은 2~4개의 짧은 문단으로 나누고 문단 사이에 빈 줄을 넣으세요.
별표, 번호 이모지, Markdown 제목이나 목록 문법을 사용하지 마세요.
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
        memory: state.memory,
        recentConversation: recentMessages.slice(-12),
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
