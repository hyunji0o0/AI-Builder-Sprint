import { CaseState, caseStateSchema } from '../schemas/case-state'
import { CASE_WORKFLOW_HANDOFF_INTERACTION } from '../shared/domain-vocabulary'
import { privacyFilter } from '../safety/privacy-filter'

type MemoryMessage = { role: 'agent' | 'user'; text: string }

const fact = (key: string, label: string, value: unknown) => ({ key, label, value: String(value) })

const deriveConfirmedFacts = (state: CaseState) => {
  const facts = []
  if (state.onboarding.deathReportStatus !== 'UNKNOWN') facts.push(fact('deathReportStatus', '사망신고 상태', state.onboarding.deathReportStatus))
  if (state.onboarding.financialInquiryStatus !== 'UNKNOWN') facts.push(fact('financialInquiryStatus', '금융조회 상태', state.onboarding.financialInquiryStatus))
  if (state.onboarding.oneStopServiceStatus !== 'UNKNOWN') facts.push(fact('oneStopServiceStatus', '안심상속 원스톱 상태', state.onboarding.oneStopServiceStatus))
  if (state.deceased.deathDate) facts.push(fact('deathDate', '사망일', state.deceased.deathDate))
  if (state.deceased.inheritanceAwarenessDate) facts.push(fact('inheritanceAwarenessDate', '상속 사실을 알게 된 날짜', state.deceased.inheritanceAwarenessDate))
  if (state.user.relationToDeceased) facts.push(fact('relationToDeceased', '고인과의 관계', state.user.relationToDeceased))
  if (state.user.region.city || state.user.region.district) facts.push(fact('region', '사용자 지역', [state.user.region.city, state.user.region.district].filter(Boolean).join(' ')))
  if (state.financials.totalAssets !== null) facts.push(fact('totalAssets', '현재 확인된 자산', state.financials.totalAssets))
  if (state.financials.totalDebts !== null) facts.push(fact('totalDebts', '현재 확인된 채무', state.financials.totalDebts))
  const hasFinancialContext = state.financials.assets.length > 0
    || state.financials.debts.length > 0
    || state.financialCoverage.status !== 'NOT_CHECKED'
  if (hasFinancialContext) {
    facts.push(fact('hasUnverifiedFinancialItems', '미확인 금융항목 존재 여부', state.financials.hasUnverifiedItems ? '있음' : '없음'))
  }
  const verifiedDocuments = state.documents.filter((document) => document.status === 'VERIFIED').map((document) => document.fileName)
  if (verifiedDocuments.length) facts.push(fact('verifiedDocuments', '확인 완료 문서', verifiedDocuments.join(', ')))
  const completedTasks = state.tasks.filter((task) => task.status === 'COMPLETED').map((task) => task.title)
  if (completedTasks.length) facts.push(fact('completedTasks', '완료한 업무', completedTasks.join(', ')))
  if (state.financialCoverage.missingOrganizationKeys.length) facts.push(fact('missingFinancialOrganizations', '금융조회 결과 미확인 기관', state.financialCoverage.missingOrganizationKeys.join(', ')))
  return facts.slice(0, 60)
}

const expectedInputFor = (type: string | null) => {
  if (!type) return ''
  if (type === 'DOCUMENT_CORRECTION') return '수정할 문서 항목명과 정확한 값'
  if (type === 'CONFIRM_DEATH_REPORT') return '사망신고 완료 여부 또는 준비 요청'
  if (type === 'DOCUMENT_BATCH') return '문서 추출 결과 확인 또는 수정'
  if (type.includes('FINANCIAL')) return '금융 항목 또는 금액 확인'
  return '현재 진행 중인 업무에 대한 사용자 답변'
}

const summarizeConversation = (messages: MemoryMessage[]) => messages
  .slice(-20)
  .map((message) => `${message.role === 'user' ? '사용자' : '곁'}: ${privacyFilter.mask(message.text).replace(/\s+/g, ' ').trim()}`)
  .join('\n')
  .slice(-4000)

export const refreshAgentMemory = (state: CaseState, messages: MemoryMessage[] = []): CaseState =>
  caseStateSchema.parse({
    ...state,
    memory: {
      ...state.memory,
      conversationSummary: messages.length ? summarizeConversation(messages) : state.memory.conversationSummary,
      confirmedFacts: deriveConfirmedFacts(state),
      pendingInteraction: state.memory.pendingInteraction?.type === CASE_WORKFLOW_HANDOFF_INTERACTION
        ? state.memory.pendingInteraction
        : state.currentFocus.type ? {
            type: state.currentFocus.type,
            targetId: state.currentFocus.id,
            expectedInput: expectedInputFor(state.currentFocus.type),
          } : null,
    },
  })

export const recordAgentMemoryEvent = (
  state: CaseState,
  type: string,
  description: string,
  lastIntent: string | null = state.memory.lastIntent,
): CaseState => caseStateSchema.parse({
  ...state,
  memory: {
    ...state.memory,
    confirmedFacts: deriveConfirmedFacts(state),
    recentEvents: [...state.memory.recentEvents, {
      type,
      description: description.slice(0, 500),
      occurredAt: new Date().toISOString(),
    }].slice(-30),
    lastIntent,
  },
})
