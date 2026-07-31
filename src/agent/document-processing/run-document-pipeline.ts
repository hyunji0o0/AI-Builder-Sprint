import { agentOutputSchema, AgentOutput, AgentUIBlock } from '../schemas/agent-output'
import { CaseState, caseStateSchema } from '../schemas/case-state'
import { DocumentPipelineInput, DocumentPipelineResult } from '../schemas/document-pipeline'
import { calculateProgress } from '../shared/state-summary'
import { DocumentPipelineAdapter } from './document-pipeline'

const criticalKeys = new Set(['deceasedName', 'deathDate', 'inheritanceAwarenessDate', 'institution', 'category', 'amount', 'referenceDate'])
const documentTypeLabels: Record<string, string> = {
  DEATH_CERTIFICATE: '사망진단서',
  DEATH_REPORT: '사망신고서',
  FAMILY_RELATION_CERTIFICATE: '가족관계증명서',
  BASIC_CERTIFICATE: '기본증명서',
  FINANCIAL_DOCUMENT: '금융거래 조회 결과',
  FINANCIAL_ASSET_DOCUMENT: '금융자산 문서',
  FINANCIAL_DEBT_DOCUMENT: '채무 문서',
  CARD_DEBT_DOCUMENT: '카드 채무 문서',
  INSTITUTION_NOTICE: '기관 안내 문서',
  SCREENSHOT: '화면 캡처',
  UNKNOWN: '문서 종류 확인 필요',
}

const valueLabels: Record<string, string> = {
  completed: '조회 완료',
  pending: '조회 중',
  matched: '확인됨',
  name_mismatch: '성명 불일치',
  no_records: '조회 내역 없음',
}

const financialSummaryKeys = new Set([
  'message', 'recordCount', 'hasFinancialRecords',
  'totalAssets', 'totalDebts', 'pendingInstitution',
  'hasUnclaimedDepositRecords', 'unclaimedDepositRecordCount',
  'hasDebtRecords', 'debtRecordCount', 'depositAccountCount',
  'closedDepositCount', 'loanCount', 'loanAmount', 'paymentCount',
  'guaranteeCount', 'guaranteeAmount',
])

const fieldValue = (document: DocumentPipelineResult['documents'][number], key: string) =>
  document.extractedFields.find((field) => field.key === key)?.normalizedValue

const organizationNameOf = (document: DocumentPipelineResult['documents'][number]) => {
  const name = fieldValue(document, 'organizationName')
  return typeof name === 'string' && name.trim() ? name.trim() : null
}

const documentLabelOf = (document: DocumentPipelineResult['documents'][number]) => {
  const base = documentTypeLabels[document.documentType] ?? '문서 종류 확인 필요'
  const organization = organizationNameOf(document)
  return document.documentType === 'FINANCIAL_DOCUMENT' && organization
    ? `${organization} 금융거래 조회 결과`
    : base
}

const describeClassifiedDocuments = (pipelineResult: DocumentPipelineResult) => pipelineResult.documents.map((document) => {
  if (document.status === 'FAILED' || document.status === 'UNSUPPORTED') {
    return `‘${document.fileName}’은 문서 종류를 확인하지 못했어.`
  }
  const label = documentLabelOf(document)
  if (document.documentType === 'UNKNOWN') {
    return `‘${document.fileName}’은 어떤 문서인지 확실히 구분하지 못했어. 문서 종류를 직접 확인해줘.`
  }
  if (document.classificationConfidence < 0.8 || document.status === 'NEEDS_REVIEW') {
    return `‘${document.fileName}’의 본문을 확인한 결과 ${label} 문서로 보이지만, 분류가 맞는지 한 번 확인해줘.`
  }
  return `‘${document.fileName}’의 본문을 확인한 결과 ${label} 문서로 확인됐어.`
}).join('\n')

const formatExtractedValue = (key: string, value: string | number | null) => {
  if (value === null || value === '') return '확인 필요'
  if (typeof value === 'number' && /amount|balance|total/i.test(key)) return `${value.toLocaleString('ko-KR')}원`
  if (typeof value === 'number' && /count/i.test(key)) return `${value.toLocaleString('ko-KR')}건`
  return valueLabels[String(value)] ?? String(value)
}

