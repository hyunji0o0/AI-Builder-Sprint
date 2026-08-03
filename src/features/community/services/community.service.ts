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
      createdAt: new Date().toISOString(),
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
  /(?:로|길)\s*\d+(?:-\d+)?(?:번지)?/,
  /\d+동\s*\d+호/,
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
].some((pattern) => pattern.test(text))

export const hasUnsafeLocalMeetingInformation = (text: string) =>
  hasPossiblePrivateInformation(text)
  || /https?:\/\/|open\.kakao|오픈채팅|카카오톡|텔레그램|인스타(?:그램)?\s*(?:아이디|계정)/i.test(text)

export const formatCommunityRegion = (region: string, district = '') => {
  const province = region.trim()
  if (!province) return null
  return [province, district.trim()].filter(Boolean).join(' · ')
}

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

export const getVisibleCommunityPages = (currentPage: number, totalPages: number, maxVisible: number) => {
  const safeTotal = Math.max(1, totalPages)
  const safeMax = Math.max(1, maxVisible)
  const visibleCount = Math.min(safeMax, safeTotal)
  const safeCurrent = Math.min(safeTotal, Math.max(1, currentPage))
  const maxStart = safeTotal - visibleCount + 1
  const start = Math.min(maxStart, Math.max(1, safeCurrent - Math.floor(visibleCount / 2)))

  return Array.from({ length: visibleCount }, (_, index) => start + index)
}

export const communityRepository: CommunityRepository = new SupabaseCommunityRepository()
