import { classificationSchema, Classification, UserIntent } from '../../schemas/agent-output'
import { CaseState } from '../../schemas/case-state'
import { classifyIntentPrompt } from '../../prompts/classify-intent'
import { AgentLLM, extractJson } from '../../shared/llm-adapter'

const includesAny = (text: string, patterns: string[]) => patterns.some((pattern) => text.includes(pattern))

export function classifyDeterministically(input: string): Classification {
  const text = input.replace(/\s/g, '').toLowerCase()
  let intent: UserIntent = 'UNSUPPORTED'
  const mentionsDeathReport = text.includes('사망신고')
  const saysDeathReportIncomplete = mentionsDeathReport
    && /(아직.*(안했|못했|하지않)|(안했|못했|하지않).*사망신고|사망신고.*(안했|못했|하지않))/.test(text)
  const saysDeathReportCompleted = mentionsDeathReport
    && !saysDeathReportIncomplete
    && /사망신고.*(했|마쳤|끝냈|완료|처리했)/.test(text)
  const proceedWithAvailableData = (
    includesAny(text, [
      '현재자료로진행', '있는자료로진행', '현재문서로진행', '있는문서로진행',
      '현재서류로진행', '있는서류로진행', '올린문서로진행', '업로드한문서로진행',
      '지금가진것으로진행', '지금있는것으로진행', '이대로진행', '미확인으로남기고진행',
    ])
    || /(?:현재|지금|있는|가진|올린|업로드한).*(?:자료|문서|서류|것).*(?:만|으로).*(?:진행|계속|넘어)/.test(text)
    || /(?:금융|조회|문서|서류|자료).*(?:그만|생략|넘어).*(?:다음|진행|넘어)/.test(text)
  )

  if (proceedWithAvailableData) intent = 'PROCEED_WITH_AVAILABLE_DATA'
  else if (includesAny(text, ['나중에할게', '쉬고싶', '잠시쉴', '그만할게'])) intent = 'REQUEST_PAUSE'
  else if (includesAny(text, ['절차시작', '준비시작', '계속진행', '다음준비단계', '워크플로시작'])) intent = 'CONTINUE_WORKFLOW'
  else if (saysDeathReportCompleted) intent = 'DEATH_REPORT_COMPLETED'
  else if (includesAny(text, [
    '상속포기해야', '한정승인해야', '단순승인해야',
    '상속포기해도', '한정승인해도', '단순승인해도',
  ])) intent = 'ASK_LEGAL_DECISION'
  else if (includesAny(text, ['사망신고', '사망 신고'])) intent = 'ASK_DEATH_REPORT'
  else if (includesAny(text, ['안녕', '굿굿', '고마워', '알겠어', '감사'])) intent = 'CASUAL_CHAT'
  else if (includesAny(text, ['처음시작', '시작할게'])) intent = 'START_ONBOARDING'
  else if (
    includesAny(text, ['서류올릴', '서류를올릴', '다올리면', '전부올리', '한꺼번에올리', '한번에올리', '첨부할게', '첨부해도', '파일올릴', '업로드'])
    || (text.includes('서류') && includesAny(text, ['올리면', '올려도', '보내도', '넣어도']))
  ) intent = 'UPLOAD_DOCUMENT'
  else if (includesAny(text, ['맞아', '확인했어', '추출결과확인'])) intent = 'CONFIRM_EXTRACTED_DATA'
  else if (includesAny(text, ['수정할게', '잘못됐'])) intent = 'CORRECT_EXTRACTED_DATA'
  else if (/\d/.test(text) && includesAny(text, ['원', '만원', '억', '금액', '채무', '자산'])) intent = 'ADD_FINANCIAL_INFO'
  else if (includesAny(text, ['진행상황', '현재상태', '어디까지'])) intent = 'ASK_CURRENT_STATUS'
  else if (includesAny(text, [
    '뭐부터', '무엇부터', '다음에뭐', '다음은뭐', '다음뭐', '이제뭐', '다음할일', '다음업무', '어떻게해야', '어떻게하면',
    '내상황정리', '상황정리해', '먼저해야할일', '처음인데뭘',
  ])) intent = 'ASK_NEXT_ACTION'
  else if (includesAny(text, ['필요한서류', '준비서류', '부족한서류'])) intent = 'ASK_REQUIRED_DOCUMENTS'
  else if (includesAny(text, ['기한', '며칠남', '언제까지'])) intent = 'ASK_DEADLINE'
  else if (includesAny(text, ['부채가더많', '채무가더많', '금융위험'])) intent = 'ASK_FINANCIAL_RISK'
  else if (includesAny(text, ['부산에서어디', '기관', '어디로가'])) intent = 'ASK_INSTITUTION'
  else if (includesAny(text, ['팁', '후기', '비슷한사람'])) intent = 'ASK_COMMUNITY_TIP'
  else if (includesAny(text, ['완료', '다했어'])) intent = 'UPDATE_TASK_STATUS'

  const distressed = includesAny(text, ['너무힘들', '정신없', '모르겠', '막막', '아무것도하기싫'])
  const positive = includesAny(text, ['고마워', '감사', '굿굿', '다했어', '알겠다', '편해졌'])
  return {
    intent,
    emotion: {
      signal: distressed ? 'DISTRESSED' : positive ? 'POSITIVE' : 'NEUTRAL',
      intensity: distressed ? (includesAny(text, ['너무', '아무것도', '죽고싶', '살기싫']) ? 'HIGH' : 'MEDIUM') : 'LOW',
    },
    confidence: intent === 'UNSUPPORTED' ? 0.35 : 0.9,
  }
}

