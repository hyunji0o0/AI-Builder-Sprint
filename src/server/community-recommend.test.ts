import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommunityPost } from '../schemas/community'

const { embedQueryMock, generateSolarChatMock, keywordSearchMock, embeddingSearchMock } = vi.hoisted(() => ({
  embedQueryMock: vi.fn(),
  generateSolarChatMock: vi.fn(),
  keywordSearchMock: vi.fn(),
  embeddingSearchMock: vi.fn(),
}))

vi.mock('./upstage-client', () => ({
  embedQuery: embedQueryMock,
  generateSolarChat: generateSolarChatMock,
}))

vi.mock('./community-store', () => ({
  searchCommunityPosts: embeddingSearchMock,
  searchCommunityPostsByKeywords: keywordSearchMock,
}))

import { recommendCommunityTips } from './community-recommend'

const post = (id: string, content: string, helpfulCount: number): CommunityPost => ({
  id,
  nickname: '경험자',
  categories: ['RENOUNCE'],
  content,
  createdAt: '2026-08-01T00:00:00.000Z',
  helpfulCount,
})

const candidates = [
  post('renounce-1', '상속포기 전에 법원 기한과 재산 처분 여부를 확인했어요.', 10),
  post('renounce-2', '상속포기와 한정승인을 비교하려고 빚과 재산 목록을 만들었어요.', 8),
  post('renounce-3', '가정법원에 상속포기 서류를 접수하기 전에 준비물을 확인했어요.', 5),
]

describe('커뮤니티 팁 추천 통합', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    embedQueryMock.mockResolvedValue([0.1, 0.2])
    keywordSearchMock.mockResolvedValue(candidates)
    embeddingSearchMock.mockResolvedValue(candidates.map((item, index) => ({
      ...item,
      similarity: 0.55 - index * 0.04,
    })))
  })

  it('Solar가 한 장만 작성해도 관련 후보 세 장을 검색 순서대로 유지한다', async () => {
    generateSolarChatMock.mockResolvedValue(JSON.stringify({
      tips: [{
        sourceIndex: 1,
        title: '기한 먼저 확인',
        summary: '법원 기한을 먼저 확인해요.',
        reason: '상속포기 준비 단계와 관련된 경험이에요.',
        quote: '법원 기한과 재산 처분 여부를 확인했어요.',
      }],
    }))

    const result = await recommendCommunityTips({ situation: '상속포기 전에 뭘 확인해야 해?', limit: 3 })

    expect(result.candidateCount).toBe(3)
    expect(result.tips).toHaveLength(3)
    expect(result.tips.map((tip) => tip.id)).toEqual(['renounce-2', 'renounce-3', 'renounce-1'])
    expect(result.tips[0]?.title).toBe('기한 먼저 확인')
    expect(result.tips[1]?.summary).toContain('가정법원')
  })

  it('두 검색 경로에 관련 후보가 없으면 카드를 만들지 않는다', async () => {
    keywordSearchMock.mockResolvedValue([])
    embeddingSearchMock.mockResolvedValue([])

    const result = await recommendCommunityTips({ situation: '오늘 저녁 메뉴 추천', limit: 3 })

    expect(result.tips).toEqual([])
    expect(result.candidateCount).toBe(0)
    expect(generateSolarChatMock).not.toHaveBeenCalled()
  })
})
