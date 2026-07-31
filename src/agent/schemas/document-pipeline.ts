import { z } from 'zod'

export const documentTypeSchema = z.enum([
  'DEATH_CERTIFICATE', 'DEATH_REPORT', 'FAMILY_RELATION_CERTIFICATE', 'BASIC_CERTIFICATE',
  'FINANCIAL_DOCUMENT',
  'FINANCIAL_ASSET_DOCUMENT', 'FINANCIAL_DEBT_DOCUMENT', 'CARD_DEBT_DOCUMENT',
  'INSTITUTION_NOTICE', 'SCREENSHOT', 'UNKNOWN',
])

export const validationIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'BLOCKING']),
  documentId: z.string().nullable(),
  fieldKey: z.string().nullable(),
  message: z.string(),
  suggestedAction: z.string().nullable(),
})

export const pipelineExtractedFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.union([z.string(), z.number(), z.null()]),
  normalizedValue: z.union([z.string(), z.number(), z.null()]),
  source: z.object({
    page: z.number().int().positive().nullable(),
    textSnippet: z.string().nullable(),
    boundingBox: z.array(z.number()).nullable(),
  }),
  confidence: z.number().min(0).max(1),
  verificationStatus: z.enum(['UNVERIFIED', 'AUTO_VERIFIED', 'NEEDS_USER_REVIEW', 'USER_VERIFIED', 'REJECTED']),
})

export const processedDocumentSchema = z.object({
  documentId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  inputForm: z.enum(['PHOTO', 'SCAN', 'SCREENSHOT', 'PDF']),
  documentType: documentTypeSchema,
  classificationConfidence: z.number().min(0).max(1),
  alternativeTypes: z.array(z.object({ type: documentTypeSchema, confidence: z.number().min(0).max(1) })).default([]),
  status: z.enum(['PARSED', 'NEEDS_REVIEW', 'UNSUPPORTED', 'FAILED']),
  extractedFields: z.array(pipelineExtractedFieldSchema),
  validationIssues: z.array(validationIssueSchema),
  sourcePreviewUrl: z.string().optional(),
})

export const documentPipelineResultSchema = z.object({
  batchId: z.string(),
  documents: z.array(processedDocumentSchema),
  batchIssues: z.array(validationIssueSchema),
  crossDocumentIssues: z.array(validationIssueSchema),
  requiresUserConfirmation: z.boolean(),
  explanation: z.string(),
})

export const documentPipelineFileSchema = z.object({
  fileId: z.string(),
  fileName: z.string(),
  declaredMimeType: z.string(),
  bytesBase64: z.string(),
  fixtureId: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

export const documentPipelineInputSchema = z.object({
  batchId: z.string(),
  files: z.array(documentPipelineFileSchema).min(1).max(10),
})

export const documentProgressSchema = z.object({
  fileId: z.string(),
  status: z.enum(['UPLOADED', 'CLASSIFYING', 'EXTRACTING', 'VALIDATING_PRIMARY', 'VALIDATING_SECONDARY', 'NEEDS_REVIEW', 'COMPLETED', 'FAILED']),
  progress: z.number().min(0).max(100),
  label: z.string(),
})

export type DocumentType = z.infer<typeof documentTypeSchema>
export type ValidationIssue = z.infer<typeof validationIssueSchema>
export type PipelineExtractedField = z.infer<typeof pipelineExtractedFieldSchema>
export type ProcessedDocument = z.infer<typeof processedDocumentSchema>
export type DocumentPipelineResult = z.infer<typeof documentPipelineResultSchema>
export type DocumentPipelineInput = z.infer<typeof documentPipelineInputSchema>
export type DocumentPipelineFile = z.infer<typeof documentPipelineFileSchema>
export type DocumentProgress = z.infer<typeof documentProgressSchema>
