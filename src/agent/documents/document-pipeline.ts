import {
  DocumentPipelineInput,
  DocumentPipelineResult,
  DocumentType,
  PipelineExtractedField,
  ProcessedDocument,
  documentPipelineInputSchema,
  documentPipelineResultSchema,
} from '../schemas/document-pipeline'
import { DOCUMENT_LIMITS } from './config'
import { DocumentVerifier, MockDocumentVerifier } from './document-verifier'
import { inspectFile } from './file-inspector'
import { validateExtractedFields } from './primary-validator'

export interface DocumentPipelineAdapter {
  parse(input: DocumentPipelineInput): Promise<DocumentPipelineResult>
}

const field = (key: string, label: string, value: string | number | null, snippet: string | null, confidence = 0.94): PipelineExtractedField => ({
  key, label, value, normalizedValue: value,
  source: { page: 1, textSnippet: snippet, boundingBox: snippet ? [0.1, 0.1, 0.9, 0.2] : null },
  confidence,
  verificationStatus: 'UNVERIFIED',
})

const classifyFixture = (fileName: string): { type: DocumentType; confidence: number; fields: PipelineExtractedField[] } => {
  const name = fileName.toLowerCase()
  const conflictB = name.includes('death-certificate-b')
  if (name.includes('death-certificate')) return {
    type: 'DEATH_CERTIFICATE',
    confidence: name.includes('blurred') ? 0.58 : 0.96,
    fields: [field('deathDate', '사망일', conflictB ? '2026-07-08' : '2026-07-07', conflictB ? '사망일 2026-07-08' : '사망일 2026-07-07', name.includes('blurred') ? 0.55 : 0.97)],
  }
  if (name.includes('deposit')) return { type: 'FINANCIAL_ASSET_DOCUMENT', confidence: 0.91, fields: [field('institution', '금융기관', '테스트 금융사', '금융기관 테스트 금융사'), field('amount', '자산 금액', name.includes('120m') ? 120_000_000 : 17_000_000, name.includes('120m') ? '잔액 120,000,000원' : '잔액 17,000,000원'), field('referenceDate', '기준일', '2026-07-10', '기준일 2026-07-10')] }
  if (name.includes('card-debt')) return { type: 'CARD_DEBT_DOCUMENT', confidence: 0.9, fields: [field('institution', '금융기관', '테스트 카드사', '기관 테스트 카드사'), field('amount', '카드 채무', 3_000_000, '카드 이용대금 3,000,000원'), field('referenceDate', '기준일', '2026-07-10', '기준일 2026-07-10')] }
  if (name.includes('loan')) {
    const missing = name.includes('missing')
    const amount = name.includes('20m') ? 20_000_000 : 84_000_000
    return { type: 'FINANCIAL_DEBT_DOCUMENT', confidence: missing ? 0.62 : 0.93, fields: [field('institution', '금융기관', '테스트 금융사', '금융기관 테스트 금융사'), field('amount', '대출 잔액', missing ? null : amount, missing ? null : `대출 잔액 ${amount.toLocaleString('ko-KR')}원`, missing ? 0.35 : 0.95), field('referenceDate', '기준일', '2026-07-10', '기준일 2026-07-10')] }
  }
  if (name.includes('notice')) return { type: 'INSTITUTION_NOTICE', confidence: 0.82, fields: [] }
  return { type: 'UNKNOWN', confidence: 0.25, fields: [] }
}

export class MockDocumentPipelineAdapter implements DocumentPipelineAdapter {
  constructor(private verifier: DocumentVerifier = new MockDocumentVerifier()) {}

