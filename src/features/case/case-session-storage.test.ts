import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialCaseState } from '../../agent/state/initial-case'
import { caseSessionStorageKey, clearCaseSession, restoreCaseSession } from './case-session-storage'

describe('case session reset', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('현재 시나리오의 사건 세션만 삭제한다', () => {
    const removeItem = vi.fn()
    vi.stubGlobal('window', { sessionStorage: { removeItem } })

    clearCaseSession('?scenario=agent-demo')

    expect(removeItem).toHaveBeenCalledOnce()
    expect(removeItem).toHaveBeenCalledWith(caseSessionStorageKey('?scenario=agent-demo'))
  })

  it('이전 금융조회 온보딩 단계는 원스톱 서비스 확인 단계로 옮긴다', () => {
    const caseState = createInitialCaseState()
    caseState.onboarding.currentStep = 'FINANCIAL_INQUIRY'
    const getItem = vi.fn(() => JSON.stringify({
      version: 1,
      caseState,
      messages: [{
        id: 1,
        role: 'agent',
        text: '금융조회는 진행했어?',
        block: 'choice',
        ui: [{
          type: 'CHOICE',
          prompt: '금융조회는 진행했어?',
          options: [{ id: 'onboarding_financial_completed', label: '조회했어' }],
        }],
      }],
    }))
    vi.stubGlobal('window', { sessionStorage: { getItem } })

    const restored = restoreCaseSession('', { caseState: createInitialCaseState(), messages: [] })

    expect(restored.caseState.onboarding.currentStep).toBe('ONE_STOP_SERVICE')
    expect(restored.messages[0]?.text).toContain('원스톱 서비스')
    expect(restored.messages[0]?.text).not.toContain('금융조회는 진행했어')
    const choice = restored.messages[0]?.ui?.[0]
    expect(choice?.type).toBe('CHOICE')
    expect(choice?.type === 'CHOICE' && choice.options.some((option) => option.id === 'onboarding_one_stop_completed')).toBe(true)
  })
})