const buildReviewItems = (fields: Array<{
  key: string
  label: string
  value?: string | number | null
  normalizedValue?: string | number | null
}>, financialOnly = false) => {
  const records = new Map<string, typeof fields>()
  const general = fields.filter((field) => {
    const prefix = field.key.match(/^(records\.\d+)\./)?.[1]
    if (!prefix) return true
    records.set(prefix, [...(records.get(prefix) ?? []), field])
    return false
  })
  const findGeneral = (key: string) => general.find((field) => field.key === key)
  const pairedSummary = (
    presentKey: string,
    countKey: string,
    label: string,
  ) => {
    const present = findGeneral(presentKey)
    const count = findGeneral(countKey)
    if (!present && !count) return null
    const presentValue = present?.normalizedValue ?? present?.value
    const countValue = count?.normalizedValue ?? count?.value
    const parts = [presentValue === '예' ? '있음' : presentValue === '아니요' ? '없음' : null]
    if (typeof countValue === 'number') parts.push(`${countValue.toLocaleString('ko-KR')}건`)
    return { fieldKey: countKey, label, value: countValue ?? presentValue ?? null, formattedValue: parts.filter(Boolean).join(' · ') || '확인 필요' }
  }
  const grouped = financialOnly ? [
    pairedSummary('hasUnclaimedDepositRecords', 'unclaimedDepositRecordCount', '미수령금 내역'),
    pairedSummary('hasDebtRecords', 'debtRecordCount', '채무정보 내역'),
  ].filter((item): item is NonNullable<typeof item> => item !== null) : []
  const pairedKeys = new Set(['hasUnclaimedDepositRecords', 'unclaimedDepositRecordCount', 'hasDebtRecords', 'debtRecordCount'])
  const generalItems = general
    .filter((field) => financialOnly
      ? financialSummaryKeys.has(field.key) && !pairedKeys.has(field.key)
      : !['inquiryStatus', 'hasRecords', 'organizationKey', 'organizationEvidence'].includes(field.key))
    .map((field) => ({
      fieldKey: field.key,
      label: field.label,
      value: field.normalizedValue ?? field.value ?? null,
      formattedValue: formatExtractedValue(field.key, field.normalizedValue ?? field.value ?? null),
    }))
  const recordItems = [...records.entries()].map(([prefix, record]) => {
    const find = (name: string) => {
      const field = record.find((item) => item.key === `${prefix}.${name}`)
      return field?.normalizedValue ?? field?.value ?? null
    }
    const institution = find('institutionName')
    const details = [find('recordType'), find('productName'), find('quantityOrBalance')]
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map(String)
    const amount = find('amount')
    if (typeof amount === 'number') details.push(`${amount.toLocaleString('ko-KR')}원`)
    const status = find('statusMessage')
    if (status && !details.includes(String(status))) details.push(String(status))
    return {
      fieldKey: `${prefix}.amount`,
      label: typeof institution === 'string' ? institution : '금융 내역',
      value: typeof amount === 'number' ? amount : null,
      formattedValue: details.join(' · ') || '상세 내용 확인 필요',
    }
  })
  return [...grouped, ...generalItems, ...recordItems]
}

export type DocumentPipelineRunResult = {
  output: AgentOutput
  caseState: CaseState
  pipelineResult: DocumentPipelineResult
}

