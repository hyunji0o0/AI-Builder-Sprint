import { AgentOutput } from '../schemas/agent-output'
import { CaseState } from '../schemas/case-state'

export type RunAgentInput = {
  input: string
  caseState: CaseState
  uiActionIntent?: AgentOutput['meta']['intent']
  recentMessages?: Array<{ role: 'agent' | 'user'; text: string }>
}

export type RunAgentResult = {
  output: AgentOutput
  caseState: CaseState
}
