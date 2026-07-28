import { communityReviews } from '../data/community.data'
import { CommunityRepository, CommunityReview, CommunitySearchQuery, CommunityUserContext, CreateReviewInput } from '../model/community.types'

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

export class MockCommunityRepository implements CommunityRepository {
  private reviews = [...communityReviews]

  async getReviews(query: CommunitySearchQuery) {
    const notices = this.reviews.filter((review) => review.isNotice)
    let reviews = this.reviews.filter((review) => !review.isNotice)
    if (query.category && query.category !== '전체') reviews = reviews.filter((review) =>
      review.category === query.category || (query.category === '부산 지역' && review.region === '부산'))
    if (query.region) reviews = reviews.filter((review) => review.region === query.region)
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
    reviews.sort((a, b) => query.sort === 'HELPFUL'
      ? b.helpfulCount - a.helpfulCount
      : query.sort === 'SIMILAR' && query.userContext
        ? calculateReviewSimilarity(b, query.userContext) - calculateReviewSimilarity(a, query.userContext)
        : b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    return query.ids || query.text || query.category || query.similarOnly ? reviews : [...notices, ...reviews]
  }

  async getReview(id: string) {
    return this.reviews.find((review) => review.id === id) || null
  }

  async createReview(input: CreateReviewInput) {
    const review: CommunityReview = {
      ...input,
      id: `review-${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
      helpfulCount: 0,
      commentCount: 0,
      isNotice: false,
      isSynthetic: true,
    }
    this.reviews = [review, ...this.reviews]
    return review
  }

  async markHelpful(id: string) {
    this.reviews = this.reviews.map((review) => review.id === id ? { ...review, helpfulCount: review.helpfulCount + 1 } : review)
    return this.getReview(id)
  }
}

export const hasPossiblePrivateInformation = (text: string) => [
  /\b\d{6}-?[1-4]\d{6}\b/,
  /\b01[016789]-?\d{3,4}-?\d{4}\b/,
  /\b\d{2,6}-\d{2,6}-\d{2,8}\b/,
  /\b\d{4,}-?\d{2,}-?\d{2,}\b/,
].some((pattern) => pattern.test(text))

export interface CommunityStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const markReviewHelpfulOnce = async (
  repository: CommunityRepository,
  reviewId: string,
  storage: CommunityStorage,
) => {
  const storageKey = `community-helpful-${reviewId}`
  if (storage.getItem(storageKey)) {
    return { updated: false, review: await repository.getReview(reviewId) }
  }
  const review = await repository.markHelpful(reviewId)
  if (review) storage.setItem(storageKey, '1')
  return { updated: Boolean(review), review }
}

export const paginateCommunityReviews = <T>(items: T[], page: number, pageSize: number) => {
  const safePage = Math.max(1, page)
  const safeSize = Math.max(1, pageSize)
  const start = (safePage - 1) * safeSize
  return items.slice(start, start + safeSize)
}

export const communityRepository = new MockCommunityRepository()
