import { describe, expect, it } from 'vitest'
import { createInitialCaseState } from '../state/initial-case'
import { DocumentPipelineAdapter, MockDocumentPipelineAdapter } from './document-pipeline'
import { PythonDocumentPipelineAdapter } from './python-document-pipeline-adapter'
import { createDocumentPipeline } from './document-pipeline-factory'
import { confirmDocumentField, runDocumentPipeline } from './run-document-pipeline'
import { documentPipelineResultSchema } from '../schemas/document-pipeline'
import { analyzeFinancialDocumentCoverage } from './financial-field-policy'

const base64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes))
const png = base64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const jpg = base64([0xff, 0xd8, 0xff, 1, 2, 3])
const webp = base64([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50])
const pdf = btoa('%PDF-1.7\nvirtual demo')

const file = (fileId: string, fileName: string, declaredMimeType = 'image/png', bytesBase64 = png) => ({
  fileId, fileName, declaredMimeType, bytesBase64,
})
const input = (...files: ReturnType<typeof file>[]) => ({ batchId: 'batch-test', files })

describe('Document Pipeline', () => {
  it('이미지·PDF·캡처를 한 배치에서 처리한다', async () => {
    const result = await new MockDocumentPipelineAdapter().parse(input(
      file('a', 'death-certificate-demo.jpg', 'image/jpeg', jpg),
      file('b', 'deposit-balance-demo.pdf', 'application/pdf', pdf),
      file('c', 'loan-balance-screenshot.webp', 'image/webp', webp),
    ))
    expect(result.documents.map((document) => document.inputForm)).toEqual(['PHOTO', 'PDF', 'SCREENSHOT'])
  })

  it('문서 순서가 달라도 파일별 분류 결과가 같다', async () => {
    const adapter = new MockDocumentPipelineAdapter()
    const files = [file('a', 'death-certificate-demo.png'), file('b', 'loan-balance-demo.png')]
    const first = await adapter.parse(input(...files))
    const second = await adapter.parse(input(...[...files].reverse()))
    const map = (result: typeof first) => Object.fromEntries(result.documents.map((document) => [document.fileName, document.documentType]))
    expect(map(first)).toEqual(map(second))
  })

  it('UNKNOWN 문서가 전체 배치를 실패시키지 않는다', async () => {
    const result = await new MockDocumentPipelineAdapter().parse(input(
      file('unknown', 'unknown-demo.png'),
      file('known', 'death-certificate-demo.png'),
    ))
    expect(result.documents).toHaveLength(2)
    expect(result.documents.find((document) => document.documentId === 'unknown')?.documentType).toBe('UNKNOWN')
  })

  it('낮은 confidence도 내부 분류값으로만 유지하고 분류 확인 UI는 노출하지 않는다', async () => {
    const result = await runDocumentPipeline(input(file('blur', 'death-certificate-blurred-demo.png')), createInitialCaseState(), new MockDocumentPipelineAdapter())
    expect(result.pipelineResult.documents[0]?.classificationConfidence).toBeLessThan(0.72)
    expect(result.output.ui.some((block) => block.type === 'DOCUMENT_CLASSIFICATION_CONFIRMATION')).toBe(false)
  })

  it('사망일 충돌을 BLOCKING issue로 만든다', async () => {
    const result = await new MockDocumentPipelineAdapter().parse(input(
      file('a', 'death-certificate-a-demo.png'),
      file('b', 'death-certificate-b-demo.png'),
    ))
    expect(result.crossDocumentIssues).toContainEqual(expect.objectContaining({ code: 'DEATH_DATE_CONFLICT', severity: 'BLOCKING' }))
  })

  it('중복 금융 항목을 탐지해 이중 합산 전 차단한다', async () => {
    const result = await new MockDocumentPipelineAdapter().parse(input(
      file('a', 'loan-balance-demo.png'),
      file('b', 'loan-balance-copy-demo.png'),
    ))
    expect(result.crossDocumentIssues.some((issue) => issue.code === 'POSSIBLE_DUPLICATE_FINANCIAL_ITEM')).toBe(true)
  })

  it('사용자 확인 전 금액을 확정 금융 합계에 넣지 않는다', async () => {
    const state = createInitialCaseState()
    const result = await runDocumentPipeline(input(file('asset-doc', 'deposit-balance-demo.png')), state, new MockDocumentPipelineAdapter())
    expect(result.caseState.financials.assets.some((item) => item.sourceDocumentId === 'asset-doc')).toBe(false)
    expect(result.caseState.documents.find((document) => document.id === 'asset-doc')?.status).toBe('NEEDS_CONFIRMATION')
  })

  it('사용자 확인 후 CaseState 금융 합계와 문서 상태를 갱신한다', async () => {
    const processed = await runDocumentPipeline(input(file('asset-doc', 'deposit-balance-demo.png')), createInitialCaseState(), new MockDocumentPipelineAdapter())
    const confirmed = confirmDocumentField(processed.caseState, 'asset-doc', 'amount', 17_000_000)
    expect(confirmed.financials.assets.some((item) => item.sourceDocumentId === 'asset-doc' && item.amountStatus === 'VERIFIED')).toBe(true)
    expect(confirmed.financials.totalAssets).toBe(17_000_000)
  })

  it('Mock과 Python adapter가 같은 interface를 구현한다', () => {
    const adapters: DocumentPipelineAdapter[] = [
      new MockDocumentPipelineAdapter(),
      new PythonDocumentPipelineAdapter({ apiKey: 'test-key' }),
    ]
    expect(adapters.every((adapter) => typeof adapter.parse === 'function')).toBe(true)
  })

  it('제품 파이프라인은 실제 Python 어댑터만 생성한다', () => {
    expect(createDocumentPipeline({ mode: 'python', environment: 'production', apiKey: 'test-key' }))
      .toBeInstanceOf(PythonDocumentPipelineAdapter)
  })

  it('임의 파일명이어도 본문에서 기관을 분류하고 금융 핵심 항목만 한국어로 보여준다', async () => {
    const field = (key: string, label: string, value: string | number) => ({
      key, label, value, normalizedValue: value,
      source: { page: 1, textSnippet: null, boundingBox: null },
      confidence: 0.94,
      verificationStatus: 'NEEDS_USER_REVIEW' as const,
    })
    const contentBasedAdapter: DocumentPipelineAdapter = {
      parse: async () => documentPipelineResultSchema.parse({
        batchId: 'content-classification',
        documents: [{
          documentId: 'generic-name', fileName: '112.png', mimeType: 'image/png', inputForm: 'PHOTO',
          documentType: 'FINANCIAL_DOCUMENT', classificationConfidence: 0.94, alternativeTypes: [], status: 'NEEDS_REVIEW',
          extractedFields: [
            field('organizationKey', '기관 식별값', 'deposit_insurance'),
            field('organizationName', '기관명', '예금보험공사'),
            field('hasUnclaimedDepositRecords', '미수령금 내역 존재 여부', '예'),
            field('unclaimedDepositRecordCount', '미수령금 내역 수', 1),
            field('hasDebtRecords', '채무정보 내역 존재 여부', '예'),
            field('debtRecordCount', '채무정보 내역 수', 3),
            field('organizationEvidence', '분류 근거', '본문 제목과 기관 안내 문구'),
          ],
          validationIssues: [],
        }],
        batchIssues: [], crossDocumentIssues: [], requiresUserConfirmation: true,
        explanation: '추출한 내용을 확인해줘.',
      }),
    }

    const result = await runDocumentPipeline(input(file('generic-name', '112.png')), createInitialCaseState(), contentBasedAdapter)
    const review = result.output.ui.find((block) => block.type === 'DOCUMENT_EXTRACTION_REVIEW')
    expect(result.output.message).toContain('본문을 확인한 결과 예금보험공사 금융거래 조회 결과')
    expect(review).toEqual(expect.objectContaining({ documentTypeLabel: '예금보험공사 금융거래 조회 결과' }))
    if (review?.type !== 'DOCUMENT_EXTRACTION_REVIEW') throw new Error('review block missing')
    expect(review.items.map((item) => item.label)).toEqual(['미수령금 내역', '채무정보 내역'])
    expect(review.items.map((item) => `${item.label} ${item.formattedValue}`).join(' '))
      .not.toMatch(/hasUnclaimed|debtRecordCount|organizationEvidence/)
    expect(result.caseState.documents[0].extractedFields.map((item) => item.key))
      .not.toContain('organizationEvidence')
    expect(result.caseState.financialCoverage.receivedOrganizationKeys).toEqual(['deposit_insurance'])
    expect(result.caseState.financialCoverage.status).toBe('PENDING')
  })

  it('업로드한 기관 결과와 아직 받지 않은 기관 결과를 사건 상태에서 구분한다', () => {
    const state = createInitialCaseState()
    const financialDocument = (id: string, key: string, name: string) => ({
      id, type: 'FINANCIAL_DOCUMENT' as const, fileName: `${id}.png`, status: 'VERIFIED' as const,
      extractedFields: [
        { key: 'organizationKey', value: key, sourcePage: 1, verificationStatus: 'VERIFIED' as const, verifiedByUser: true },
        { key: 'organizationName', value: name, sourcePage: 1, verificationStatus: 'VERIFIED' as const, verifiedByUser: true },
      ],
    })
    const coverage = analyzeFinancialDocumentCoverage([
      financialDocument('112', 'credit_union', '신협중앙회'),
      financialDocument('113', 'korea_post', '우정사업본부'),
    ])
    expect(coverage.received.map((item) => item.name)).toEqual(['우정사업본부', '신협중앙회'])
    expect(coverage.missing).toHaveLength(11)
    expect(coverage.missing.map((item) => item.name)).not.toContain('대부금융협회')
    expect(state.financialCoverage.status).toBe('NOT_CHECKED')
  })

  it('기관 키가 누락돼도 본문에서 추출한 기관명으로 확인 기관을 복원한다', () => {
    const coverage = analyzeFinancialDocumentCoverage([{
      id: 'generic-file', type: 'FINANCIAL_DOCUMENT', fileName: '112.png', status: 'NEEDS_CONFIRMATION',
      extractedFields: [
        { key: 'organizationName', value: '금융투자협회 조회 결과', sourcePage: 1, verificationStatus: 'NEEDS_REVIEW', verifiedByUser: false },
      ],
    }])

    expect(coverage.received.map((item) => item.key)).toEqual(['financial_investment'])
    expect(coverage.missing.map((item) => item.key)).not.toContain('financial_investment')
  })

  it('흐리거나 금액이 없는 문서에 재업로드·직접 확인 흐름을 제공한다', async () => {
    const result = await runDocumentPipeline(input(file('missing', 'loan-amount-missing-demo.png')), createInitialCaseState(), new MockDocumentPipelineAdapter())
    expect(result.output.suggestedActions.map((action) => action.id)).toContain('upload_again')
    expect(result.output.ui.some((block) => block.type === 'DOCUMENT_EXTRACTION_REVIEW')).toBe(true)
  })

  it('처리 실패 시 사용자를 탓하지 않는 따뜻한 안내를 반환한다', async () => {
    const result = await new MockDocumentPipelineAdapter().parse(input(file('bad', 'broken.exe', 'application/octet-stream', base64([1, 2, 3]))))
    expect(result.explanation).toContain('충분히 확인하지 못했어요')
    expect(result.explanation).not.toMatch(/잘못된 파일|사용자 오류|인식할 수 없습니다/)
  })
})
