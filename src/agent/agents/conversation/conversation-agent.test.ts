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

  it('본인 사건에 대한 판단 요청은 대화 Agent로 새지 않는다', async () => {
    const tips = stubTips()
    const result = await runAgent(
      { input: '상속포기해야 해?', caseState: createInitialCaseState() },
      { tips },
    )

    expect(result.output.meta.intent).not.toBe('CASUAL_CHAT')
    expect(tips.search).not.toHaveBeenCalled()
  })

  it('인사에는 커뮤니티를 조회하지 않는다', async () => {
    const tips = stubTips()
    const result = await runAgent({ input: '안녕', caseState: createInitialCaseState() }, { tips })

    expect(result.output.meta.intent).toBe('CASUAL_CHAT')
    expect(result.output.ui).toEqual([])
    expect(tips.search).not.toHaveBeenCalled()
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
    expect(result.caseState.memory.recentEvents.at(-1)?.description).toContain('커뮤니티')
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
