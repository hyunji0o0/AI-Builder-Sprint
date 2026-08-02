import { z } from 'zod'

export const caseStageSchema = z.enum([
  'FIRST_VISIT', 'COLLECTING_BASIC_INFO', 'WAITING_FOR_DOCUMENT',
  'CONFIRMING_EXTRACTION', 'COLLECTING_FINANCIAL_INFO',
  'CHECKING_MISSING_INFO', 'URGENT_REVIEW', 'PREPARING_CONSULTATION',
  'IN_PROGRESS', 'COMPLETED',
])

export const agentWorkflowPhaseSchema = z.enum([
  'DOCUMENT_REVIEW',
  'GENERATING_PERSONAL_PROCEDURE',
  'SELECTING_PRIORITY_TASK',
  'COLLECTING_MISSING_DOCUMENTS',
  'PREPARING_TASK',
  'CONNECTING_OFFICIAL_PROCESS',
  'CONFIRMING_TASK_COMPLETION',
  'GENERATING_NEXT_TASK',
  'ALL_TASKS_COMPLETED',
])

export const agentWorkflowSchema = z.object({
  phase: agentWorkflowPhaseSchema,
  procedureGenerated: z.boolean(),
  priorityTaskId: z.string().nullable(),
  missingDocumentTypes: z.array(z.string()),
  preparationPackageReady: z.boolean(),
  officialConnectionReady: z.boolean(),
  completionPending: z.boolean(),
})

export const emotionalContextSchema = z.object({
  currentSignal: z.enum(['DISTRESSED', 'NEUTRAL', 'POSITIVE']),
  intensity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  tonePreference: z.enum(['WARM', 'CONCISE', 'BALANCED']),
  recentComfortCount: z.number().int().nonnegative(),
  userRequestedPause: z.boolean(),
})

export const agentMemorySchema = z.object({
  conversationSummary: z.string().max(4000),
  confirmedFacts: z.array(z.object({
    key: z.string(),
    label: z.string(),
    value: z.string(),
  })).max(60),
  pendingInteraction: z.object({
    type: z.string(),
    targetId: z.string().nullable(),
    expectedInput: z.string(),
  }).nullable(),
  recentEvents: z.array(z.object({
    type: z.string(),
    description: z.string(),
    occurredAt: z.string(),
  })).max(30),
  lastIntent: z.string().nullable(),
})

export const onboardingStatusSchema = z.enum(['UNKNOWN', 'COMPLETED', 'NOT_COMPLETED'])
// FINANCIAL_INQUIRY는 이전에 저장된 세션을 읽기 위한 호환 값이다.
// 새 온보딩 흐름에서는 DEATH_REPORT -> ONE_STOP_SERVICE -> COMPLETE만 사용한다.
export const onboardingStepSchema = z.enum(['DEATH_REPORT', 'FINANCIAL_INQUIRY', 'ONE_STOP_SERVICE', 'COMPLETE'])
export const onboardingStateSchema = z.object({
  currentStep: onboardingStepSchema,
  deathReportStatus: onboardingStatusSchema,
  financialInquiryStatus: onboardingStatusSchema,
  oneStopServiceStatus: onboardingStatusSchema,
})

export const financialCoverageSchema = z.object({
  status: z.enum(['NOT_CHECKED', 'PENDING', 'HELP_REQUESTED', 'PROCEED_WITH_AVAILABLE', 'COMPLETE']),
  receivedOrganizationKeys: z.array(z.string()),
  missingOrganizationKeys: z.array(z.string()),
}).transform((coverage) => ({
  ...coverage,
  // 이전 세션에 남아 있는 대부금융협회 키도 조회 대상과 누락 안내에서 제거한다.
  receivedOrganizationKeys: coverage.receivedOrganizationKeys.filter((key) => key !== 'consumer_finance'),
  missingOrganizationKeys: coverage.missingOrganizationKeys.filter((key) => key !== 'consumer_finance'),
}))

export const extractedFieldSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.null()]),
  sourcePage: z.number().int().positive().nullable(),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'NEEDS_REVIEW']),
  verifiedByUser: z.boolean(),
})

export const documentStateSchema = z.object({
  id: z.string(),
  type: z.enum([
    'DEATH_CERTIFICATE', 'DEATH_REPORT', 'FAMILY_RELATION_CERTIFICATE', 'BASIC_CERTIFICATE',
    'FINANCIAL_DOCUMENT',
    'FINANCIAL_ASSET_DOCUMENT', 'FINANCIAL_DEBT_DOCUMENT', 'CARD_DEBT_DOCUMENT',
    'INSTITUTION_NOTICE', 'SCREENSHOT', 'UNKNOWN',
  ]),
  fileName: z.string(),
  status: z.enum(['UPLOADED', 'PARSING', 'NEEDS_CONFIRMATION', 'VERIFIED', 'FAILED']),
  extractedFields: z.array(extractedFieldSchema),
})