export async function runDocumentPipeline(
  input: DocumentPipelineInput,
  state: CaseState,
  adapter: DocumentPipelineAdapter,
): Promise<DocumentPipelineRunResult> {
  const pipelineResult = await adapter.parse(input)
  const blockingDocumentIds = new Set(pipelineResult.crossDocumentIssues.filter((issue) => issue.severity === 'BLOCKING').map((issue) => issue.documentId).filter(Boolean))
  const documents = [
    ...state.documents.filter((existing) => !pipelineResult.documents.some((processed) => processed.documentId === existing.id)),
    ...pipelineResult.documents.map((document) => ({
      id: document.documentId,
      type: document.documentType,
      fileName: document.fileName,
      status: document.status === 'FAILED' || document.status === 'UNSUPPORTED' ? 'FAILED' as const : 'NEEDS_CONFIRMATION' as const,
      extractedFields: document.extractedFields.map((field) => ({
        key: field.key,
        value: field.normalizedValue,
        sourcePage: field.source.page,
        verificationStatus: field.verificationStatus === 'AUTO_VERIFIED' && !criticalKeys.has(field.key) && !blockingDocumentIds.has(document.documentId) ? 'VERIFIED' as const : 'NEEDS_REVIEW' as const,
        verifiedByUser: false,
      })),
    })),
  ]
  const nextState = caseStateSchema.parse({
    ...state,
    stage: pipelineResult.crossDocumentIssues.some((issue) => issue.severity === 'BLOCKING') ? 'CONFIRMING_EXTRACTION' : 'CONFIRMING_EXTRACTION',
    documents,
    currentFocus: { type: 'DOCUMENT_BATCH', id: pipelineResult.batchId },
    lastUpdatedAt: new Date().toISOString(),
  })
  const ui = buildDocumentUI(pipelineResult)
  const output = agentOutputSchema.parse({
    message: `${describeClassifiedDocuments(pipelineResult)}\n\n${pipelineResult.explanation}`,
    ui,
    suggestedActions: pipelineResult.requiresUserConfirmation
      ? [{ id: 'review_fields', label: '확인할 항목 보기' }, { id: 'upload_again', label: '다시 올리기' }, { id: 'later', label: '나중에 확인' }]
      : [{ id: 'continue', label: '다음 단계' }],
    stateSummary: {
      stage: nextState.stage,
      progress: calculateProgress(nextState),
      todayTaskCount: nextState.tasks.filter((task) => task.status === 'IN_PROGRESS').length,
      verifiedDocumentCount: nextState.documents.filter((document) => document.status === 'VERIFIED').length,
      needsReviewCount: nextState.documents.filter((document) => document.status === 'NEEDS_CONFIRMATION').length + nextState.missingFields.filter((field) => !field.resolved).length,
    },
    meta: { intent: 'UPLOAD_DOCUMENT', emotionalSignal: 'NEUTRAL', usedTools: ['parseDocument'], requiresDisclaimer: false },
  })
  return { output, caseState: nextState, pipelineResult }
}

function buildDocumentUI(result: DocumentPipelineResult): AgentUIBlock[] {
  const ui: AgentUIBlock[] = [{
    type: 'DOCUMENT_BATCH_SUMMARY',
    batchId: result.batchId,
    files: result.documents.map((document) => ({ documentId: document.documentId, fileName: document.fileName, documentType: document.documentType, status: document.status, confidence: document.classificationConfidence })),
    issues: [...result.batchIssues, ...result.crossDocumentIssues],
  }]
  for (const document of result.documents) {
    if (document.classificationConfidence < 0.72 || document.documentType === 'UNKNOWN') {
      ui.push({
        type: 'DOCUMENT_CLASSIFICATION_CONFIRMATION',
        documentId: document.documentId,
        fileName: document.fileName,
        suggestedType: document.documentType,
        confidence: document.classificationConfidence,
        alternatives: document.alternativeTypes,
        actions: [{ id: 'confirm_type', label: '맞아요' }, { id: 'select_type', label: '종류 선택' }, { id: 'later', label: '나중에 확인' }],
      })
    }
    const isFinancialDocument = ['FINANCIAL_DOCUMENT', 'FINANCIAL_ASSET_DOCUMENT', 'FINANCIAL_DEBT_DOCUMENT', 'CARD_DEBT_DOCUMENT'].includes(document.documentType)
    const reviewFields = document.extractedFields.filter((item) => {
      if (isFinancialDocument) {
        return item.key.startsWith('records.') || financialSummaryKeys.has(item.key) || criticalKeys.has(item.key)
      }
      return criticalKeys.has(item.key) || item.verificationStatus === 'NEEDS_USER_REVIEW'
    })
    if (reviewFields.length) ui.push({
      type: 'DOCUMENT_EXTRACTION_REVIEW',
      documentId: document.documentId,
      fileName: document.fileName,
      documentTypeLabel: documentLabelOf(document),
      confidence: document.classificationConfidence,
      items: buildReviewItems(reviewFields, isFinancialDocument),
      notice: 'AI가 문서에서 읽은 값이야. 원본과 비교한 뒤 정확할 때만 확인해줘.',
      actions: [{ id: 'confirm_all', label: '모두 정확해요' }, { id: 'review_each', label: '하나씩 수정할게요' }],
    })
  }
  if (result.crossDocumentIssues.some((issue) => issue.severity === 'BLOCKING')) {
    ui.push({ type: 'DOCUMENT_CONFLICT', title: '서류 사이에 먼저 확인할 차이가 있어요', issues: result.crossDocumentIssues.filter((issue) => issue.severity === 'BLOCKING'), actions: [{ id: 'resolve_conflict', label: '하나씩 확인' }, { id: 'later', label: '나중에 확인' }] })
  }
  return ui
}

