import { z } from 'zod'
import { caseStageSchema } from './case-state'
import { documentTypeSchema, validationIssueSchema } from './document-pipeline'

export const userIntentSchema = z.enum([
  'CASUAL_CHAT', 'START_ONBOARDING', 'ANSWER_AGENT_QUESTION', 'UPLOAD_DOCUMENT',
  'CONFIRM_EXTRACTED_DATA', 'CORRECT_EXTRACTED_DATA', 'ADD_FINANCIAL_INFO',
  'ASK_CURRENT_STATUS', 'ASK_NEXT_ACTION', 'ASK_REQUIRED_DOCUMENTS', 'ASK_DEADLINE',
  'ASK_FINANCIAL_RISK', 'ASK_COMMUNITY_TIP', 'ASK_DEATH_REPORT',
  'UPDATE_TASK_STATUS', 'DEATH_REPORT_COMPLETED', 'ASK_LEGAL_DECISION', 'ASK_LEGAL_INFORMATION', 'REQUEST_PAUSE',
  'CONTINUE_WORKFLOW', 'START_CONSULTATION_PREPARATION', 'PROCEED_WITH_AVAILABLE_DATA', 'UNSUPPORTED',
])

export const emotionalSignalSchema = z.enum(['DISTRESSED', 'NEUTRAL', 'POSITIVE'])
export const intensitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'])

export const classificationSchema = z.object({
  intent: userIntentSchema,
  emotion: z.object({ signal: emotionalSignalSchema, intensity: intensitySchema }),
  confidence: z.number().min(0).max(1),
})

const actionSchema = z.object({ id: z.string(), label: z.string() })

