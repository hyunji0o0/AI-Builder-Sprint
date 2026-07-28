import { describe, expect, it } from 'vitest'
import { createInitialCaseState } from '../state/initial-case'
import { MemoryStateRepository } from '../state/state-repository'
import { MockCaseTools } from '../tools/case-tools'
import { classifyDeterministically } from './intent-classifier'
import { runAgent } from './run-agent'
import { responseSimilarity } from './response-composer'

describe('Agent Harness', () => {
  it('굿굿은 CASUAL_CHAT이며 분석 카드를 반복하지 않는다', async () => {
    const result = await runAgent({ input: '굿굿', caseState: createInitialCaseState() })
    expect(result.output.meta.intent).toBe('CASUAL_CHAT')
    expect(result.output.ui).toHaveLength(0)
    expect(result.output.message).toContain('좋아요')
  })

  it('정신없는 기한 질문을 ASK_DEADLINE + DISTRESSED로 분류한다', () => {
    const result = classifyDeterministically('너무 정신없는데 기한이 언제야?')
    expect(result.intent).toBe('ASK_DEADLINE')
    expect(result.emotion.signal).toBe('DISTRESSED')
    expect(result.emotion.intensity).toBe('HIGH')
  })

  it('부채가 자산보다 많으면 URGENT_REVIEW를 만든다', async () => {
    const state = createInitialCaseState()
    state.financials.assets[0].amount = 17_000_000
    state.financials.debts[0].amount = 87_000_000
    const result = await runAgent({ input: '부채가 더 많으면 어떡해?', caseState: state })
    expect(result.caseState.stage).toBe('URGENT_REVIEW')
    expect(result.output.ui[0]).toMatchObject({ type: 'RISK_ALERT', level: 'URGENT_REVIEW' })
  })

  it('미확인 금융 항목이 있어도 확정적인 법률 결론을 만들지 않는다', async () => {
    const result = await runAgent({ input: '부채가 더 많으면 어떡해?', caseState: createInitialCaseState() })
    expect(result.caseState.financials.hasUnverifiedItems).toBe(true)
    expect(result.output.message).not.toMatch(/상속포기하세요|무조건 한정승인|단순승인으로 진행/)
    expect(result.output.meta.requiresDisclaimer).toBe(true)
  })

  it('상속포기 결정 요청을 ASK_LEGAL_DECISION으로 분류하고 경계를 안내한다', async () => {
    const result = await runAgent({ input: '상속포기해야 해?', caseState: createInitialCaseState() })
    expect(result.output.meta.intent).toBe('ASK_LEGAL_DECISION')
    expect(result.output.message).toContain('결정')
    expect(result.output.meta.requiresDisclaimer).toBe(true)
  })

  it('팁 요청에 COMMUNITY_REVIEW UI Block을 반환한다', async () => {
    const result = await runAgent({ input: '팁 추천해줘', caseState: createInitialCaseState() })
    expect(result.output.meta.intent).toBe('ASK_COMMUNITY_TIP')
    expect(result.output.ui[0]?.type).toBe('COMMUNITY_REVIEW')
  })

  it('나중에 할게는 상태를 보존하고 일시정지를 기록한다', async () => {
    const state = createInitialCaseState()
    const snapshot = JSON.stringify({ financials: state.financials, tasks: state.tasks })
    const result = await runAgent({ input: '나중에 할게', caseState: state })
    expect(result.output.meta.intent).toBe('REQUEST_PAUSE')
    expect(result.caseState.emotionalContext.userRequestedPause).toBe(true)
    expect(JSON.stringify({ financials: result.caseState.financials, tasks: result.caseState.tasks })).toBe(snapshot)
  })

  it('도구 실패 시 직접 입력 또는 나중에 진행 폴백을 반환한다', async () => {
    const state = createInitialCaseState()
    const tools = new MockCaseTools(new MemoryStateRepository(state))
    tools.getPrioritizedTasks = async () => { throw new Error('TEST_FAILURE') }
    const result = await runAgent({ input: '다음에 뭐 해야 해?', caseState: state }, { tools })
    expect(result.output.suggestedActions.map((action) => action.id)).toEqual(['manual_input', 'later'])
  })

  it('비슷한 위로 문장을 매 응답마다 반복하지 않는다', async () => {
    const first = await runAgent({ input: '너무 막막한데 기한이 언제야?', caseState: createInitialCaseState() })
    const second = await runAgent({ input: '아직 정신없어. 기한 알려줘', caseState: first.caseState })
    expect(first.output.message).toContain('오늘은 한 가지만')
    expect(second.output.message).not.toContain('오늘은 한 가지만')
  })

  it('채팅 상태 변경과 stateSummary가 함께 갱신된다', async () => {
    const before = createInitialCaseState()
    const result = await runAgent({ input: '다 했어', caseState: before })
    expect(result.caseState.tasks.some((task) => task.status === 'COMPLETED')).toBe(true)
    expect(result.output.stateSummary.progress).toBeGreaterThan(55)
    expect(result.output.stateSummary.todayTaskCount).toBe(0)
  })

  it('LLM이 영어를 반환해도 최종 사용자 응답은 한국어로 폴백한다', async () => {
    const llm = { complete: async () => 'I am sorry you are feeling this way. How can I help?' }
    const result = await runAgent({ input: '나 지금 너무 슬퍼', caseState: createInitialCaseState() }, { llm })
    expect(result.output.message).toMatch(/[가-힣]/)
    expect(result.output.message).not.toContain('I am sorry')
  })

  it('안녕에는 업무 분석 카드 없이 자연스러운 인사로 답한다', async () => {
    const result = await runAgent({ input: '안녕', caseState: createInitialCaseState() })
    expect(result.output.meta.intent).toBe('CASUAL_CHAT')
    expect(result.output.ui).toHaveLength(0)
    expect(result.output.message).toMatch(/안녕|반가워요/)
  })

  it('가지고 있는 서류를 다 올려도 되는지 묻는 표현을 업로드 요청으로 처리한다', async () => {
    const result = await runAgent({
      input: '내가 지금 가지고 있는 서류들이 있는데, 이걸 너한테 그냥 다 올리면 될까?',
      caseState: createInitialCaseState(),
    })
    expect(result.output.meta.intent).toBe('UPLOAD_DOCUMENT')
    expect(result.output.message).toContain('최대 10개')
    expect(result.output.ui[0]?.type).toBe('DOCUMENT_UPLOAD')
  })

  it('검증된 사실을 포함한 LLM의 자연스러운 표현을 최종 답변으로 사용한다', async () => {
    const llm = {
      complete: async (system: string) => {
        if (system.includes('출력 형식')) return '{"intent":"UPLOAD_DOCUMENT","emotion":{"signal":"NEUTRAL","intensity":"LOW"},"confidence":0.96}'
        if (system.includes('허용 action')) return '{"action":"UPLOAD","tools":[]}'
        return '물론이에요. 문서 종류는 미리 고르지 않으셔도 됩니다. 이미지와 PDF 파일을 한 번에 10개까지 올려주시면, 확인할 내용만 차례로 정리해드릴게요.'
      },
    }
    const result = await runAgent({
      input: '가지고 있는 서류를 전부 올려도 될까?',
      caseState: createInitialCaseState(),
    }, { llm })
    expect(result.output.message).toContain('물론이에요')
    expect(result.output.message).toContain('10개')
  })

  it('LLM 답변이 필수 사실을 빠뜨리면 안전한 한국어 폴백을 사용한다', async () => {
    const llm = {
      complete: async (system: string) => {
        if (system.includes('출력 형식')) return '{"intent":"UPLOAD_DOCUMENT","emotion":{"signal":"NEUTRAL","intensity":"LOW"},"confidence":0.96}'
        if (system.includes('허용 action')) return '{"action":"UPLOAD","tools":[]}'
        return '네, 편하게 올려주세요.'
      },
    }
    const result = await runAgent({
      input: '서류를 다 올려도 돼?',
      caseState: createInitialCaseState(),
    }, { llm })
    expect(result.output.message).toContain('최대 10개')
    expect(result.output.message).toContain('PDF')
  })

  it('최근 답변과 비슷한 LLM 문장을 거절하고 다른 표현으로 재작성한다', async () => {
    let composeCount = 0
    const repeated = '정신이 없으신 것 같아요. 잠시 숨을 고르고, 지금 가장 먼저 확인하고 싶은 서류 하나만 알려주시면 함께 정리해 볼게요.'
    const llm = {
      complete: async (system: string) => {
        if (system.includes('출력 형식')) return '{"intent":"UNSUPPORTED","emotion":{"signal":"DISTRESSED","intensity":"HIGH"},"confidence":0.91}'
        if (system.includes('허용 action')) return '{"action":"FALLBACK","tools":[]}'
        composeCount += 1
        return composeCount === 1
          ? repeated
          : '빚 이야기까지 겹치면서 더 막막해진 마음이 드실 수 있어요. 지금은 정리를 멈추고 잠시 쉬어도 되고, 원하실 때 확인된 내용 하나만 살펴봐도 괜찮습니다.'
      },
    }
    const result = await runAgent({
      input: '빚까지 있다고 하니까 너무 막막해. 나 진짜 너무 힘들어',
      caseState: createInitialCaseState(),
      recentMessages: [
        { role: 'user', text: '정신이 없어서 뭘 해야 할지 모르겠어' },
        { role: 'agent', text: repeated },
      ],
    }, { llm })
    expect(composeCount).toBe(2)
    expect(result.output.message).toContain('빚 이야기')
    expect(responseSimilarity(result.output.message, repeated)).toBeLessThan(0.62)
  })
})
