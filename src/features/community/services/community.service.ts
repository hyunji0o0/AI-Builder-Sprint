import { CommunityRepository, CommunityReview, CommunitySearchQuery, CreateReviewInput } from '../model/community.types'
import { filterAndSortReviews } from './community.filter'
import { SupabaseCommunityRepository } from './community.remote-repository'

export { calculateReviewSimilarity } from './community.filter'
export { filterAndSortReviews }

export class InMemoryCommunityRepository implements CommunityRepository {
  private reviews: CommunityReview[]

  constructor(initialReviews: CommunityReview[] = []) {
    this.reviews = [...initialReviews]
  }

  async getReviews(query: CommunitySearchQuery) {
    const notices = this.reviews.filter((review) => review.isNotice)
    const nonNotices = this.reviews.filter((review) => !review.isNotice)
    const filtered = filterAndSortReviews(nonNotices, query)
    return query.ids || query.text || query.category || query.similarOnly ? filtered : [...notices, ...filtered]
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
      isSynthetic: false,
    }
    this.reviews = [review, ...this.reviews]
    return review
  }

  async setHelpful(id: string, liked: boolean) {
    this.reviews = this.reviews.map((review) => review.id === id
      ? { ...review, helpfulCount: liked ? review.helpfulCount + 1 : Math.max(0, review.helpfulCount - 1) }
      : review)
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
  const review = await repository.setHelpful(reviewId, true)
  if (review) storage.setItem(storageKey, '1')
  return { updated: Boolean(review), review }
}

export const paginateCommunityReviews = <T>(items: T[], page: number, pageSize: number) => {
  const safePage = Math.max(1, page)
  const safeSize = Math.max(1, pageSize)
  const start = (safePage - 1) * safeSize
  return items.slice(start, start + safeSize)
}

export const communityRepository: CommunityRepository = new SupabaseCommunityRepository()
