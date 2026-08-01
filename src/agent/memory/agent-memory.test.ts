import { describe, expect, it } from 'vitest'
import { createInitialCaseState } from '../state/initial-case'
import { recordAgentMemoryEvent, refreshAgentMemory } from './agent-memory'

describe('Agent memory', () => {
  it('확인된 사건 사실과 현재 입력 대상을 구조화해 기억한다', () => {
    const state = createInitialCaseState()
    state.onboarding.deathReportStatus = 'COMPLETED'
    state.financials.totalAssets = 3_000_000
    state.currentFocus = { type: 'DOCUMENT_CORRECTION', id: 'document-1' }
    const remembered = refreshAgentMemory(state, [
      { role: 'agent', text: '수정할 값을 알려줘.' },
      { role: 'user', text: '예수금 300만원이야.' },
    ])
    expect(remembered.memory.confirmedFacts).toContainEqual(expect.objectContaining({ key: 'deathReportStatus', value: 'COMPLETED' }))
    expect(remembered.memory.confirmedFacts).toContainEqual(expect.objectContaining({ key: 'totalAssets', value: '3000000' }))
    expect(remembered.memory.pendingInteraction).toEqual(expect.objectContaining({ type: 'DOCUMENT_CORRECTION', targetId: 'document-1' }))
    expect(remembered.memory.conversationSummary).toContain('예수금 300만원')
  })

  it('최근 처리 의도와 사건 이벤트를 누적한다', () => {
    const state = recordAgentMemoryEvent(createInitialCaseState(), 'TASK_COMPLETED', '사망신고 완료를 반영함', 'UPDATE_TASK_STATUS')
    expect(state.memory.lastIntent).toBe('UPDATE_TASK_STATUS')
    expect(state.memory.recentEvents[0].description).toContain('사망신고 완료')
  })
})
