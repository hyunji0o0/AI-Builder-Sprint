import { z } from 'zod'

// case.types.ts 등 agent_and_ui 쪽 스키마 컨벤션(UPPER_SNAKE enum, zod)을 그대로 따름.
export const communityCategorySchema = z.enum([
  'RENOUNCE',
  'TAX',
  'TRANSFER',
  'INSURANCE',
  'SUBSCRIPTION',
  'VENT',
  'ETC',
])
export type CommunityCategory = z.infer<typeof communityCategorySchema>

// VENT는 F2 할일 카테고리와 매칭되는 다른 카테고리들과 달리, 특정 할일에 안 묶이는
// 하소연·감정 나눔용으로 따로 추가함 — 에이전트가 "관련 팁"으로 추천할 때는
// 자연스럽게 제외되고, 커뮤니티 피드에서만 필터링되는 카테고리.
export const CATEGORY_LABEL: Record<CommunityCategory, string> = {
  RENOUNCE: '상속포기·한정승인',
  TAX: '상속세',
  TRANSFER: '명의이전',
  INSURANCE: '보험청구',
  SUBSCRIPTION: '통신·구독해지',
  VENT: '그냥 이야기',
  ETC: '기타',
}

// DB의 community_posts.categories는 text[] — 글 하나에 카테고리를 여러 개 달 수 있음.
// 최소 1개는 있어야 에이전트가 "이 할일과 관련된 팁"을 필터링할 수 있어서 min(1).
export const communityPostSchema = z.object({
  id: z.string(),
  nickname: z.string().min(1).max(20),
  // 긴 팁 하나가 여러 주제를 다룰 수 있어서 카테고리를 배열로 허용함(중복 태깅).
  categories: z.array(communityCategorySchema).min(1),
  // 첫 줄은 제목, 빈 줄 하나 띄우고 본문 — DB에 별도 title 컬럼 없이
  // community.remote-repository.ts에서 조립/분리한다.
  content: z.string().min(1),
  createdAt: z.string(),
  helpfulCount: z.number().int().nonnegative().default(0),
})
export type CommunityPost = z.infer<typeof communityPostSchema>

export const createCommunityPostSchema = communityPostSchema.pick({
  nickname: true,
  categories: true,
  content: true,
})
export type CreateCommunityPostInput = z.infer<typeof createCommunityPostSchema>

export const updateCommunityPostSchema = communityPostSchema.pick({
  categories: true,
  content: true,
})
export type UpdateCommunityPostInput = z.infer<typeof updateCommunityPostSchema>

export const communityCommentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  parentId: z.string().nullable().default(null),
  nickname: z.string().min(1).max(20),
  content: z.string().min(1),
  createdAt: z.string(),
})
export type CommunityComment = z.infer<typeof communityCommentSchema>

export const createCommunityCommentSchema = communityCommentSchema.pick({
  nickname: true,
  content: true,
  parentId: true,
})
export type CreateCommunityCommentInput = z.infer<typeof createCommunityCommentSchema>

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

export const COMMUNITY_TIP_DISCLAIMER = '개인의 경험이라 상황에 따라 다를 수 있어. 공식 기관 안내도 함께 확인해줘.'

// 메인 챗이 "지금 단계에 맞는 팁"으로 받아 쓰는 카드 형태.
// LLM이 쓰는 건 title/summary/reason/quote 네 개뿐이고 나머지는 전부 DB 값 —
// 날짜나 좋아요 수를 지어내지 못하게 하려는 구조(community-recommend.ts 참고).
export const communityTipSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  reason: z.string(),
  quote: z.string(),
  categories: z.array(communityCategorySchema),
  nickname: z.string(),
  helpfulCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  relativeDate: z.string(),
  similarity: z.number(),
})
export type CommunityTip = z.infer<typeof communityTipSchema>

// agent_and_ui의 COMMUNITY_REVIEW 블록으로 변환하는 어댑터.
// 블록은 지금 reviews[0]만 렌더링하므로 가장 관련도 높은 팁이 앞에 오도록 그대로 넘김.
// 블록 스키마가 바뀌면 이 함수만 고치면 됨.
export function toCommunityReviewBlock(tips: CommunityTip[], disclaimer = COMMUNITY_TIP_DISCLAIMER) {
  return {
    type: 'COMMUNITY_REVIEW' as const,
    reviews: tips.map((tip) => ({
      id: tip.id,
      excerpt: tip.quote,
      reason: tip.reason,
      createdAt: tip.relativeDate, // 블록이 값을 그대로 출력해서 ISO 대신 사람이 읽는 형태로 넘김
      helpfulCount: tip.helpfulCount,
      url: null,
      label: '사용자 경험' as const,
    })),
    disclaimer,
  }
}

export function toCommunityReviewItem(post: CommunityPost): CommunityReviewBlockItem {
  return {
    id: post.id,
    excerpt: post.content,
    reason: post.categories.map((cat) => CATEGORY_LABEL[cat]).join(' · '),
    createdAt: post.createdAt,
    helpfulCount: post.helpfulCount,
    url: null,
    label: '사용자 경험',
  }
}