type RecentMessage = { role: 'agent' | 'user'; text: string }

const isHighPrecisionGuard = (intent: UserIntent) =>
  intent === 'REQUEST_PAUSE' || intent === 'ASK_LEGAL_DECISION'
  || intent === 'PROCEED_WITH_AVAILABLE_DATA' || intent === 'START_CONSULTATION_PREPARATION'

const resolveClassification = (
  llmClassification: Classification,
  deterministic: Classification,
): Classification => {
  // 휴식 요청과 법률 결정 요구는 안전 경계이므로 명확한 코드 신호를 우선합니다.
  if (isHighPrecisionGuard(deterministic.intent)) {
    return { ...deterministic, confidence: Math.max(deterministic.confidence, llmClassification.confidence) }
  }

  // LLM이 충분히 확신하면 문맥 판단을 사용합니다. 정규식은 더 이상 최종 라우터가 아닙니다.
  if (llmClassification.intent !== 'UNSUPPORTED' && llmClassification.confidence >= 0.62) {
    return llmClassification
  }

  // LLM이 판단하지 못했을 때만 결정론적 분류를 폴백으로 사용합니다.
  if (deterministic.intent !== 'UNSUPPORTED') return deterministic
  return llmClassification
}

export async function classifyIntent(
  input: string,
  state: CaseState,
  llm?: AgentLLM,
  recentMessages: RecentMessage[] = [],
): Promise<Classification> {
  const baseDeterministic = classifyDeterministically(input)
  const compactInput = input.replace(/\s/g, '').toLowerCase()
  const isDeathReportFollowUp = state.currentFocus.type === 'CONFIRM_DEATH_REPORT'
    && includesAny(compactInput, ['준비해', '제출해야', '신고하지않았', '아직안했', '필요한서류', '신고서'])
  const isCoverageProceedFollowUp = state.financialCoverage.missingOrganizationKeys.length > 0
    && (
      includesAny(compactInput, [
        '넘어가', '넘어가자', '다음단계', '현재자료로', '있는자료로',
        '현재문서로', '있는문서로', '현재서류로', '있는서류로',
        '올린문서로', '업로드한문서로', '이대로진행', '그만하고',
      ])
      || /(?:현재|지금|있는|가진|올린|업로드한).*(?:자료|문서|서류|것).*(?:만|으로).*(?:진행|계속|넘어)/.test(compactInput)
    )
  const consultationTask = state.tasks.find((task) => task.category === 'CONSULTATION')
  const secondStepIsConsultation = state.tasks[1]?.category === 'CONSULTATION'
  const isConsultationHelpRequest = Boolean(consultationTask) && (
    (includesAny(compactInput, ['상담', '전문가검토', '전문가상담'])
      && includesAny(compactInput, ['도와', '준비', '진행', '시작', '알려']))
    || (secondStepIsConsultation && compactInput.includes('2단계')
      && includesAny(compactInput, ['도와', '진행', '시작', '알려', '같이']))
  )
  const deterministic = isCoverageProceedFollowUp
    ? {
      intent: 'PROCEED_WITH_AVAILABLE_DATA',
      emotion: baseDeterministic.emotion,
      confidence: 0.98,
    } satisfies Classification
    : isConsultationHelpRequest
    ? {
      intent: 'START_CONSULTATION_PREPARATION',
      emotion: baseDeterministic.emotion,
      confidence: 0.98,
    } satisfies Classification
    : baseDeterministic.intent === 'UNSUPPORTED' && isDeathReportFollowUp
    ? {
      intent: 'ASK_DEATH_REPORT',
      emotion: baseDeterministic.emotion,
      confidence: 0.95,
    } satisfies Classification
    : baseDeterministic
  if (!llm) return deterministic
  try {
    const completedTasks = state.tasks
      .filter((task) => task.status === 'COMPLETED')
      .map((task) => ({ type: task.type, title: task.title }))
    const activeTasks = state.tasks
      .filter((task) => task.status === 'IN_PROGRESS' || task.status === 'NOT_STARTED')
      .map((task) => ({ type: task.type, title: task.title, status: task.status }))
    const raw = await llm.complete(
      `${classifyIntentPrompt.template}\n출력 형식: ${classifyIntentPrompt.output}`,
      JSON.stringify({
        input,
        currentStage: state.stage,
        currentFocus: state.currentFocus,
        completedTasks,
        activeTasks,
        memory: state.memory,
        recentMessages: recentMessages.slice(-12),
        tonePreference: state.emotionalContext.tonePreference,
      }),
    )
    const classified = classificationSchema.parse(extractJson(raw))
    return resolveClassification(classified, deterministic)
  } catch {
    return deterministic
  }
}
