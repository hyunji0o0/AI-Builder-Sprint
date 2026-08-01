import { AgentOutput } from '../schemas/agent-output'
import { CaseState } from '../schemas/case-state'
import { refreshAgentMemory } from '../memory/agent-memory'

type RecentAgentMessage = {
  role: 'agent' | 'user'
  text: string
}

export type AgentApiResponse = {
  output: AgentOutput
  caseState: CaseState
}

export async function requestSolarReply(
  input: string,
  caseState: CaseState,
  uiActionIntent?: AgentOutput['meta']['intent'],
  recentMessages: RecentAgentMessage[] = [],
): Promise<AgentApiResponse> {
  const stateWithMemory = refreshAgentMemory(caseState, recentMessages)
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, caseState: stateWithMemory, uiActionIntent, recentMessages: recentMessages.slice(-20) }),
  })

  const data = (await response.json().catch(() => ({}))) as Partial<AgentApiResponse> & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(data.error || 'Solar 응답을 불러오지 못했어요.')
  }

  if (!data.output || !data.caseState) {
    throw new Error('Agent가 빈 응답을 반환했어요.')
  }

  return { output: data.output, caseState: data.caseState }
}