export function confirmDocumentField(
  state: CaseState,
  documentId: string,
  fieldKey: string,
  value: string | number,
): CaseState {
  const document = state.documents.find((item) => item.id === documentId)
  if (!document) return state
  const extractedFields = document.extractedFields.map((field) => field.key === fieldKey ? { ...field, value, verificationStatus: 'VERIFIED' as const, verifiedByUser: true } : field)
  let financials = state.financials
  const isFinancialAmount = typeof value === 'number'
    && /(^|\.)(amount|balance)$|Amount$|Balance$/i.test(fieldKey)
    && ['FINANCIAL_DOCUMENT', 'FINANCIAL_ASSET_DOCUMENT', 'FINANCIAL_DEBT_DOCUMENT', 'CARD_DEBT_DOCUMENT'].includes(document.type)
  if (isFinancialAmount) {
    const recordPrefix = fieldKey.match(/^(records\.\d+)\./)?.[1]
    const recordType = recordPrefix
      ? document.extractedFields.find((field) => field.key === `${recordPrefix}.recordType`)?.value
      : null
    const institution = recordPrefix
      ? document.extractedFields.find((field) => field.key === `${recordPrefix}.institutionName`)?.value
      : null
    const debtSignal = `${fieldKey} ${recordType ?? ''}`.match(/loan|debt|대출|채무|보증/i)
    const category = document.type === 'FINANCIAL_ASSET_DOCUMENT' || (!debtSignal && document.type === 'FINANCIAL_DOCUMENT') ? 'ASSET' as const : 'DEBT' as const
    const item = {
      id: `${documentId}-${fieldKey}`,
      category,
      type: document.type === 'CARD_DEBT_DOCUMENT' ? 'CARD_DEBT' as const : category === 'ASSET' ? 'DEPOSIT' as const : 'LOAN' as const,
      institution: typeof institution === 'string' ? institution : null,
      amount: value,
      amountStatus: 'VERIFIED' as const,
      source: 'DOCUMENT' as const,
      sourceDocumentId: documentId,
    }
    const assets = category === 'ASSET' ? [...financials.assets.filter((existing) => existing.id !== item.id), item] : financials.assets
    const debts = category === 'DEBT' ? [...financials.debts.filter((existing) => existing.id !== item.id), item] : financials.debts
    const totalAssets = assets.filter((entry) => entry.amountStatus === 'VERIFIED').reduce((sum, entry) => sum + (entry.amount ?? 0), 0)
    const totalDebts = debts.filter((entry) => entry.amountStatus === 'VERIFIED').reduce((sum, entry) => sum + (entry.amount ?? 0), 0)
    financials = { assets, debts, totalAssets, totalDebts, difference: totalAssets - totalDebts, hasUnverifiedItems: [...assets, ...debts].some((entry) => entry.amountStatus !== 'VERIFIED' || entry.amount === null) }
  }
  const documents = state.documents.map((item) => item.id === documentId ? {
    ...item,
    extractedFields,
    status: extractedFields.every((field) => field.verificationStatus === 'VERIFIED') ? 'VERIFIED' as const : 'NEEDS_CONFIRMATION' as const,
  } : item)
  return caseStateSchema.parse({ ...state, documents, financials, lastUpdatedAt: new Date().toISOString() })
}

export function confirmAllDocumentFields(state: CaseState, documentId: string): CaseState {
  const document = state.documents.find((item) => item.id === documentId)
  if (!document) return state
  return document.extractedFields.reduce(
    (nextState, field) => field.value === null
      ? nextState
      : confirmDocumentField(nextState, documentId, field.key, field.value),
    state,
  )
}
