import { CaseState } from '../../agent/schemas/case-state'
import { AgentMessage } from './case.types'
import { initialCase, initialMessages } from './case.data'

export type CaseScenario = {
  id: 'default'
  isDemo: false
  caseState: CaseState
  messages: AgentMessage[]
}

export function resolveCaseScenario(search: string): CaseScenario {
  void search
  return {
    id: 'default',
    isDemo: false,
    caseState: initialCase,
    messages: initialMessages,
  }
}