export const agentUIBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CHOICE'), prompt: z.string(), options: z.array(actionSchema) }),
  z.object({ type: z.literal('DATE_INPUT'), label: z.string(), field: z.string() }),
  z.object({ type: z.literal('DOCUMENT_UPLOAD'), accept: z.array(z.string()), taskId: z.string().nullable() }),
  z.object({ type: z.literal('EXTRACTION_CONFIRMATION'), documentId: z.string(), fields: z.array(z.object({ key: z.string(), value: z.union([z.string(), z.number(), z.null()]), needsReview: z.boolean() })) }),
  z.object({ type: z.literal('FINANCIAL_INPUT'), category: z.enum(['ASSET', 'DEBT', 'BOTH']), itemId: z.string().nullable() }),
  z.object({ type: z.literal('RISK_ALERT'), level: z.enum(['INFO', 'WARNING', 'URGENT_REVIEW']), title: z.string(), facts: z.array(z.string()), disclaimer: z.string() }),
  z.object({ type: z.literal('TASK_CARD'), taskId: z.string(), title: z.string(), priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']), readiness: z.number(), actions: z.array(actionSchema) }),
  z.object({ type: z.literal('DOCUMENT_CHECKLIST'), taskId: z.string().nullable(), items: z.array(z.object({ id: z.string(), label: z.string(), verified: z.boolean() })) }),
  z.object({
    type: z.literal('ONE_STOP_SERVICE_GUIDE'),
    stage: z.enum(['APPLICATION', 'RESULTS']),
    eyebrow: z.string(),
    title: z.string(),
    description: z.string(),
    infoItems: z.array(z.object({ id: z.string(), title: z.string(), description: z.string() })),
    checklist: z.array(z.object({ id: z.string(), label: z.string(), note: z.string().nullable() })),
    resources: z.array(z.object({
      id: z.string(),
      label: z.string(),
      url: z.string().url(),
      kind: z.enum(['APPLICATION', 'GUIDE']),
    })),
    notice: z.string(),
    actions: z.array(actionSchema),
  }),
  z.object({
    type: z.literal('DEATH_REPORT_PREPARATION'),
    taskId: z.string(),
    title: z.string(),
    deadlineText: z.string(),
    submissionMethods: z.array(z.string()),
    checklist: z.array(z.object({
      id: z.string(),
      label: z.string(),
      status: z.enum(['HELD', 'CHECK_REQUIRED', 'OPTIONAL']),
      note: z.string().nullable(),
    })),
    resources: z.array(z.object({
      id: z.string(),
      label: z.string(),
      url: z.string().url(),
      kind: z.enum(['FORM', 'GUIDE']),
    })),
    notice: z.string(),
    actions: z.array(actionSchema),
  }),
  z.object({ type: z.literal('COMMUNITY_REVIEW'), reviews: z.array(z.object({ id: z.string(), excerpt: z.string(), reason: z.string(), createdAt: z.string(), helpfulCount: z.number(), url: z.string().nullable(), label: z.literal('사용자 경험') })), disclaimer: z.string() }),
  z.object({
    type: z.literal('LEGAL_REFERENCE'),
    title: z.string(),
    provisions: z.array(z.object({
      id: z.string(), lawName: z.string(), article: z.string(), rule: z.string(),
      caution: z.string(), effectiveDate: z.string(), checkedAt: z.string(), sourceUrl: z.string().url(),
    })).min(1).max(3),
    disclaimer: z.string(),
  }),
  z.object({ type: z.literal('PROGRESS_SUMMARY'), progress: z.number(), completedTasks: z.number(), totalTasks: z.number() }),
  z.object({
    type: z.literal('PROCEDURE_PLAN'),
    steps: z.array(z.object({
      taskId: z.string(),
      title: z.string(),
      priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']),
      status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE']),
      reason: z.string(),
      basisFacts: z.array(z.string()),
      dependencyTitles: z.array(z.string()),
      requiredDocuments: z.array(z.object({
        label: z.string(),
        status: z.enum(['HELD', 'MISSING']),
      })),
      applicability: z.enum(['CONFIRMED', 'REVIEW_REQUIRED']),
    })).max(6),
  }),
  z.object({
    type: z.literal('MISSING_INFORMATION_QUESTION'),
    fieldId: z.string(),
    prompt: z.string(),
    inputType: z.enum(['DATE', 'TEXT', 'CHOICE']),
    options: z.array(actionSchema),
  }),
  z.object({
    type: z.literal('TASK_READINESS'),
    taskId: z.string(),
    title: z.string(),
    readiness: z.number().min(0).max(100),
    documents: z.array(z.object({
      type: z.string(),
      label: z.string(),
      status: z.enum(['HELD', 'PARTIAL', 'NEEDS_REVIEW', 'MISSING', 'NOT_APPLICABLE']),
    })),
  }),
  z.object({
    type: z.literal('PREPARATION_PACKAGE'),
    taskId: z.string(),
    title: z.string(),
    readiness: z.number().min(0).max(100),
    confirmedFacts: z.array(z.string()),
    unresolvedItems: z.array(z.string()),
    questionsForExpert: z.array(z.string()).max(3),
    disclaimer: z.string(),
  }),
  z.object({
    type: z.literal('OFFICIAL_PROCESS'),
    taskId: z.string(),
    title: z.string(),
    checklist: z.array(z.string()),
  }),
  z.object({
    type: z.literal('COMPLETION_CONFIRMATION'),
    taskId: z.string(),
    title: z.string(),
    actions: z.array(actionSchema),
  }),
  z.object({
    type: z.literal('DOCUMENT_BATCH_SUMMARY'),
    batchId: z.string(),
    files: z.array(z.object({ documentId: z.string(), fileName: z.string(), documentType: documentTypeSchema, status: z.string(), confidence: z.number() })),
    issues: z.array(validationIssueSchema),
  }),
  z.object({
    type: z.literal('DOCUMENT_CLASSIFICATION_CONFIRMATION'),
    documentId: z.string(),
    fileName: z.string(),
    suggestedType: documentTypeSchema,
    confidence: z.number(),
    alternatives: z.array(z.object({ type: documentTypeSchema, confidence: z.number() })),
    actions: z.array(actionSchema),
  }),
  z.object({
    type: z.literal('FIELD_VERIFICATION'),
    documentId: z.string(),
    fieldKey: z.string(),
    label: z.string(),
    value: z.union([z.string(), z.number(), z.null()]),
    formattedValue: z.string(),
    sourcePage: z.number().nullable(),
    sourceText: z.string().nullable(),
    status: z.literal('NEEDS_USER_REVIEW'),
    actions: z.array(actionSchema),
  }),
  z.object({
    type: z.literal('DOCUMENT_EXTRACTION_REVIEW'),
    documentId: z.string(),
    fileName: z.string(),
    documentTypeLabel: z.string(),
    confidence: z.number().min(0).max(1),
    items: z.array(z.object({
      fieldKey: z.string(),
      label: z.string(),
      value: z.union([z.string(), z.number(), z.null()]),
      formattedValue: z.string(),
    })),
    notice: z.string(),
    actions: z.array(actionSchema),
  }),
  z.object({
    type: z.literal('DOCUMENT_CONFLICT'),
    title: z.string(),
    issues: z.array(validationIssueSchema),
    actions: z.array(actionSchema),
  }),
  z.object({
    type: z.literal('FINANCIAL_COVERAGE_REVIEW'),
    title: z.string(),
    receivedInstitutions: z.array(z.string()),
    missingInstitutions: z.array(z.string()),
    notice: z.string(),
    actions: z.array(actionSchema).max(3),
  }),
  z.object({
    type: z.literal('DOCUMENT_CORRECTION_RESULT'),
    documentId: z.string(),
    label: z.string(),
    previousValue: z.number(),
    nextValue: z.number(),
    totalAssets: z.number().nullable(),
    totalDebts: z.number().nullable(),
    actions: z.array(actionSchema).max(2),
  }),
])

export const agentOutputSchema = z.object({
  message: z.string(),
  ui: z.array(agentUIBlockSchema),
  suggestedActions: z.array(actionSchema).max(3),
  stateSummary: z.object({
    stage: caseStageSchema,
    progress: z.number().min(0).max(100),
    todayTaskCount: z.number().int().nonnegative(),
    verifiedDocumentCount: z.number().int().nonnegative(),
    needsReviewCount: z.number().int().nonnegative(),
  }),
  meta: z.object({
    intent: userIntentSchema,
    emotionalSignal: emotionalSignalSchema,
    usedTools: z.array(z.string()).max(3),
    requiresDisclaimer: z.boolean(),
  }),
})

export const agentRequestSchema = z.object({
  input: z.string().min(1).max(4000),
  caseState: z.unknown(),
  uiActionIntent: userIntentSchema.optional(),
  recentMessages: z.array(z.object({
    role: z.enum(['agent', 'user']),
    text: z.string().max(4000),
  })).max(24).optional(),
})

export type UserIntent = z.infer<typeof userIntentSchema>
export type EmotionalSignal = z.infer<typeof emotionalSignalSchema>
export type Classification = z.infer<typeof classificationSchema>
export type AgentUIBlock = z.infer<typeof agentUIBlockSchema>
export type AgentOutput = z.infer<typeof agentOutputSchema>
