import { caseStateSchema, CaseState } from '../../agent/schemas/case-state'
import { AgentMessage } from './case.types'

const VERSION = 1

type StoredSession = {
  version: number
  caseState: CaseState
  messages: AgentMessage[]
}

export const caseSessionStorageKey = (search: string) => {
  const params = new URLSearchParams(search)
  return `aedohal-agent-session-v${VERSION}:${params.get('scenario') || 'default'}`
}

export const restoreCaseSession = (
  search: string,
  fallback: { caseState: CaseState; messages: AgentMessage[] },
) => {
  try {
    const params = new URLSearchParams(search)
    if (params.get('reset') === '1') return fallback
    const raw = window.sessionStorage.getItem(caseSessionStorageKey(search))
    if (!raw) return fallback
    const stored = JSON.parse(raw) as Partial<StoredSession>
    if (stored.version !== VERSION || !stored.caseState || !Array.isArray(stored.messages)) return fallback
    const parsedState = caseStateSchema.parse(stored.caseState)
    const wasLegacyFinancialStep = parsedState.onboarding.currentStep === 'FINANCIAL_INQUIRY'
    const migratedState: CaseState = wasLegacyFinancialStep
      ? {
          ...parsedState,
          onboarding: { ...parsedState.onboarding, currentStep: 'ONE_STOP_SERVICE' },
        }
      : parsedState
    // 이전 버전에서 완료한 사망신고 업무가 다시 NOT_STARTED로 생성된 세션도
    // 온보딩의 확정 사실을 기준으로 즉시 바로잡는다.
    const reconciledState: CaseState = migratedState.onboarding.deathReportStatus === 'COMPLETED'
      ? {
          ...migratedState,
          tasks: migratedState.tasks.map((task) => task.type === 'CONFIRM_DEATH_REPORT'
            ? { ...task, status: 'COMPLETED' as const, readiness: 100 }
            : task),
          currentFocus: migratedState.currentFocus.type === 'CONFIRM_DEATH_REPORT'
            ? { type: null, id: null }
            : migratedState.currentFocus,
        }
      : migratedState
    const consultationCompleted = reconciledState.tasks.some((task) => (
      task.category === 'CONSULTATION' && task.status === 'COMPLETED'
    ))
    const terminalState: CaseState = consultationCompleted
      ? {
          ...reconciledState,
          stage: 'COMPLETED',
          currentFocus: { type: null, id: null },
          workflow: {
            ...reconciledState.workflow,
            phase: 'ALL_TASKS_COMPLETED',
            priorityTaskId: null,
            completionPending: false,
          },
        }
      : reconciledState
    return {
      caseState: terminalState,
      messages: stored.messages
        .filter((message) => message?.role === 'agent' || message?.role === 'user')
        .slice(-100)
        .map((message) => {
          const isLegacyFinancialQuestion = wasLegacyFinancialStep
            && message.role === 'agent'
            && message.ui?.some((block) => block.type === 'CHOICE'
              && block.options.some((option) => option.id.startsWith('onboarding_financial_')))
          if (!isLegacyFinancialQuestion) {
            return {
              ...message,
              attachments: undefined,
              ui: message.ui?.map((block) => (
                consultationCompleted
                && block.type === 'COMPLETION_CONFIRMATION'
                && block.taskId === 'prepare-inheritance-consultation'
                  ? { ...block, actions: [] }
                  : block
              )),
            }
          }
          return {
            ...message,
            text: '사망신고 상태를 저장했어.\n\n이제 안심상속 원스톱 서비스 신청 여부만 확인할게. 원스톱 서비스는 신청했어?',
            block: 'choice' as const,
            attachments: undefined,
            ui: [{
              type: 'CHOICE' as const,
              prompt: '안심상속 원스톱 서비스는 신청했어?',
              options: [
                { id: 'onboarding_one_stop_completed', label: '신청했어' },
                { id: 'onboarding_one_stop_not_completed', label: '아직 안 했어' },
                { id: 'onboarding_pause', label: '나중에 확인할게' },
              ],
            }],
          }
        }),
    }
  } catch {
    return fallback
  }
}

export const persistCaseSession = (search: string, caseState: CaseState, messages: AgentMessage[]) => {
  try {
    // 프로토타입에서는 탭이 닫히면 지워지는 sessionStorage만 사용한다.
    // 실제 서비스에서는 암호화된 서버 저장소 어댑터로 교체해야 한다.
    const value: StoredSession = {
      version: VERSION,
      caseState,
      messages: messages.slice(-100).map((message) => ({ ...message, attachments: undefined })),
    }
    window.sessionStorage.setItem(caseSessionStorageKey(search), JSON.stringify(value))
  } catch {
    // 저장 실패가 대화 진행 자체를 막지 않게 한다.
  }
}

export const clearCaseSession = (search: string) => {
  try {
    window.sessionStorage.removeItem(caseSessionStorageKey(search))
  } catch {
    // 저장소 접근이 차단된 환경에서도 화면 초기화는 계속 진행한다.
  }
}
