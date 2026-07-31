import { runCaseWorkflowAgent } from '../agents/case-workflow/run-case-workflow-agent'
import { CaseWorkflowAgentDependencies } from '../agents/case-workflow/run-case-workflow-agent'
import { runConversationAgent } from '../agents/conversation/run-conversation-agent'
import {
  RunAgentInput,
  RunAgentResult,
} from '../shared/agent-run-contract'
import { routeAgent } from './agent-router'

/**
 * 두 Agent Harness 중 하나를 선택하는 유일한 외부 진입점입니다.
 * 대화 Agent와 사건 업무 Agent는 서로를 import하지 않습니다.
 */
export async function runAgent(
  request: RunAgentInput,
  dependencies: RunAgentDependencies = {},
): Promise<RunAgentResult> {
  const route = request.uiActionIntent
    ? 'CASE_WORKFLOW'
    : await routeAgent(request.input, dependencies.llm, request.recentMessages)

  if (route === 'CONVERSATION') {
    return runConversationAgent(request, { llm: dependencies.llm })
  }
  return runCaseWorkflowAgent(request, dependencies)
}

export type {
  RunAgentInput,
  RunAgentResult,
} from '../shared/agent-run-contract'
export type RunAgentDependencies = CaseWorkflowAgentDependencies
