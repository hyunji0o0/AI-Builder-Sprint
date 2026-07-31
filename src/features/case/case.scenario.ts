import { createRepresentativeAgentCaseState } from '../../agent/fixtures'
import { CaseState } from '../../agent/schemas/case-state'
import { AgentMessage } from './case.types'
import { initialCase, initialMessages } from './case.data'

export const AGENT_DEMO_SCENARIO = 'agent-demo'

export type CaseScenario = {
  id: 'default' | typeof AGENT_DEMO_SCENARIO
  isDemo: boolean
  caseState: CaseState
  messages: AgentMessage[]
}

const demoMessages: AgentMessage[] = [
  {
    id: 1,
    role: 'agent',
    text: '올린 서류에서 확인한 내용을 불러왔어. 지금 무엇부터 해야 할지 직접 정하지 않아도 괜찮아. 현재 상황에 맞는 순서로 정리해볼게.',
    ui: [{
      type: 'CHOICE',
      prompt: '어떻게 시작할까?',
      options: [
        { id: 'start_personal_procedure', label: '내 상황에 맞게 정리하기' },
        { id: 'show_first_task', label: '지금 먼저 할 일 보기' },
      ],
    }],
  },
]

/**
 * 임시 브라우저 테스트 진입점입니다.
 * 실제 OCR 연동이 준비되면 이 URL 분기를 제거하고 업로드 결과를 CaseState에 연결합니다.
 */
export function resolveCaseScenario(search: string): CaseScenario {
  const scenario = new URLSearchParams(search).get('scenario')

  if (scenario === AGENT_DEMO_SCENARIO) {
    return {
      id: AGENT_DEMO_SCENARIO,
      isDemo: true,
      caseState: createRepresentativeAgentCaseState(),
      messages: demoMessages,
    }
  }

  return {
    id: 'default',
    isDemo: false,
    caseState: initialCase,
    messages: initialMessages,
  }
}
