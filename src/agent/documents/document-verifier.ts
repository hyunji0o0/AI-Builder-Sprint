import { ProcessedDocument, ValidationIssue } from '../schemas/document-pipeline'

export type DocumentVerificationResult = {
  documents: ProcessedDocument[]
  issues: ValidationIssue[]
}

export interface DocumentVerifier {
  verify(documents: ProcessedDocument[]): Promise<DocumentVerificationResult>
}

export class MockDocumentVerifier implements DocumentVerifier {
  async verify(documents: ProcessedDocument[]): Promise<DocumentVerificationResult> {
    const issues: ValidationIssue[] = []
    const deathDates = documents.flatMap((document) => document.extractedFields.filter((field) => field.key === 'deathDate').map((field) => ({ documentId: document.documentId, value: field.normalizedValue })))
    if (new Set(deathDates.map((item) => item.value).filter(Boolean)).size > 1) {
      issues.push({ code: 'DEATH_DATE_CONFLICT', severity: 'BLOCKING', documentId: null, fieldKey: 'deathDate', message: '두 서류에 적힌 사망일이 서로 달라요.', suggestedAction: '기한 계산 전에 어느 날짜가 맞는지 확인해 주세요.' })
    }

    const seenFinancial = new Map<string, string>()
    for (const document of documents) {
      const institution = document.extractedFields.find((field) => field.key === 'institution')?.normalizedValue
      const amount = document.extractedFields.find((field) => field.key === 'amount')?.normalizedValue
      if (!institution || amount === null || amount === undefined) continue
      const key = `${document.documentType}:${institution}:${amount}`
      const previous = seenFinancial.get(key)
      if (previous) issues.push({ code: 'POSSIBLE_DUPLICATE_FINANCIAL_ITEM', severity: 'BLOCKING', documentId: document.documentId, fieldKey: 'amount', message: '같은 금융 항목이 중복으로 등록되었을 가능성이 있어요.', suggestedAction: '두 문서가 같은 항목인지 확인해 주세요.' })
      else seenFinancial.set(key, document.documentId)
    }

    const blockedDocuments = new Set(issues.filter((issue) => issue.severity === 'BLOCKING').map((issue) => issue.documentId).filter(Boolean))
    return {
      documents: documents.map((document) => blockedDocuments.has(document.documentId) ? { ...document, status: 'NEEDS_REVIEW' as const } : document),
      issues,
    }
  }
}

