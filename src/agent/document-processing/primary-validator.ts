import { PipelineExtractedField, ProcessedDocument, ValidationIssue } from '../schemas/document-pipeline'
import { DOCUMENT_LIMITS } from './config'

const criticalFields = new Set(['deceasedName', 'deathDate', 'inheritanceAwarenessDate', 'institution', 'category', 'amount', 'referenceDate'])

export const normalizeMoney = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null
  if (typeof value !== 'string') return null
  const numeric = Number(value.replace(/[^\d.-]/g, ''))
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

export const normalizeDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
  if (!match) return null
  const normalized = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
  const date = new Date(`${normalized}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized ? null : normalized
}

export function validateExtractedFields(document: ProcessedDocument, now = new Date()): ProcessedDocument {
  const issues: ValidationIssue[] = [...document.validationIssues]
  const fields = document.extractedFields.map((field): PipelineExtractedField => {
    let normalizedValue = field.value
    if (/date/i.test(field.key)) {
      normalizedValue = normalizeDate(field.value)
      if (!normalizedValue) issues.push(fieldIssue('INVALID_DATE', 'ERROR', document.documentId, field.key, `${field.label} 날짜를 확인하지 못했어요.`))
      else if (new Date(`${normalizedValue}T00:00:00Z`) > now) issues.push(fieldIssue('FUTURE_DATE', 'ERROR', document.documentId, field.key, `${field.label}이 미래 날짜로 표시되어 확인이 필요해요.`))
    }
    if (/amount|balance|total/i.test(field.key)) {
      normalizedValue = normalizeMoney(field.value)
      if (normalizedValue === null) issues.push(fieldIssue('INVALID_AMOUNT', 'ERROR', document.documentId, field.key, `${field.label} 금액을 확인하지 못했어요.`))
    }
    const hasEvidence = Boolean(field.source.textSnippet && field.source.page !== null)
    const requiresReview = criticalFields.has(field.key) || field.confidence < DOCUMENT_LIMITS.fieldConfidenceThreshold || !hasEvidence
    return { ...field, normalizedValue, verificationStatus: requiresReview ? 'NEEDS_USER_REVIEW' : 'AUTO_VERIFIED' }
  })
  if (!fields.length && document.status === 'PARSED') issues.push(fieldIssue('TOO_LITTLE_TEXT', 'WARNING', document.documentId, null, '이 파일에서는 확인할 수 있는 내용이 충분하지 않았어요.'))
  return {
    ...document,
    extractedFields: fields,
    validationIssues: issues,
    status: document.status === 'FAILED' || document.status === 'UNSUPPORTED'
      ? document.status
      : issues.some((item) => item.severity === 'ERROR' || item.severity === 'BLOCKING') || fields.some((field) => field.verificationStatus === 'NEEDS_USER_REVIEW')
        ? 'NEEDS_REVIEW'
        : document.status,
  }
}

const fieldIssue = (code: string, severity: ValidationIssue['severity'], documentId: string, fieldKey: string | null, message: string): ValidationIssue => ({
  code, severity, documentId, fieldKey, message, suggestedAction: '원문을 확인하거나 직접 입력해 주세요.',
})
