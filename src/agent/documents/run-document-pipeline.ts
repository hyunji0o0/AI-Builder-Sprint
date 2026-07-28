import { agentOutputSchema, AgentOutput, AgentUIBlock } from '../schemas/agent-output'
import { CaseState, caseStateSchema } from '../schemas/case-state'
import { DocumentPipelineInput, DocumentPipelineResult } from '../schemas/document-pipeline'
import { calculateProgress } from '../harness/tool-executor'
import { DocumentPipelineAdapter } from './document-pipeline'

const criticalKeys = new Set(['deceasedName', 'deathDate', 'inheritanceAwarenessDate', 'institution', 'category', 'amount', 'referenceDate'])

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
    message: pipelineResult.explanation,
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
    for (const field of document.extractedFields.filter((item) => criticalKeys.has(item.key) || item.verificationStatus === 'NEEDS_USER_REVIEW')) {
      ui.push({
        type: 'FIELD_VERIFICATION',
        documentId: document.documentId,
        fieldKey: field.key,
        label: field.label,
        value: field.normalizedValue,
        formattedValue: typeof field.normalizedValue === 'number' ? `${field.normalizedValue.toLocaleString('ko-KR')}원` : String(field.normalizedValue ?? '확인 필요'),
        sourcePage: field.source.page,
        sourceText: field.source.textSnippet,
        status: 'NEEDS_USER_REVIEW',
        actions: [{ id: 'confirm', label: '맞아요' }, { id: 'edit', label: '수정할게요' }, { id: 'view_source', label: '원문에서 확인' }],
      })
    }
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
  if (fieldKey === 'amount' && typeof value === 'number' && ['FINANCIAL_ASSET_DOCUMENT', 'FINANCIAL_DEBT_DOCUMENT', 'CARD_DEBT_DOCUMENT'].includes(document.type)) {
    const category = document.type === 'FINANCIAL_ASSET_DOCUMENT' ? 'ASSET' as const : 'DEBT' as const
    const item = { id: `${documentId}-amount`, category, type: document.type === 'CARD_DEBT_DOCUMENT' ? 'CARD_DEBT' as const : category === 'ASSET' ? 'DEPOSIT' as const : 'LOAN' as const, institution: null, amount: value, amountStatus: 'VERIFIED' as const, source: 'DOCUMENT' as const, sourceDocumentId: documentId }
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