export const financialItemSchema = z.object({
  id: z.string(),
  category: z.enum(['ASSET', 'DEBT']),
  type: z.enum(['DEPOSIT', 'LOAN', 'CARD_DEBT', 'INSURANCE', 'PROPERTY', 'VEHICLE', 'OTHER']),
  institution: z.string().nullable(),
  amount: z.number().nonnegative().nullable(),
  amountStatus: z.enum(['VERIFIED', 'ESTIMATED', 'UNKNOWN']),
  source: z.enum(['DOCUMENT', 'USER_INPUT']),
  sourceDocumentId: z.string().nullable(),
})

export const requiredDocumentSchema = z.object({
  type: z.string(),
  label: z.string(),
  required: z.boolean(),
  verified: z.boolean(),
})

export const taskStateSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  priority: z.enum(['URGENT', 'HIGH', 'NORMAL', 'LOW']),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE']),
  deadline: z.string().nullable(),
  daysRemaining: z.number().int().nullable(),
  readiness: z.number().min(0).max(100),
  requiredDocuments: z.array(requiredDocumentSchema),
  officialSourceIds: z.array(z.string()),
  category: z.enum(['INFORMATION', 'DOCUMENT', 'FINANCIAL', 'CONSULTATION', 'OFFICIAL_PROCESS']).optional(),
  reason: z.string().optional(),
  dependsOnTaskIds: z.array(z.string()).optional(),
  basisFacts: z.array(z.string()).optional(),
  applicability: z.enum(['CONFIRMED', 'REVIEW_REQUIRED']).optional(),
})

export const missingFieldSchema = z.object({
  id: z.string(),
  field: z.string(),
  label: z.string(),
  resolved: z.boolean(),
})

export const caseWarningSchema = z.object({
  id: z.string(),
  type: z.enum(['DEADLINE', 'FINANCIAL_RISK', 'MISSING_INFORMATION']),
  severity: z.enum(['INFO', 'WARNING', 'URGENT']),
  message: z.string(),
})

export const caseStateSchema = z.object({
  caseId: z.string(),
  stage: caseStageSchema,
  user: z.object({
    relationToDeceased: z.string().nullable(),
    region: z.object({ city: z.string().nullable(), district: z.string().nullable() }),
  }),
  deceased: z.object({
    name: z.string().nullable(),
    deathDate: z.string().nullable(),
    inheritanceAwarenessDate: z.string().nullable(),
  }),
  documents: z.array(documentStateSchema),
  financials: z.object({
    assets: z.array(financialItemSchema),
    debts: z.array(financialItemSchema),
    totalAssets: z.number().nullable(),
    totalDebts: z.number().nullable(),
    difference: z.number().nullable(),
    hasUnverifiedItems: z.boolean(),
  }),
  financialCoverage: financialCoverageSchema.default({
    status: 'NOT_CHECKED',
    receivedOrganizationKeys: [],
    missingOrganizationKeys: [],
  }),
  tasks: z.array(taskStateSchema),
  missingFields: z.array(missingFieldSchema),
  warnings: z.array(caseWarningSchema),
  currentFocus: z.object({ type: z.string().nullable(), id: z.string().nullable() }),
  emotionalContext: emotionalContextSchema,
  memory: agentMemorySchema.default({
    conversationSummary: '',
    confirmedFacts: [],
    pendingInteraction: null,
    recentEvents: [],
    lastIntent: null,
  }),
  onboarding: onboardingStateSchema.default({
    currentStep: 'DEATH_REPORT',
    deathReportStatus: 'UNKNOWN',
    financialInquiryStatus: 'UNKNOWN',
    oneStopServiceStatus: 'UNKNOWN',
  }),
  workflow: agentWorkflowSchema.default({
    phase: 'DOCUMENT_REVIEW',
    procedureGenerated: false,
    priorityTaskId: null,
    missingDocumentTypes: [],
    preparationPackageReady: false,
    officialConnectionReady: false,
    completionPending: false,
  }),
  onboardingCompleted: z.boolean(),
  lastUpdatedAt: z.string(),
})

export type CaseStage = z.infer<typeof caseStageSchema>
export type AgentWorkflowPhase = z.infer<typeof agentWorkflowPhaseSchema>
export type EmotionalContext = z.infer<typeof emotionalContextSchema>
export type AgentMemory = z.infer<typeof agentMemorySchema>
export type DocumentState = z.infer<typeof documentStateSchema>
export type FinancialItem = z.infer<typeof financialItemSchema>
export type TaskState = z.infer<typeof taskStateSchema>
export type CaseState = z.infer<typeof caseStateSchema>
