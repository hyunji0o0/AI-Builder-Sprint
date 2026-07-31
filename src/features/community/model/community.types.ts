/** Public domain models for the community feature. */
export type ReviewCategory =
  | '공지' | '사망신고' | '재산·채무' | '상속 관련 검토'
  | '상담 준비' | '보험' | '자동차' | '통신·공과금' | '부산 지역' | '서류' | '질문'

export type CommunityReview = {
  id: string
  category: ReviewCategory
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

export type CommunitySearchQuery = {
  text: string
  scope: SearchScope
  category: string | null
  region: string | null
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
  markHelpful(id: string): Promise<CommunityReview | null>
}
