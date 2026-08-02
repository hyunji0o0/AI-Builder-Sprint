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
    // 이전 버전에서 완료한 사망신고 업무가 다시 NOT_STARTED로 생성된 세션도
    // 온보딩의 확정 사실을 기준으로 즉시 바로잡는다.
    const reconciledState: CaseState = parsedState.onboarding.deathReportStatus === 'COMPLETED'
      ? {
          ...parsedState,
          tasks: parsedState.tasks.map((task) => task.type === 'CONFIRM_DEATH_REPORT'
            ? { ...task, status: 'COMPLETED' as const, readiness: 100 }
            : task),
          currentFocus: parsedState.currentFocus.type === 'CONFIRM_DEATH_REPORT'
            ? { type: null, id: null }
            : parsedState.currentFocus,
        }
      : parsedState
    return {
      caseState: reconciledState,
      messages: stored.messages
        .filter((message) => message?.role === 'agent' || message?.role === 'user')
        .slice(-100)
        .map((message) => ({ ...message, attachments: undefined })),
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
