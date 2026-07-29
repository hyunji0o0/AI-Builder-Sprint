import { describe, expect, it } from 'vitest'
import { runDocumentPipeline } from '../documents/run-document-pipeline'
import { runAgent } from '../harness/run-agent'
import { createInitialCaseState } from '../state/initial-case'
import {
  createRepresentativeAgentCaseState,
  createRepresentativeDocumentAnalysis,
} from './representative-document-analysis'
import { StaticDocumentAnalysisAdapter } from './static-document-analysis-adapter'

const mockInput = {
  batchId: 'representative-test',
  files: [
    {
      fileId: 'external-result-placeholder',
      fileName: '외부 분석 결과',
      declaredMimeType: 'application/json',
      bytesBase64: 'e30=',
    },
  ],
}

describe('대표 Agent 데이터 시나리오', () => {
  it('외부 OCR 결과를 문서 확인 UI로 변환한다', async () => {
    const result = await runDocumentPipeline(
      mockInput,
      createInitialCaseState(),
      new StaticDocumentAnalysisAdapter(createRepresentativeDocumentAnalysis()),
    )

    expect(result.caseState.stage).toBe('CONFIRMING_EXTRACTION')
    expect(result.output.ui.filter((block) => block.type === 'FIELD_VERIFICATION'))
      .toHaveLength(5)
    expect(result.output.message).toContain('원문')
  })

  it('확인된 대표 사건에는 미확인 금융기관과 인지일 누락이 남는다', () => {
    const state = createRepresentativeAgentCaseState()

    expect(state.financials.difference).toBe(-72_000_000)
    expect(state.financials.hasUnverifiedItems).toBe(true)
    expect(state.missingFields.filter((field) => !field.resolved).map((field) => field.id))
      .toEqual(['missing-awareness-date', 'pending-financial-result'])
  })

  it('대표 사건의 금융 위험 질문에 확정적 법률 결론 없이 긴급 검토를 반환한다', async () => {
    const result = await runAgent({
      input: '현재 자료에서 먼저 확인해야 할 금융 위험이 있어?',
      caseState: createRepresentativeAgentCaseState(),
      uiActionIntent: 'ASK_FINANCIAL_RISK',
    })

    expect(result.caseState.stage).toBe('URGENT_REVIEW')
    expect(result.output.ui[0]).toMatchObject({
      type: 'RISK_ALERT',
      level: 'URGENT_REVIEW',
    })
    expect(result.output.message).toContain('72,000,000원')
    expect(result.output.message).not.toMatch(/상속포기하세요|무조건 한정승인|단순승인으로 진행/)
  })
})
