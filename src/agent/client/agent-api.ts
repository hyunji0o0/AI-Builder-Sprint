import { AgentOutput } from '../schemas/agent-output'
import { CaseState } from '../schemas/case-state'

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
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, caseState, uiActionIntent, recentMessages: recentMessages.slice(-8) }),
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
