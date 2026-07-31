import { describe, expect, it } from 'vitest'
import { resolveCaseScenario } from './case.scenario'

describe('Case browser scenario', () => {
  it('agent-demo 쿼리에서 대표 Agent 사건을 불러온다', () => {
    const scenario = resolveCaseScenario('?scenario=agent-demo')

    expect(scenario.isDemo).toBe(true)
    expect(scenario.caseState.financials.totalAssets).toBe(12_000_000)
    expect(scenario.caseState.financials.totalDebts).toBe(84_000_000)
    expect(scenario.caseState.user.region.district).toBe('금정구')
    expect(scenario.messages[0].text).toContain('무엇부터 해야 할지')
    expect(scenario.messages[0].ui?.[0]?.type).toBe('CHOICE')
  })

  it('일반 주소에서는 기존 사건 상태를 유지한다', () => {
    const scenario = resolveCaseScenario('')

    expect(scenario.isDemo).toBe(false)
    expect(scenario.id).toBe('default')
  })
})
