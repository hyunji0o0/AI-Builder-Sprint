import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { communityReviews, communityUserContext } from '../data/community.data'
import { resolveCommunityRoute } from '../routing/community.routes'
import {
  hasPossiblePrivateInformation,
  hasUnsafeLocalMeetingInformation,
  formatCommunityRegion,
  calculateReviewSimilarity,
  markReviewHelpfulOnce,
  InMemoryCommunityRepository,
  paginateCommunityReviews,
  getVisibleCommunityPages,
  filterAndSortReviews,
} from '../services/community.service'
import { CommunityReview } from '../model/community.types'
import { mapPostToReview, parseContentToReview, serializeReviewToContent } from '../services/community.remote-repository'
import { CATEGORY_LABEL, CommunityPost, communityCategorySchema } from '../../../schemas/community'
import { toKstDate } from '../services/community.format'

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

  it('createdAt을 한국시간(KST) 기준 날짜로 변환한다', () => {
    // 실제 DB 데이터: 한국시간 8/2 01:21에 올린 글이 UTC로는 8/1 16:21.
    // UTC 날짜(08-01)가 아니라 KST 날짜(08-02)로 표기돼야 한다.
    expect(toKstDate('2026-08-01T16:21:59.567263+00:00')).toBe('2026-08-02')
    // 자정 직전(한국시간 8/1 23:00)은 그대로 8/1.
    expect(toKstDate('2026-08-01T14:00:00.000Z')).toBe('2026-08-01')
    // 시간 없는 날짜 문자열(시드 데이터)은 그대로 둔다.
    expect(toKstDate('2026-07-29')).toBe('2026-07-29')
  })

  it('원격 글 매핑 시 createdAt의 시간 정보를 자르지 않는다', () => {
    // slice(0,10)로 날짜만 남기면 같은 날 글이 전부 동시각 취급돼 최신순이 깨졌던 버그의 회귀 테스트.
    const post: CommunityPost = {
      id: 'uuid-1', nickname: '익명', categories: ['ETC'],
      content: '제목\n\n본문', createdAt: '2026-08-02T15:04:05.000Z', helpfulCount: 0,
    }
    expect(mapPostToReview(post, 0).createdAt).toBe('2026-08-02T15:04:05.000Z')
  })

  it('운영팀이 넣은 예시 글은 실제 사용자 경험으로 표시하지 않는다', () => {
    const post: CommunityPost = {
      id: 'seed-1', nickname: '곁 운영팀', categories: ['VENT'],
      content: '지역 이야기 예시\n\n[상황] 운영 예시입니다.\n[운영 예시 ID] local-busan-01',
      createdAt: '2026-08-03T00:00:00.000Z', helpfulCount: 0,
    }
    expect(mapPostToReview(post, 0).isSynthetic).toBe(true)
  })

  it('동행글을 독립 커뮤니티 카테고리로 지원한다', () => {
    expect(communityCategorySchema.parse('COMPANION')).toBe('COMPANION')
    expect(CATEGORY_LABEL.COMPANION).toBe('동행글')
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

  it('6페이지로 이동하면 페이지 번호 범위에 6을 표시한다', () => {
    expect(getVisibleCommunityPages(1, 10, 5)).toEqual([1, 2, 3, 4, 5])
    expect(getVisibleCommunityPages(6, 10, 5)).toEqual([4, 5, 6, 7, 8])
    expect(getVisibleCommunityPages(10, 10, 5)).toEqual([6, 7, 8, 9, 10])
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

  it('지역 모임 글의 지역과 유형을 저장하고 다시 읽는다', () => {
    const content = serializeReviewToContent({
      title: '부산에서 이야기 나눌 분', categories: ['그냥 이야기'], authorName: '익명의 곁', isAnonymous: true,
      region: '부산광역시 · 해운대구', relation: null, taskType: '지역모임 · 이야기 모임',
      situationTags: ['부산광역시 · 해운대구', '지역모임 · 이야기 모임'],
      body: { situation: '주말 낮에 도서관 같은 공개 장소에서 이야기 나누고 싶어요.', difficulty: '', actionTaken: '', preparedDocuments: [], usefulTip: '', caution: '' },
    })
    const parsed = parseContentToReview(content)

    expect(parsed.region).toBe('부산광역시 · 해운대구')
    expect(parsed.taskType).toBe('지역모임 · 이야기 모임')
  })

  it('시·도 기준으로 지역 글을 필터링한다', () => {
    const localReview = { ...makeReview('local', '2026-08-03T00:00:00.000Z'), region: '부산광역시 · 해운대구' }
    const otherReview = { ...makeReview('other', '2026-08-03T00:00:00.000Z'), region: '서울특별시 · 마포구' }

    expect(filterAndSortReviews([localReview, otherReview], { ...base, region: '부산광역시' }).map((review) => review.id)).toEqual(['local'])
  })

  it('일반 글의 선택 지역을 저장 형식으로 만들고 미선택은 비워둔다', () => {
    expect(formatCommunityRegion('부산광역시', '해운대구')).toBe('부산광역시 · 해운대구')
    expect(formatCommunityRegion('서울특별시')).toBe('서울특별시')
    expect(formatCommunityRegion('', '해운대구')).toBeNull()
  })

  it('지역 이야기와 동행글 카테고리를 분리한다', () => {
    const localStory: CommunityReview = { ...makeReview('local-story', '2026-08-03T02:00:00.000Z'), categories: ['그냥 이야기'], region: '부산광역시', taskType: '지역모임 · 이야기 모임' }
    const localInfo: CommunityReview = { ...makeReview('local-info', '2026-08-03T01:00:00.000Z'), categories: ['그냥 이야기'], region: '부산광역시', taskType: '지역모임 · 행정 정보 나눔' }
    const companion: CommunityReview = { ...makeReview('companion', '2026-08-03T00:00:00.000Z'), categories: ['동행글'], region: '부산광역시', taskType: '지역모임 · 공공기관 동행' }
    const normalStory: CommunityReview = { ...makeReview('normal', '2026-08-02T23:00:00.000Z'), categories: ['그냥 이야기'] }

    expect(filterAndSortReviews([localStory, localInfo, companion, normalStory], { ...base, category: '그냥 이야기', localPostKind: 'LOCAL' }).map((review) => review.id)).toEqual(['local-story', 'local-info'])
    expect(filterAndSortReviews([localStory, localInfo, companion, normalStory], { ...base, category: '동행글', localPostKind: 'ALL' }).map((review) => review.id)).toEqual(['companion'])
  })

  it('지역 모임에 위험한 연락처와 상세 주소를 탐지한다', () => {
    expect(hasPossiblePrivateInformation('연락처는 010-1234-5678입니다')).toBe(true)
    expect(hasPossiblePrivateInformation('해운대로 123-4에서 만나요')).toBe(true)
    expect(hasPossiblePrivateInformation('부산광역시 해운대구의 도서관에서 만나요')).toBe(false)
  })

  it('모바일 게시판 카드 레이아웃이 정의되어 있다', () => {
    const css = readFileSync(new URL('../styles/community.css', import.meta.url), 'utf8')
    expect(css).toContain('@media(max-width:720px)')
    expect(css).toMatch(/\.cm-row\s*\{[\s\S]*grid-template-columns:auto 1fr auto/)
    expect(css).toContain('grid-template-columns:64px 118px minmax(0,1fr) 112px 82px 70px')
    expect(css).toContain('box-sizing:border-box;min-width:0')
  })

  it('커뮤니티 모든 게시판에 지역 열을 표시한다', () => {
    const page = readFileSync(new URL('../ui/CommunityPage.tsx', import.meta.url), 'utf8')
    const common = readFileSync(new URL('../ui/CommunityCommon.tsx', import.meta.url), 'utf8')

    expect(page).toContain('<span>제목</span><span>지역</span><span>작성자</span>')
    expect(page).not.toContain('const showRegion')
    expect(common).toContain("review.region ?? '지역 무관'")
  })

  it('지역 필터 영역을 모든 커뮤니티 카테고리에서 표시한다', () => {
    const page = readFileSync(new URL('../ui/CommunityPage.tsx', import.meta.url), 'utf8')

    expect(page).toContain('<CommunityRegionPanel controller={c}/>')
    expect(page).not.toContain("c.category === '그냥 이야기' &&")
    expect(page).toContain('카테고리에 관계없이 지역별 글을 찾아보고 나눠보세요.')
  })

  it('지역 모임의 외부 연락 링크는 막고 넓은 지역명은 허용한다', () => {
    expect(hasUnsafeLocalMeetingInformation('오픈채팅 링크는 https://open.kakao.com/o/example 입니다')).toBe(true)
    expect(hasUnsafeLocalMeetingInformation('카카오톡 아이디를 댓글로 알려드릴게요')).toBe(true)
    expect(hasUnsafeLocalMeetingInformation('부산광역시 해운대구의 공개된 주민센터에서 만나요')).toBe(false)
  })

  it('기본 후기는 사용자 경험임을 구분할 수 있다', () => {
    expect(communityReviews.filter((review) => !review.isNotice).every((review) => review.isSynthetic)).toBe(true)
  })
})
