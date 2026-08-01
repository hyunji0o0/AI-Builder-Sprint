import { describe, expect, it } from 'vitest'
import { createInitialCaseState } from '../state/initial-case'
import { applyDocumentCorrectionInput, beginDocumentCorrection } from './document-correction'

const correctionState = () => {
  const initial = createInitialCaseState()
  return {
    ...initial,
    documents: [{
      id: 'document-1',
      type: 'FINANCIAL_DOCUMENT' as const,
      fileName: '1.png',
      status: 'NEEDS_CONFIRMATION' as const,
      extractedFields: [
        { key: 'records.0.institutionName', value: '한국투자증권', sourcePage: 1, verificationStatus: 'NEEDS_REVIEW' as const, verifiedByUser: false },
        { key: 'records.0.recordType', value: '예수금', sourcePage: 1, verificationStatus: 'NEEDS_REVIEW' as const, verifiedByUser: false },
        { key: 'records.0.amount', value: 2_830_000, sourcePage: 1, verificationStatus: 'NEEDS_REVIEW' as const, verifiedByUser: false },
        { key: 'records.1.institutionName', value: '삼성증권', sourcePage: 1, verificationStatus: 'NEEDS_REVIEW' as const, verifiedByUser: false },
        { key: 'records.1.recordType', value: 'CMA', sourcePage: 1, verificationStatus: 'NEEDS_REVIEW' as const, verifiedByUser: false },
        { key: 'records.1.amount', value: 980_000, sourcePage: 1, verificationStatus: 'NEEDS_REVIEW' as const, verifiedByUser: false },
      ],
    }],
  }
}

describe('문서 추출값 수정', () => {
  it('수정 모드에서 “예수금 300만원”을 기존 문서 항목에 반영한다', () => {
    const focused = beginDocumentCorrection(correctionState(), 'document-1')
    const result = applyDocumentCorrectionInput(focused, '예수금 300만원이야')
    expect(result.status).toBe('UPDATED')
    if (result.status !== 'UPDATED') return
    expect(result.previousValue).toBe(2_830_000)
    expect(result.nextValue).toBe(3_000_000)
    expect(result.state.documents[0].extractedFields.find((field) => field.key === 'records.0.amount')?.value).toBe(3_000_000)
    expect(result.state.financials.totalAssets).toBe(3_000_000)
    expect(result.state.currentFocus.type).toBe('DOCUMENT_CORRECTION_REVIEW')
  })

  it('대상이 불명확하면 임의 항목을 바꾸지 않고 구체적인 항목명을 요청한다', () => {
    const focused = beginDocumentCorrection(correctionState(), 'document-1')
    const result = applyDocumentCorrectionInput(focused, '금액은 300만원이야')
    expect(result.status).toBe('NEEDS_DETAILS')
    if (result.status !== 'NEEDS_DETAILS') return
    expect(result.message).toContain('어느 항목인지')
  })
})
