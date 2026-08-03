import { CommunityReview, CommunitySearchQuery, CommunityUserContext, ReviewCategory } from '../model/community.types'

export const calculateReviewSimilarity = (review: CommunityReview, context: CommunityUserContext) => {
  let score = 0
  if (context.relation && review.relation === context.relation) score += 30
  if (context.region && review.region?.includes(context.region)) score += 25
  if (context.currentTaskTypes.some((task) => review.taskType.includes(task) || review.situationTags.some((tag) => tag.includes(task)))) score += 25
  if (context.financialStatus && review.situationTags.includes(context.financialStatus)) score += 10
  if (context.preparingConsultation && review.situationTags.includes('전문가 상담 준비')) score += 10
  return score
}

const reviewText = (review: CommunityReview) => [
  review.title, review.body.situation, review.body.difficulty, review.body.actionTaken,
  review.body.usefulTip, review.body.caution, review.region || '', review.taskType,
].join(' ').toLowerCase()

/** 카테고리/지역/텍스트 범위/유사도 필터링과 정렬을 담당하는 순수 함수 — in-memory·remote 리포지토리가 공유. */
export const filterAndSortReviews = (allReviews: CommunityReview[], query: CommunitySearchQuery): CommunityReview[] => {
  let reviews = allReviews
  if (query.category && query.category !== '전체') reviews = reviews.filter((review) => review.categories.includes(query.category as ReviewCategory))
  if (query.region) reviews = reviews.filter((review) => review.region?.includes(query.region!))
  if (query.localPostKind === 'LOCAL') {
    reviews = reviews.filter((review) => review.taskType.startsWith('지역모임') && !review.taskType.includes('공공기관 동행'))
  }
  if (query.ids) reviews = reviews.filter((review) => query.ids?.includes(review.id))
  if (query.text.trim()) {
    const keyword = query.text.trim().toLowerCase()
    reviews = reviews.filter((review) => {
      if (query.scope === 'TITLE') return review.title.toLowerCase().includes(keyword)
      if (query.scope === 'AUTHOR') return review.authorName.toLowerCase().includes(keyword)
      if (query.scope === 'CONTENT') return reviewText(review).includes(keyword) && !review.title.toLowerCase().includes(keyword)
      return reviewText(review).includes(keyword) || review.authorName.toLowerCase().includes(keyword)
    })
  }
  if (query.similarOnly && query.userContext) reviews = reviews.filter((review) => calculateReviewSimilarity(review, query.userContext!) >= 40)
  return [...reviews].sort((a, b) => query.sort === 'HELPFUL'
    ? b.helpfulCount - a.helpfulCount
    : query.sort === 'SIMILAR' && query.userContext
      ? calculateReviewSimilarity(b, query.userContext) - calculateReviewSimilarity(a, query.userContext)
      : b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
}