  async parse(rawInput: DocumentPipelineInput): Promise<DocumentPipelineResult> {
    const input = documentPipelineInputSchema.parse(rawInput)
    const duplicateNames = new Set<string>()
    const documents: ProcessedDocument[] = input.files.map((file) => {
      const inspection = inspectFile(file)
      const classification = classifyFixture(file.fileName)
      const duplicate = duplicateNames.has(`${file.fileName}:${file.bytesBase64}`)
      duplicateNames.add(`${file.fileName}:${file.bytesBase64}`)
      const validationIssues = [...inspection.issues]
      if (duplicate) validationIssues.push({ code: 'DUPLICATE_FILE', severity: 'BLOCKING', documentId: file.fileId, fieldKey: null, message: '같은 파일이 두 번 올라온 것으로 보여요.', suggestedAction: '한 파일만 남길지 확인해 주세요.' })
      const unsupported = !inspection.detectedMimeType || inspection.encryptedPdf
      const inputForm = inspection.detectedMimeType === 'application/pdf' ? 'PDF'
        : /screenshot|capture/i.test(file.fileName) ? 'SCREENSHOT'
          : /scan/i.test(file.fileName) ? 'SCAN' : 'PHOTO'
      const needsClassification = classification.confidence < DOCUMENT_LIMITS.classificationThreshold
      const document: ProcessedDocument = {
        documentId: file.fileId,
        fileName: file.fileName,
        mimeType: inspection.detectedMimeType || file.declaredMimeType,
        inputForm,
        documentType: classification.type,
        classificationConfidence: classification.confidence,
        alternativeTypes: classification.type === 'UNKNOWN' ? [] : [{ type: 'UNKNOWN', confidence: 1 - classification.confidence }],
        status: unsupported ? (inspection.detectedMimeType ? 'FAILED' : 'UNSUPPORTED') : needsClassification ? 'NEEDS_REVIEW' : 'PARSED',
        extractedFields: classification.fields,
        validationIssues,
      }
      return validateExtractedFields(document)
    })
    const verified = await this.verifier.verify(documents)
    const crossDocumentIssues = verified.issues
    const requiresUserConfirmation = verified.documents.some((document) => document.status === 'NEEDS_REVIEW' || document.extractedFields.some((item) => item.verificationStatus === 'NEEDS_USER_REVIEW'))
      || crossDocumentIssues.some((issue) => issue.severity === 'BLOCKING')
    const failedCount = verified.documents.filter((document) => document.status === 'FAILED' || document.status === 'UNSUPPORTED').length
    const reviewCount = verified.documents.reduce((sum, document) => sum + document.extractedFields.filter((item) => item.verificationStatus === 'NEEDS_USER_REVIEW').length, 0)
    const explanation = failedCount
      ? `올려주신 파일 중 ${failedCount}개에서는 내용을 충분히 확인하지 못했어요. 조금 더 선명한 파일로 다시 올리거나 직접 입력할 수 있어요.`
      : crossDocumentIssues.some((issue) => issue.code === 'DEATH_DATE_CONFLICT')
        ? '두 서류에 적힌 사망일이 서로 달라요. 기한 계산에 영향을 줄 수 있어 어느 날짜가 맞는지 먼저 확인해야 합니다.'
        : `올려주신 서류 ${verified.documents.length}개를 정리했어요. 중요한 정보 중 ${reviewCount}개는 직접 확인이 필요해요. 확인할 항목부터 하나씩 볼까요?`
    return documentPipelineResultSchema.parse({
      batchId: input.batchId,
      documents: verified.documents,
      batchIssues: [],
      crossDocumentIssues,
      requiresUserConfirmation,
      explanation,
    })
  }
}

export class LiveDocumentPipelineAdapter implements DocumentPipelineAdapter {
  constructor(private apiKey: string, private verifier: DocumentVerifier = new MockDocumentVerifier()) {}

  async parse(rawInput: DocumentPipelineInput): Promise<DocumentPipelineResult> {
    const input = documentPipelineInputSchema.parse(rawInput)
    if (!this.apiKey) throw new Error('UPSTAGE_API_KEY_REQUIRED')
    const documents: ProcessedDocument[] = []
    for (const file of input.files) {
      const inspection = inspectFile(file)
      if (!inspection.detectedMimeType || inspection.encryptedPdf || inspection.issues.some((issue) => issue.severity === 'ERROR')) {
        documents.push(validateExtractedFields({
          documentId: file.fileId, fileName: file.fileName, mimeType: file.declaredMimeType,
          inputForm: inspection.detectedMimeType === 'application/pdf' ? 'PDF' : 'PHOTO',
          documentType: 'UNKNOWN', classificationConfidence: 0, alternativeTypes: [],
          status: inspection.detectedMimeType ? 'FAILED' : 'UNSUPPORTED', extractedFields: [], validationIssues: inspection.issues,
        }))
        continue
      }
      const form = new FormData()
      form.append('document', new Blob([inspection.bytes], { type: inspection.detectedMimeType }), file.fileName)
      form.append('ocr', 'force')
      form.append('model', 'document-parse')
      const response = await fetch('https://api.upstage.ai/v1/document-digitization', { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}` }, body: form })
      if (!response.ok) throw new Error(`DOCUMENT_PARSE_${response.status}`)
      const parsed = await response.json() as { content?: { html?: string }; text?: string }
      const rawText = parsed.content?.html || parsed.text || ''
      documents.push(validateExtractedFields({
        documentId: file.fileId, fileName: file.fileName, mimeType: inspection.detectedMimeType,
        inputForm: inspection.detectedMimeType === 'application/pdf' ? 'PDF' : 'PHOTO',
        documentType: 'UNKNOWN', classificationConfidence: 0, alternativeTypes: [],
        status: 'NEEDS_REVIEW', extractedFields: [],
        validationIssues: [{ code: 'LIVE_CLASSIFICATION_PENDING', severity: 'WARNING', documentId: file.fileId, fieldKey: null, message: rawText ? '원문은 분석했지만 문서 종류와 중요 필드는 사용자 확인이 필요해요.' : '이 파일에서는 내용을 충분히 확인하지 못했어요.', suggestedAction: '문서 제목과 중요 정보를 확인해 주세요.' }],
      }))
    }
    const verified = await this.verifier.verify(documents)
    return documentPipelineResultSchema.parse({
      batchId: input.batchId,
      documents: verified.documents,
      batchIssues: [],
      crossDocumentIssues: verified.issues,
      requiresUserConfirmation: true,
      explanation: `올려주신 서류 ${documents.length}개의 원문을 분석했어요. 실제 양식별 추출 스키마가 연결되기 전까지 문서 종류와 중요 정보는 직접 확인해 주세요.`,
    })
  }
}
