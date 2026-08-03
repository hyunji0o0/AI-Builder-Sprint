import { describe, expect, it } from 'vitest'
import { communitySearchEvalCases, communitySearchEvalPosts } from './community-search-eval-cases'
import { rankCommunityPosts } from './community-search-ranking'

describe('커뮤니티 팁 하이브리드 검색 정량 평가', () => {
  it('질문별 Top 3 관련 카드 적중률 90% 이상, 무관 카드 비율 5% 이하를 만족한다', () => {
    let relevantTargetCount = 0
    let relevantHitCount = 0
    let returnedCount = 0
    let irrelevantCount = 0
    const results = communitySearchEvalCases.map((testCase) => {
      const embeddingMatches = Object.entries(testCase.embeddingScores).map(([id, similarity]) => ({
        ...communitySearchEvalPosts.find((post) => post.id === id)!,
        similarity,
      }))
      const ranked = rankCommunityPosts(testCase.query, embeddingMatches, communitySearchEvalPosts, { limit: 3 })
      const returnedIds = ranked.map((post) => post.id)
      const expected = new Set(testCase.expectedRelevantIds)
      const hits = returnedIds.filter((id) => expected.has(id)).length
      relevantTargetCount += Math.min(3, expected.size)
      relevantHitCount += hits
      returnedCount += returnedIds.length
      irrelevantCount += returnedIds.filter((id) => !expected.has(id)).length
      return { id: testCase.id, expected: [...expected], returned: returnedIds }
    })
    const top3Accuracy = relevantHitCount / relevantTargetCount
    const irrelevantCardRate = irrelevantCount / Math.max(1, returnedCount)

    console.info(JSON.stringify({ top3Accuracy, irrelevantCardRate, results }, null, 2))

    expect(top3Accuracy).toBeGreaterThanOrEqual(0.9)
    expect(irrelevantCardRate).toBeLessThanOrEqual(0.05)
  })

  it('중복 글을 제거하고 관련 글이 부족하면 세 장을 억지로 채우지 않는다', () => {
    const phoneCase = communitySearchEvalCases.find((testCase) => testCase.id === 'phone-cancellation')!
    const embeddingMatches = Object.entries(phoneCase.embeddingScores).map(([id, similarity]) => ({
      ...communitySearchEvalPosts.find((post) => post.id === id)!,
      similarity,
    }))
    const phoneResults = rankCommunityPosts(phoneCase.query, embeddingMatches, communitySearchEvalPosts, { limit: 3 })
    const unrelatedCase = communitySearchEvalCases.find((testCase) => testCase.id === 'unrelated-menu')!
    const unrelatedMatches = Object.entries(unrelatedCase.embeddingScores).map(([id, similarity]) => ({
      ...communitySearchEvalPosts.find((post) => post.id === id)!,
      similarity,
    }))

    expect(new Set(phoneResults.map((post) => post.id))).toEqual(new Set(['phone-1', 'phone-2']))
    expect(phoneResults.map((post) => post.id)).not.toContain('phone-1-copy')
    expect(phoneResults).toHaveLength(2)
    expect(rankCommunityPosts(unrelatedCase.query, unrelatedMatches, communitySearchEvalPosts, { limit: 3 })).toEqual([])
  })

  it('질문형 수식어와 가족 호칭이 붙어도 휴대폰 해지 경험담을 찾는다', () => {
    const query = '혹시 할머니 핸드폰 약정을 바로 해지해도 될까?'
    const embeddingMatches = [
      { ...communitySearchEvalPosts.find((post) => post.id === 'phone-1')!, similarity: 0.53 },
      { ...communitySearchEvalPosts.find((post) => post.id === 'phone-2')!, similarity: 0.49 },
    ]

    const results = rankCommunityPosts(query, embeddingMatches, [], { limit: 3 })

    expect(new Set(results.map((post) => post.id))).toEqual(new Set(['phone-1', 'phone-2']))
    expect(results.every((post) => post.keywordScore >= 0.28)).toBe(true)
  })
})
