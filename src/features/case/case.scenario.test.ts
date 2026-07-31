import { describe, expect, it } from 'vitest'
import { resolveCaseScenario } from './case.scenario'

describe('Case browser scenario', () => {
  it('이전 agent-demo 쿼리로도 임의 사건 데이터를 주입하지 않는다', () => {
    const scenario = resolveCaseScenario('?scenario=agent-demo')

    expect(scenario.isDemo).toBe(false)
    expect(scenario.caseState.documents).toEqual([])
    expect(scenario.caseState.financials.totalAssets).toBeNull()
    expect(scenario.caseState.financials.totalDebts).toBeNull()
    expect(scenario.caseState.user.region.district).toBeNull()
    expect(scenario.messages[0].ui).toBeUndefined()
  })

  it('일반 주소에서는 기존 사건 상태를 유지한다', () => {
    const scenario = resolveCaseScenario('')

    expect(scenario.isDemo).toBe(false)
    expect(scenario.id).toBe('default')
  })
})
