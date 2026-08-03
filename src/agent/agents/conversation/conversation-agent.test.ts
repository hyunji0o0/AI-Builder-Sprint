import { describe, expect, it, vi } from 'vitest'
import { createInitialCaseState } from '../../state/initial-case'
import { AgentTipCard, TipProvider } from '../../shared/tip-provider'
import { runAgent } from '../../orchestrator/run-agent'

const tipCard = (id: string): AgentTipCard => ({
  id,
  excerpt: '가정법원에 3개월 안에 신청했고 우편으로도 접수됐어요.',
  reason: '기한을 놓치면 신청 자체가 어려워지는 상황이라 참고할 만해',
  createdAt: '2일 전',
  helpfulCount: 12,
  url: `/community/${id}`,
  label: '사용자 경험',
})

const stubTips = (cards: AgentTipCard[] = [tipCard('post-1')]): TipProvider => ({
  search: vi.fn(async () => cards),
})

describe('대화 Agent', () => {
  it('정의를 묻는 도메인 질문은 대화 Agent가 팁 카드와 함께 답한다', async () => {
    const tips = stubTips()
    const result = await runAgent(
      { input: '상속포기가 뭐야?', caseState: createInitialCaseState() },
      { tips },
    )

    expect(result.output.meta.intent).toBe('ASK_COMMUNITY_TIP')
    expect(result.output.ui[0]?.type).toBe('COMMUNITY_REVIEW')
    expect(result.output.meta.usedTools).toEqual(['searchCommunityTips'])
    expect(result.output.meta.requiresDisclaimer).toBe(true)
    expect(tips.search).toHaveBeenCalledOnce()
  })

  it('고위험 판단 질문은 대화 Agent가 일반 기준을 설명하고 전환 동의를 묻는다', async () => {
    const tips = stubTips()
    const result = await runAgent(
      { input: '상속포기해야 해?', caseState: createInitialCaseState() },
      { tips },
    )

    expect(result.output.meta.intent).toBe('CASUAL_CHAT')
    expect(result.output.message).toContain('상속포기 과정을 같이 도와줄 수 있어')
    expect(result.output.message).toContain('그렇게 해줄까?')
    expect(result.output.meta.requiresDisclaimer).toBe(true)
    expect(result.caseState.memory.pendingInteraction?.type).toBe('CASE_WORKFLOW_HANDOFF')
    expect(tips.search).not.toHaveBeenCalled()
  })

  it('고위험 판단 설명 뒤 사용자가 동의하면 사건업무 Agent로 전환한다', async () => {
    const offered = await runAgent({ input: '상속포기해도 됨?', caseState: createInitialCaseState() })
    const accepted = await runAgent({ input: '응, 그렇게 해줘', caseState: offered.caseState })

    expect(accepted.output.meta.intent).toBe('START_ONBOARDING')
    expect(accepted.output.ui[0]?.type).toBe('CHOICE')
    expect(accepted.caseState.memory.pendingInteraction?.type).not.toBe('CASE_WORKFLOW_HANDOFF')
  })

  it('인사에는 커뮤니티를 조회하지 않는다', async () => {
    const tips = stubTips()
    const result = await runAgent({ input: '안녕', caseState: createInitialCaseState() }, { tips })

    expect(result.output.meta.intent).toBe('CASUAL_CHAT')
    expect(result.output.ui).toEqual([])
    expect(tips.search).not.toHaveBeenCalled()
  })

  it('대화로 확정된 응답은 경량 모델을 사용한다', async () => {
    const llm = { complete: vi.fn(async () => '{"route":"CASE_WORKFLOW","confidence":1}') }
    const conversationLlm = { complete: vi.fn(async () => '반가워. 오늘은 어떤 이야기를 하고 싶어?') }
    const result = await runAgent(
      { input: '안녕', caseState: createInitialCaseState() },
      { llm, conversationLlm },
    )

    expect(result.output.message).toBe('반가워. 오늘은 어떤 이야기를 하고 싶어?')
    expect(conversationLlm.complete).toHaveBeenCalledOnce()
    expect(llm.complete).not.toHaveBeenCalled()
  })

  it('상속 맥락의 감정 표현에는 사건 업무 전환 동의를 먼저 묻는다', async () => {
    const result = await runAgent({ input: '상속 때문에 너무 슬퍼', caseState: createInitialCaseState() })

    expect(result.output.meta.intent).toBe('CASUAL_CHAT')
    expect(result.output.message).toContain('그렇게 해줄까?')
    expect(result.caseState.memory.pendingInteraction?.type).toBe('CASE_WORKFLOW_HANDOFF')
  })

  it('사건 업무 전환에 동의하면 업무 Agent의 온보딩을 시작한다', async () => {
    const offered = await runAgent({ input: '상속 때문에 너무 슬퍼', caseState: createInitialCaseState() })
    const accepted = await runAgent({ input: '응, 그렇게 해줘', caseState: offered.caseState })

    expect(accepted.output.meta.intent).toBe('START_ONBOARDING')
    expect(accepted.output.ui[0]?.type).toBe('CHOICE')
    expect(accepted.caseState.memory.pendingInteraction?.type).not.toBe('CASE_WORKFLOW_HANDOFF')
  })

  it('사건 업무 전환을 거절하면 대화 Agent에 남고 제안을 해제한다', async () => {
    const offered = await runAgent({ input: '상속 때문에 너무 슬퍼', caseState: createInitialCaseState() })
    const declined = await runAgent({ input: '아니, 지금은 이야기하고 싶어', caseState: offered.caseState })

    expect(declined.output.meta.intent).toBe('CASUAL_CHAT')
    expect(declined.output.message).toContain('이야기를 더 해도 돼')
    expect(declined.caseState.memory.pendingInteraction).toBeNull()
  })

  it('커뮤니티 조회가 실패해도 대화는 이어진다', async () => {
    const tips: TipProvider = { search: vi.fn(async () => { throw new Error('SUPABASE_DOWN') }) }
    const result = await runAgent(
      { input: '한정승인이랑 차이가 뭐야?', caseState: createInitialCaseState() },
      { tips },
    )

    expect(result.output.message.length).toBeGreaterThan(0)
    expect(result.output.ui).toEqual([])
    expect(result.output.meta.intent).toBe('CASUAL_CHAT')
  })

  it('팁을 함께 안내한 사실이 memory에 남는다', async () => {
    const result = await runAgent(
      { input: '상속포기가 뭐야?', caseState: createInitialCaseState() },
      { tips: stubTips() },
    )

    expect(result.caseState.memory.lastIntent).toBe('ASK_COMMUNITY_TIP')
    expect(result.caseState.memory.recentEvents[result.caseState.memory.recentEvents.length - 1]?.description).toContain('커뮤니티')
  })

  it('위기 신호가 있으면 팁을 붙이지 않고 안전 안내를 먼저 한다', async () => {
    const tips = stubTips()
    const result = await runAgent(
      { input: '상속 절차가 뭐야? 그냥 다 끝내고 싶어 죽고싶어', caseState: createInitialCaseState() },
      { tips },
    )

    expect(result.output.ui).toEqual([])
    expect(result.output.message).toContain('안전')
    expect(tips.search).not.toHaveBeenCalled()
  })
})
