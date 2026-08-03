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
import { caseStateSchema } from '../schemas/case-state'
import { agentOutputSchema } from '../schemas/agent-output'
import { recordAgentMemoryEvent } from '../memory/agent-memory'
import { buildStateSummary } from '../shared/state-summary'
import { detectAdversarialInput } from '../safety/adversarial-input-guard'
import { guardOutput } from '../safety/output-guard'
import { privacyFilter } from '../safety/privacy-filter'
import { assessSafety } from '../safety/safety-hooks'

/**
 * 두 Agent Harness 중 하나를 선택하는 유일한 외부 진입점입니다.
 * 대화 Agent와 사건 업무 Agent는 서로를 import하지 않습니다.
 */
export async function runAgent(
  request: RunAgentInput,
  dependencies: RunAgentDependencies = {},
): Promise<RunAgentResult> {
  const safeRecentMessages = request.recentMessages?.map((message) => ({
    ...message,
    text: privacyFilter.mask(message.text),
  }))
  const safeRequest = {
    ...request,
    input: privacyFilter.mask(request.input),
    recentMessages: safeRecentMessages,
  }
  const immediateSafety = assessSafety(safeRequest.input, 'UNSUPPORTED')
  if (immediateSafety.immediateRiskSuspected) {
    const refreshedState = refreshAgentMemory(caseStateSchema.parse(request.caseState), safeRecentMessages)
    const safetyState = caseStateSchema.parse({
      ...refreshedState,
      emotionalContext: {
        ...refreshedState.emotionalContext,
        currentSignal: 'DISTRESSED',
        intensity: 'HIGH',
        recentComfortCount: refreshedState.emotionalContext.recentComfortCount + 1,
      },
    })
    const nextState = recordAgentMemoryEvent(
      safetyState,
      'SAFETY_INTERVENTION',
      '즉각적인 안전 확인이 필요한 표현을 감지해 사건 업무를 중단함',
      'CASUAL_CHAT',
    )
    return {
      caseState: nextState,
      output: agentOutputSchema.parse({
        message: '지금은 다른 이야기보다 안전을 먼저 확인해야 해. 혼자 감당하지 말고, 곁에 있는 믿을 수 있는 사람이나 지금 이용할 수 있는 검증된 긴급 지원에 바로 도움을 요청해줘.',
        ui: [],
        suggestedActions: [],
        stateSummary: buildStateSummary(nextState),
        meta: {
          intent: 'CASUAL_CHAT',
          emotionalSignal: 'DISTRESSED',
          usedTools: ['safetyGuard'],
          requiresDisclaimer: false,
        },
      }),
    }
  }

  const previousUserMessages = request.recentMessages
    ?.filter((message) => message.role === 'user')
    .map((message) => message.text) ?? []
  const adversarialInput = detectAdversarialInput(request.input, previousUserMessages)
  if (adversarialInput) {
    const refreshedState = refreshAgentMemory(caseStateSchema.parse(request.caseState), safeRecentMessages)
    const nextState = recordAgentMemoryEvent(
      refreshedState,
      'GUARDRAIL_BLOCKED',
      `적대적 입력 차단: ${adversarialInput.category}`,
      'UNSUPPORTED',
    )
    return {
      caseState: nextState,
      output: agentOutputSchema.parse({
        message: adversarialInput.message,
        ui: [],
        suggestedActions: [],
        stateSummary: buildStateSummary(nextState),
        meta: {
          intent: 'UNSUPPORTED',
          emotionalSignal: 'NEUTRAL',
          usedTools: ['adversarialInputGuard'],
          requiresDisclaimer: false,
        },
      }),
    }
  }

  const refreshedState = refreshAgentMemory(safeRequest.caseState, safeRecentMessages)
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
    ...safeRequest,
    caseState: caseStateWithMemory,
    uiActionIntent: safeRequest.uiActionIntent ?? handoffIntent,
  }
  const route = enrichedRequest.uiActionIntent
    ? 'CASE_WORKFLOW'
    : await routeAgent(safeRequest.input, dependencies.llm, safeRecentMessages, refreshedState.memory)

  if (route === 'CONVERSATION') {
    const result = await runConversationAgent(enrichedRequest, {
      llm: dependencies.conversationLlm ?? dependencies.llm,
      tips: dependencies.tips,
    })
    return { ...result, output: guardOutput(result.output) }
  }
  const result = await runCaseWorkflowAgent(enrichedRequest, dependencies)
  return { ...result, output: guardOutput(result.output) }
}

export type {
  RunAgentInput,
  RunAgentResult,
} from '../shared/agent-run-contract'
export type RunAgentDependencies = CaseWorkflowAgentDependencies & {
  /** Lightweight model used only after the request is safely routed to conversation. */
  conversationLlm?: AgentLLM
}
