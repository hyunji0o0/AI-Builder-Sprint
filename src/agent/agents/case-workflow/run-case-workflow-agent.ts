import { agentOutputSchema } from '../../schemas/agent-output'
import { caseStateSchema } from '../../schemas/case-state'
import { assessSafety } from '../../safety/safety-hooks'
import { guardOutput } from '../../safety/output-guard'
import { privacyFilter } from '../../safety/privacy-filter'
import { MemoryStateRepository } from '../../state/state-repository'
import { CaseToolsService } from '../../tools/case-tools'
import { classifyIntent } from './intent-classifier'
import { RunAgentInput, RunAgentResult } from '../../shared/agent-run-contract'
import { AgentLLM } from '../../shared/llm-adapter'
import { CaseTools } from '../../tools/case-tools'
import { selectAction } from './action-selector'
import { composeMessage } from './response-composer'
import { calculateProgress, executeSelection } from './tool-executor'
import { recordAgentMemoryEvent, refreshAgentMemory } from '../../memory/agent-memory'

export type CaseWorkflowAgentDependencies = {
  llm?: AgentLLM
  tools?: CaseTools
}

export async function runCaseWorkflowAgent(
  request: RunAgentInput,
  dependencies: CaseWorkflowAgentDependencies = {},
): Promise<RunAgentResult> {
  const initialState = refreshAgentMemory(caseStateSchema.parse(request.caseState), request.recentMessages)
  const repository = new MemoryStateRepository(initialState)
  const tools = dependencies.tools || new CaseToolsService(repository)
  const safeInput = privacyFilter.mask(request.input)
  const classification = request.uiActionIntent
    ? { intent: request.uiActionIntent, emotion: { signal: 'NEUTRAL' as const, intensity: 'LOW' as const }, confidence: 1 }
    : await classifyIntent(safeInput, initialState, dependencies.llm, request.recentMessages)
  const safety = assessSafety(safeInput, classification.intent)
  const selection = await selectAction(classification, initialState, dependencies.llm)
  const execution = await executeSelection(selection, initialState, tools)

  let nextState = execution.state
  const shouldComfort = classification.emotion.signal === 'DISTRESSED' && initialState.emotionalContext.recentComfortCount === 0
  const emotionalContext = {
    ...nextState.emotionalContext,
    currentSignal: classification.emotion.signal,
    intensity: classification.emotion.intensity,
    recentComfortCount: shouldComfort ? initialState.emotionalContext.recentComfortCount + 1 : initialState.emotionalContext.recentComfortCount,
    userRequestedPause: classification.intent === 'REQUEST_PAUSE' || nextState.emotionalContext.userRequestedPause,
  }
  nextState = caseStateSchema.parse({ ...nextState, emotionalContext, lastUpdatedAt: new Date().toISOString() })
  nextState = recordAgentMemoryEvent(nextState, 'AGENT_TURN', `사용자 요청을 ${classification.intent} 의도로 처리함`, classification.intent)

  const message = await composeMessage(
    safeInput,
    classification,
    selection,
    execution,
    initialState,
    safety,
    dependencies.llm,
    request.recentMessages,
  )
  const completedTasks = nextState.tasks.filter((task) => task.status === 'COMPLETED').length
  const output = guardOutput(agentOutputSchema.parse({
    message,
    ui: safety.immediateRiskSuspected ? [] : execution.ui,
    suggestedActions: safety.immediateRiskSuspected
      ? [{ id: 'pause', label: '행정업무 잠시 멈추기' }]
      : execution.suggestedActions.slice(0, 3),
    stateSummary: {
      stage: nextState.stage,
      progress: calculateProgress(nextState),
      todayTaskCount: nextState.tasks.filter((task) => task.status === 'IN_PROGRESS').length,
      verifiedDocumentCount: nextState.documents.filter((document) => document.status === 'VERIFIED').length,
      needsReviewCount: nextState.missingFields.filter((field) => !field.resolved).length
        + nextState.documents.filter((document) => document.status === 'NEEDS_CONFIRMATION').length,
    },
    meta: {
      intent: classification.intent,
      emotionalSignal: classification.emotion.signal,
      usedTools: execution.usedTools,
      requiresDisclaimer: classification.intent === 'ASK_LEGAL_DECISION' || selection.action === 'CHECK_FINANCIAL_RISK',
    },
  }))

  void completedTasks
  return { output, caseState: nextState }
}
