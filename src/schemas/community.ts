import { z } from 'zod'

// case.types.ts 등 agent_and_ui 쪽 스키마 컨벤션(UPPER_SNAKE enum, zod)을 그대로 따름.
export const communityCategorySchema = z.enum([
  'RENOUNCE',
  'TAX',
  'TRANSFER',
  'INSURANCE',
  'SUBSCRIPTION',
  'ETC',
])
export type CommunityCategory = z.infer<typeof communityCategorySchema>

export const CATEGORY_LABEL: Record<CommunityCategory, string> = {
  RENOUNCE: '상속포기·한정승인',
  TAX: '상속세',
  TRANSFER: '명의이전',
  INSURANCE: '보험청구',
  SUBSCRIPTION: '통신·구독해지',
  ETC: '기타',
}

export const communityPostSchema = z.object({
  id: z.string(),
  nickname: z.string().min(1).max(20),
  category: communityCategorySchema,
  content: z.string().min(1).max(500),
  createdAt: z.string(),
  helpfulCount: z.number().int().nonnegative().default(0),
})
export type CommunityPost = z.infer<typeof communityPostSchema>

export const createCommunityPostSchema = communityPostSchema.pick({
  nickname: true,
  category: true,
  content: true,
})
export type CreateCommunityPostInput = z.infer<typeof createCommunityPostSchema>

// agent_and_ui의 agent-output.ts COMMUNITY_REVIEW 블록과 합칠 때 쓸 어댑터.
// 지금 AgentBlock.tsx는 review 배열의 첫 번째 항목만 렌더링하니,
// 백엔드에서 이 함수로 변환한 배열을 그대로 흘려보내면 됨.
export type CommunityReviewBlockItem = {
  id: string
  excerpt: string
  reason: string
  createdAt: string
  helpfulCount: number
  url: string | null
  label: '사용자 경험'
}

export function toCommunityReviewItem(post: CommunityPost): CommunityReviewBlockItem {
  return {
    id: post.id,
    excerpt: post.content,
    reason: CATEGORY_LABEL[post.category],
    createdAt: post.createdAt,
    helpfulCount: post.helpfulCount,
    url: null,
    label: '사용자 경험',
  }
}
