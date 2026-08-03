import { describe, expect, it } from 'vitest'
import { routeAgent } from './agent-router'
import { routingEvalCases } from './router-eval-cases'

describe('두 Agent 라우팅 정량 평가', () => {
  it('경계 문장 100개에서 전체 및 Agent별 정확도 95% 이상을 만족한다', async () => {
    const evaluated = await Promise.all(routingEvalCases.map(async (testCase) => ({
      ...testCase,
      actual: await routeAgent(testCase.input, undefined, testCase.recentMessages),
    })))
    const conversationCases = evaluated.filter((testCase) => testCase.expected === 'CONVERSATION')
    const workflowCases = evaluated.filter((testCase) => testCase.expected === 'CASE_WORKFLOW')
    const failures = evaluated.filter((testCase) => testCase.actual !== testCase.expected)
    const accuracy = (evaluated.length - failures.length) / evaluated.length
    const conversationRecall = conversationCases.filter((testCase) => testCase.actual === 'CONVERSATION').length / conversationCases.length
    const workflowRecall = workflowCases.filter((testCase) => testCase.actual === 'CASE_WORKFLOW').length / workflowCases.length

    console.info(JSON.stringify({
      totalCases: evaluated.length,
      accuracy,
      conversationRecall,
      workflowRecall,
      failures: failures.map((testCase) => ({
        id: testCase.id,
        group: testCase.group,
        expected: testCase.expected,
        actual: testCase.actual,
        input: testCase.input,
      })),
    }, null, 2))

    expect(conversationCases).toHaveLength(60)
    expect(workflowCases).toHaveLength(40)
    expect(accuracy).toBeGreaterThanOrEqual(0.95)
    expect(conversationRecall).toBeGreaterThanOrEqual(0.95)
    expect(workflowRecall).toBeGreaterThanOrEqual(0.95)
  })
})
