import { runCaseWorkflowAgent } from '../agents/case-workflow/run-case-workflow-agent'
import { CaseWorkflowAgentDependencies } from '../agents/case-workflow/run-case-workflow-agent'
import { runConversationAgent } from '../agents/conversation/run-conversation-agent'
import {
  RunAgentInput,
  RunAgentResult,
} from '../shared/agent-run-contract'
import { AgentLLM } from '../shared/llm-adapter'
import { routeAgent } from './agent-router'
import { refreshAgentMemory } from '../memory/agent-memory'
import {
  acceptsCaseWorkflowHandoff,
  hasPendingCaseWorkflowHandoff,
} from '../shared/domain-vocabulary'

/**
 * 두 Agent Harness 중 하나를 선택하는 유일한 외부 진입점입니다.
 * 대화 Agent와 사건 업무 Agent는 서로를 import하지 않습니다.
 */
export async function runAgent(
  request: RunAgentInput,
  dependencies: RunAgentDependencies = {},
): Promise<RunAgentResult> {
  const stateWithMemory = refreshAgentMemory(request.caseState, request.recentMessages)
  const terminalConsultationCompleted = stateWithMemory.tasks.some((task) => (
    task.category === 'CONSULTATION' && task.status === 'COMPLETED'
  ))
  const refreshedState = terminalConsultationCompleted
    ? {
        ...stateWithMemory,
        stage: 'COMPLETED' as const,
        currentFocus: { type: null, id: null },
        workflow: {
          ...stateWithMemory.workflow,
          phase: 'ALL_TASKS_COMPLETED' as const,
          priorityTaskId: null,
          completionPending: false,
        },
      }
    : stateWithMemory
  const handoffAccepted = hasPendingCaseWorkflowHandoff(refreshedState.memory)
    && acceptsCaseWorkflowHandoff(request.input)
  const consumesHandoff = hasPendingCaseWorkflowHandoff(refreshedState.memory)
    && (handoffAccepted || Boolean(request.uiActionIntent))
  const caseStateWithMemory = consumesHandoff
    ? {
        ...refreshedState,
        memory: { ...refreshedState.memory, pendingInteraction: null },
      }
    : refreshedState
  const handoffIntent = handoffAccepted
    ? caseStateWithMemory.onboardingCompleted ? 'ASK_NEXT_ACTION' as const : 'START_ONBOARDING' as const
    : undefined
  const enrichedRequest = {
    ...request,
    caseState: caseStateWithMemory,
    uiActionIntent: request.uiActionIntent ?? handoffIntent,
  }
  const route = enrichedRequest.uiActionIntent
    ? 'CASE_WORKFLOW'
    : await routeAgent(request.input, dependencies.llm, request.recentMessages, refreshedState.memory)

  if (route === 'CONVERSATION') {
    return runConversationAgent(enrichedRequest, {
      llm: dependencies.conversationLlm ?? dependencies.llm,
      tips: dependencies.tips,
    })
  }
  return runCaseWorkflowAgent(enrichedRequest, dependencies)
}

export type {
  RunAgentInput,
  RunAgentResult,
} from '../shared/agent-run-contract'
export type RunAgentDependencies = CaseWorkflowAgentDependencies & {
  /** Lightweight model used only after the request is safely routed to conversation. */
  conversationLlm?: AgentLLM
}
