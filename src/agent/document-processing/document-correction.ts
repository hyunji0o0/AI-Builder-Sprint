import { CaseState, caseStateSchema } from '../schemas/case-state'
import { confirmDocumentField } from './run-document-pipeline'

const moneyUnits: Record<string, number> = {
  억원: 100_000_000, 억: 100_000_000,
  천만원: 10_000_000, 백만원: 1_000_000, 십만원: 100_000,
  만원: 10_000, 만: 10_000, 천원: 1_000, 원: 1,
}

const amountPattern = /(\d+(?:\.\d+)?)\s*(억원|천만원|백만원|십만원|만원|천원|억|만|원)/
const amountKeyPattern = /(^|\.)(amount|balance)$|Amount$|Balance$/i

export const beginDocumentCorrection = (state: CaseState, documentId: string): CaseState =>
  caseStateSchema.parse({
    ...state,
    currentFocus: { type: 'DOCUMENT_CORRECTION', id: documentId },
    lastUpdatedAt: new Date().toISOString(),
  })

export type DocumentCorrectionResult =
  | { status: 'UPDATED'; state: CaseState; documentId: string; fieldKey: string; label: string; previousValue: number; nextValue: number }
  | { status: 'NEEDS_DETAILS'; message: string }

export const applyDocumentCorrectionInput = (state: CaseState, input: string): DocumentCorrectionResult => {
  if (state.currentFocus.type !== 'DOCUMENT_CORRECTION' || !state.currentFocus.id) {
    return { status: 'NEEDS_DETAILS', message: '먼저 수정할 문서에서 ‘수정할 내용이 있어요’를 눌러줘.' }
  }
  const document = state.documents.find((item) => item.id === state.currentFocus.id)
  if (!document) return { status: 'NEEDS_DETAILS', message: '수정할 문서를 찾지 못했어. 문서를 다시 선택해줘.' }

  const amountMatch = input.replace(/,/g, '').match(amountPattern)
  if (!amountMatch || amountMatch.index === undefined) {
    return { status: 'NEEDS_DETAILS', message: '수정할 항목과 금액을 함께 알려줘. 예: “예수금은 300만원이야”' }
  }
  const nextValue = Number(amountMatch[1]) * moneyUnits[amountMatch[2]]
  const subject = input.slice(0, amountMatch.index)
    .replace(/\s*(금액|값)?\s*(은|는|이|가|을|를)?\s*$/g, '')
    .trim()
  const tokens = subject.split(/\s+/).filter((token) => token.length > 1)

  const groups = new Map<string, typeof document.extractedFields>()
  document.extractedFields.forEach((field) => {
    const prefix = field.key.match(/^(records\.\d+)\./)?.[1]
    if (prefix) groups.set(prefix, [...(groups.get(prefix) ?? []), field])
  })
  const candidates = [...groups.entries()].map(([prefix, fields]) => {
    const searchable = fields.map((field) => String(field.value ?? '')).join(' ')
    return { prefix, fields, searchable, score: tokens.reduce((score, token) => score + (searchable.includes(token) ? 1 : 0), 0) }
  })
  const bestScore = Math.max(0, ...candidates.map((candidate) => candidate.score))
  const matches = bestScore > 0
    ? candidates.filter((candidate) => candidate.score === bestScore)
    : candidates.length === 1 && !subject ? candidates : []
  if (matches.length !== 1) {
    const names = candidates.map((candidate) => candidate.searchable.split(' ').filter(Boolean).slice(0, 2).join(' · ')).filter(Boolean)
    return {
      status: 'NEEDS_DETAILS',
      message: `어느 항목인지 한 번만 더 알려줘.${names.length ? ` 현재 문서에는 ${names.join(', ')} 항목이 있어.` : ''} 예: “한국투자증권 예수금은 300만원이야”`,
    }
  }

  const target = matches[0]
  const amountField = target.fields.find((field) => field.key === `${target.prefix}.amount`)
    ?? target.fields.find((field) => amountKeyPattern.test(field.key))
  if (!amountField || typeof amountField.value !== 'number') {
    return { status: 'NEEDS_DETAILS', message: '이 항목의 기존 금액 위치를 찾지 못했어. 기관명과 상품명을 함께 알려줘.' }
  }
  const institution = target.fields.find((field) => field.key.endsWith('.institutionName'))?.value
  const recordType = target.fields.find((field) => field.key.endsWith('.recordType'))?.value
  const productName = target.fields.find((field) => field.key.endsWith('.productName'))?.value
  const label = [institution, recordType, productName].filter(Boolean).map(String).filter((value, index, values) => values.indexOf(value) === index).join(' · ') || subject
  const updated = confirmDocumentField(state, document.id, amountField.key, nextValue)
  return {
    status: 'UPDATED',
    state: caseStateSchema.parse({ ...updated, currentFocus: { type: 'DOCUMENT_CORRECTION_REVIEW', id: document.id } }),
    documentId: document.id,
    fieldKey: amountField.key,
    label,
    previousValue: amountField.value,
    nextValue,
  }
}
