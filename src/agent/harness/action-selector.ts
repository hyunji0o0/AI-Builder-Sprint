import { z } from 'zod'
import { Classification } from '../schemas/agent-output'
import { CaseState } from '../schemas/case-state'
import { selectActionPrompt } from '../prompts/select-action'
import { AgentLLM, extractJson } from './llm-adapter'

export const actionNameSchema = z.enum([
  'CHAT', 'ONBOARD', 'UPLOAD', 'CONFIRM_EXTRACTION', 'FINANCIAL_INPUT',
  'SHOW_STATUS', 'SHOW_NEXT_TASK', 'SHOW_DOCUMENTS', 'SHOW_DEADLINE',
  'CHECK_FINANCIAL_RISK', 'SHOW_INSTITUTION', 'SHOW_COMMUNITY_REVIEW', 'SHOW_DEATH_REPORT',
  'COMPLETE_TASK', 'COMPLETE_DEATH_REPORT', 'ADVANCE_WORKFLOW', 'LEGAL_BOUNDARY', 'PAUSE', 'FALLBACK',
])
export type ActionName = z.infer<typeof actionNameSchema>

const toolNameSchema = z.enum([
  'getCaseState', 'updateCaseState', 'parseDocument', 'confirmExtractedField',
  'calculateFinancialSummary', 'calculateDeadlines', 'detectMissingInformation',
  'getPrioritizedTasks', 'matchRequiredDocuments', 'findLocalInstitutions',
  'searchCommunityReviews', 'updateTaskStatus',
  'generatePersonalProcedure', 'selectPriorityTask', 'calculateTaskReadiness',
  'buildPreparationPackage', 'confirmTaskCompletion', 'generateNextTask',
])
export type ToolName = z.infer<typeof toolNameSchema>

const selectionSchema = z.object({
  action: actionNameSchema,
  tools: z.array(toolNameSchema).max(3),
})
export type ActionSelection = z.infer<typeof selectionSchema>

const deterministicSelection = (classification: Classification, state: CaseState): ActionSelection => {
  const mapping: Record<Classification['intent'], ActionSelection> = {
    CASUAL_CHAT: { action: 'CHAT', tools: [] },
    START_ONBOARDING: { action: 'ONBOARD', tools: ['updateCaseState'] },
    ANSWER_AGENT_QUESTION: { action: 'FALLBACK', tools: [] },
    UPLOAD_DOCUMENT: { action: 'UPLOAD', tools: [] },
    CONFIRM_EXTRACTED_DATA: { action: 'CONFIRM_EXTRACTION', tools: [] },
    CORRECT_EXTRACTED_DATA: { action: 'CONFIRM_EXTRACTION', tools: [] },
    ADD_FINANCIAL_INFO: { action: 'FINANCIAL_INPUT', tools: [] },
    ASK_CURRENT_STATUS: { action: 'SHOW_STATUS', tools: ['getCaseState'] },
    ASK_NEXT_ACTION: { action: 'SHOW_NEXT_TASK', tools: ['getPrioritizedTasks'] },
    ASK_REQUIRED_DOCUMENTS: { action: 'SHOW_DOCUMENTS', tools: ['getPrioritizedTasks', 'matchRequiredDocuments'] },
    ASK_DEADLINE: { action: 'SHOW_DEADLINE', tools: ['calculateDeadlines'] },
    ASK_FINANCIAL_RISK: { action: 'CHECK_FINANCIAL_RISK', tools: ['calculateFinancialSummary'] },
    ASK_INSTITUTION: { action: 'SHOW_INSTITUTION', tools: ['findLocalInstitutions'] },
    ASK_COMMUNITY_TIP: { action: 'SHOW_COMMUNITY_REVIEW', tools: ['searchCommunityReviews'] },
    ASK_DEATH_REPORT: { action: 'SHOW_DEATH_REPORT', tools: ['getCaseState'] },
    UPDATE_TASK_STATUS: { action: 'COMPLETE_TASK', tools: ['getPrioritizedTasks', 'updateTaskStatus'] },
    DEATH_REPORT_COMPLETED: { action: 'COMPLETE_DEATH_REPORT', tools: ['updateTaskStatus', 'getPrioritizedTasks'] },
    ASK_LEGAL_DECISION: { action: 'LEGAL_BOUNDARY', tools: ['calculateFinancialSummary', 'calculateDeadlines'] },
    REQUEST_PAUSE: { action: 'PAUSE', tools: ['updateCaseState'] },
    CONTINUE_WORKFLOW: { action: 'ADVANCE_WORKFLOW', tools: [] },
    UNSUPPORTED: { action: 'FALLBACK', tools: [] },
  }
  if (
    classification.intent === 'ASK_NEXT_ACTION'
    && state.documents.some((document) => document.status === 'VERIFIED')
    && !state.workflow.procedureGenerated
  ) {
    return { action: 'ADVANCE_WORKFLOW', tools: [] }
  }
  return mapping[classification.intent]
}

export async function selectAction(classification: Classification, state: CaseState, llm?: AgentLLM): Promise<ActionSelection> {
  const fallback = deterministicSelection(classification, state)
  if (!llm) return fallback
  try {
    const raw = await llm.complete(
      `${selectActionPrompt.template}\n허용 action: ${actionNameSchema.options.join(', ')}\n허용 tools: ${toolNameSchema.options.join(', ')}\nJSON만 반환`,
      JSON.stringify({ classification, stage: state.stage, currentFocus: state.currentFocus, fallback }),
    )
    const proposal = selectionSchema.parse(extractJson(raw))
    if (['CASUAL_CHAT', 'ASK_LEGAL_DECISION', 'REQUEST_PAUSE'].includes(classification.intent)) return fallback
    if (classification.intent !== 'UNSUPPORTED' && proposal.action !== fallback.action) return fallback
    return proposal
  } catch {
    return fallback
  }
}
