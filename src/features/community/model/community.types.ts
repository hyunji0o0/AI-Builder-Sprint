/** Public domain models for the community feature. */
export type ReviewCategory =
  | '상속포기·한정승인' | '상속세' | '명의이전'
  | '보험청구' | '통신·구독해지' | '그냥 이야기' | '동행글' | '기타'

export type CommunityReview = {
  id: string
  categories: ReviewCategory[]
  title: string
  authorName: string
  isAnonymous: boolean
  region: string | null
  relation: string | null
  taskType: string
  situationTags: string[]
  body: {
    situation: string
    difficulty: string
    actionTaken: string
    preparedDocuments: string[]
    usefulTip: string
    caution: string
  }
  createdAt: string
  helpfulCount: number
  commentCount: number
  isNotice: boolean
  isSynthetic: boolean
}

export type CommunityUserContext = {
  relation: string | null
  region: string | null
  currentTaskTypes: string[]
  financialStatus: string | null
  preparingConsultation: boolean
}

export type CommunitySort = 'LATEST' | 'HELPFUL' | 'SIMILAR'
export type SearchScope = 'ALL' | 'TITLE' | 'CONTENT' | 'AUTHOR'
export type LocalPostKind = 'ALL' | 'LOCAL'

export type CommunitySearchQuery = {
  text: string
  scope: SearchScope
  category: string | null
  region: string | null
  localPostKind?: LocalPostKind
  sort: CommunitySort
  userContext?: CommunityUserContext
  similarOnly?: boolean
  ids?: string[]
}

export type CreateReviewInput = Omit<CommunityReview, 'id' | 'createdAt' | 'helpfulCount' | 'commentCount' | 'isNotice' | 'isSynthetic'>

export interface CommunityRepository {
  getReviews(query: CommunitySearchQuery): Promise<CommunityReview[]>
  getReview(id: string): Promise<CommunityReview | null>
  createReview(input: CreateReviewInput): Promise<CommunityReview>
  setHelpful(id: string, liked: boolean): Promise<CommunityReview | null>
}
