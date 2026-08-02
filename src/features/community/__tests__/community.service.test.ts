import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { communityReviews, communityUserContext } from '../data/community.data'
import { resolveCommunityRoute } from '../routing/community.routes'
import {
  hasPossiblePrivateInformation,
  calculateReviewSimilarity,
  markReviewHelpfulOnce,
  InMemoryCommunityRepository,
  paginateCommunityReviews,
  filterAndSortReviews,
} from '../services/community.service'
import { CommunityReview } from '../model/community.types'
import { mapPostToReview } from '../services/community.remote-repository'
import { CommunityPost } from '../../../schemas/community'

const makeReview = (id: string, createdAt: string): CommunityReview => ({
  id, createdAt, categories: ['기타'], title: id, authorName: '익명', isAnonymous: true,
  region: null, relation: null, taskType: '기타', situationTags: [],
  body: { situation: '', difficulty: '', actionTaken: '', preparedDocuments: [], usefulTip: '', caution: '' },
  helpfulCount: 0, commentCount: 0, isNotice: false, isSynthetic: false,
})

const repository = () => new InMemoryCommunityRepository(communityReviews)
const base = { text: '', scope: 'ALL' as const, category: null, region: null, sort: 'LATEST' as const, userContext: communityUserContext }

describe('community feature', () => {
  it('카테고리 필터가 동작한다', async () => {
    const reviews = await repository().getReviews({ ...base, category: '보험청구' })
    expect(reviews.length).toBeGreaterThan(0)
    expect(reviews.every((review) => review.categories.includes('보험청구'))).toBe(true)
  })

  it('제목 검색이 동작한다', async () => {
    const reviews = await repository().getReviews({ ...base, text: '사망신고', scope: 'TITLE' })
    expect(reviews.some((review) => review.title.includes('사망신고'))).toBe(true)
  })

  it('내용 검색이 동작한다', async () => {
    const reviews = await repository().getReviews({ ...base, text: '전화', scope: 'CONTENT' })
    expect(reviews.some((review) => JSON.stringify(review.body).includes('전화'))).toBe(true)
  })

  it('도움순으로 정렬한다', async () => {
    const reviews = await repository().getReviews({ ...base, sort: 'HELPFUL' })
    expect(reviews[0].helpfulCount).toBeGreaterThanOrEqual(reviews[1].helpfulCount)
  })

  it('같은 날 작성된 글도 시간까지 반영해 최신순으로 정렬한다', () => {
    // id는 UUID처럼 작성 시간과 무관한 순서. 날짜만 비교하면 id 순서로 뒤섞이던 버그의 회귀 테스트.
    const reviews = [
      makeReview('c-uuid', '2026-08-02T09:00:00.000Z'),
      makeReview('a-uuid', '2026-08-02T15:00:00.000Z'),
      makeReview('b-uuid', '2026-08-02T12:00:00.000Z'),
    ]
    const sorted = filterAndSortReviews(reviews, { ...base, sort: 'LATEST' })
    expect(sorted.map((review) => review.id)).toEqual(['a-uuid', 'b-uuid', 'c-uuid'])
  })

  it('원격 글 매핑 시 createdAt의 시간 정보를 자르지 않는다', () => {
    // slice(0,10)로 날짜만 남기면 같은 날 글이 전부 동시각 취급돼 최신순이 깨졌던 버그의 회귀 테스트.
    const post: CommunityPost = {
      id: 'uuid-1', nickname: '익명', categories: ['ETC'],
      content: '제목\n\n본문', createdAt: '2026-08-02T15:04:05.000Z', helpfulCount: 0,
    }
    expect(mapPostToReview(post, 0).createdAt).toBe('2026-08-02T15:04:05.000Z')
  })

  it('비슷한 상황순으로 정렬한다', async () => {
    const reviews = await repository().getReviews({ ...base, sort: 'SIMILAR' })
    expect(calculateReviewSimilarity(reviews[0], communityUserContext))
      .toBeGreaterThanOrEqual(calculateReviewSimilarity(reviews[1], communityUserContext))
  })

  it('비슷한 후기만 필터링한다', async () => {
    const reviews = await repository().getReviews({ ...base, similarOnly: true })
    expect(reviews.every((review) => calculateReviewSimilarity(review, communityUserContext) >= 40)).toBe(true)
  })

  it('페이지 단위로 자른다', () => {
    expect(paginateCommunityReviews([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4])
  })

  it('목록·상세·작성 경로를 구분한다', () => {
    expect(resolveCommunityRoute('/community')).toEqual({ type: 'main' })
    expect(resolveCommunityRoute('/community/write')).toEqual({ type: 'write' })
    expect(resolveCommunityRoute('/community/review-1')).toEqual({ type: 'detail', reviewId: 'review-1' })
  })

  it('도움돼요를 한 번만 반영한다', async () => {
    const repo = repository()
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
    const before = await repo.getReview('review-01')
    const first = await markReviewHelpfulOnce(repo, 'review-01', storage)
    const second = await markReviewHelpfulOnce(repo, 'review-01', storage)
    expect(first.updated).toBe(true)
    expect(second.updated).toBe(false)
    expect(second.review?.helpfulCount).toBe((before?.helpfulCount ?? 0) + 1)
  })

  it('개인정보처럼 보이는 입력을 감지한다', () => {
    expect(hasPossiblePrivateInformation('010-1234-5678로 연락했어요')).toBe(true)
    expect(hasPossiblePrivateInformation('서류 준비 경험을 나눕니다')).toBe(false)
  })

  it('검색 결과가 없으면 빈 목록을 반환한다', async () => {
    expect(await repository().getReviews({ ...base, text: '존재하지않는검색어987654321' })).toEqual([])
  })

  it('새 글은 공식 정보가 아닌 사용자 경험으로 생성한다', async () => {
    const review = await repository().createReview({
      title: '테스트 후기', categories: ['기타'], authorName: '익명의 곁', isAnonymous: true,
      region: '부산', relation: '부모님', taskType: '기타', situationTags: ['테스트'],
      body: {
        situation: '테스트 상황', difficulty: '어려웠던 점', actionTaken: '직접 확인했어요.',
        preparedDocuments: [], usefulTip: '개인 경험입니다.', caution: '공식 기관에 확인하세요.',
      },
    })
    expect(review.isSynthetic).toBe(false)
    expect(review.isNotice).toBe(false)
  })

  it('모바일 게시판 카드 레이아웃이 정의되어 있다', () => {
    const css = readFileSync(new URL('../styles/community.css', import.meta.url), 'utf8')
    expect(css).toContain('@media(max-width:720px)')
    expect(css).toMatch(/\.cm-row\s*\{[\s\S]*grid-template-columns:auto 1fr auto/)
  })

  it('기본 후기는 사용자 경험임을 구분할 수 있다', () => {
    expect(communityReviews.filter((review) => !review.isNotice).every((review) => review.isSynthetic)).toBe(true)
  })
})
