import { z } from 'zod'

export const caseStageSchema = z.enum([
  'FIRST_VISIT', 'COLLECTING_BASIC_INFO', 'WAITING_FOR_DOCUMENT',
  'CONFIRMING_EXTRACTION', 'COLLECTING_FINANCIAL_INFO',
  'CHECKING_MISSING_INFO', 'URGENT_REVIEW', 'PREPARING_CONSULTATION',
  'IN_PROGRESS', 'COMPLETED',
])

export const emotionalContextSchema = z.object({
  currentSignal: z.enum(['DISTRESSED', 'NEUTRAL', 'POSITIVE']),
  intensity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  tonePreference: z.enum(['WARM', 'CONCISE', 'BALANCED']),
  recentComfortCount: z.number().int().nonnegative(),
  userRequestedPause: z.boolean(),
})

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
    'DEATH_CERTIFICATE', 'FAMILY_RELATION_CERTIFICATE', 'BASIC_CERTIFICATE',
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
  tasks: z.array(taskStateSchema),
  missingFields: z.array(missingFieldSchema),
  warnings: z.array(caseWarningSchema),
  currentFocus: z.object({ type: z.string().nullable(), id: z.string().nullable() }),
  emotionalContext: emotionalContextSchema,
  onboardingCompleted: z.boolean(),
  lastUpdatedAt: z.string(),
})

export type CaseStage = z.infer<typeof caseStageSchema>
export type EmotionalContext = z.infer<typeof emotionalContextSchema>
export type DocumentState = z.infer<typeof documentStateSchema>
export type FinancialItem = z.infer<typeof financialItemSchema>
export type TaskState = z.infer<typeof taskStateSchema>
export type CaseState = z.infer<typeof caseStateSchema>
