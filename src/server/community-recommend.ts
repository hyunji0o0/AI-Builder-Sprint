import { z } from 'zod'
import { CATEGORY_LABEL, CommunityTip, communityTipSchema, COMMUNITY_TIP_DISCLAIMER } from '../schemas/community'
import { PROCEDURE_STEPS, ProcedureStepId } from '../schemas/procedure-steps'
import { buildSystemPrompt } from './community-prompt'
import { CommunityPostMatch, searchCommunityPosts } from './community-store'
import { embedQuery, generateSolarChat } from './upstage-client'

/** 팁을 개인화하는 데 쓰는 신호. 전부 선택 — 없으면 단계만으로 추천함. */
export type RecommendContext = {
  relationToDeceased?: string | null
  region?: string | null
  /** 채무가 자산보다 많은 상황인지. F3 신호등의 🔴에 해당. */
  debtExceedsAssets?: boolean
  /** 금융 조회 결과에 아직 확인 안 된 항목이 있는지. */
  hasUnverifiedItems?: boolean
  /** 이 단계 기한까지 남은 일수. */
  daysRemaining?: number | null
  /** 아직 못 갖춘 서류 라벨. */
  missingDocuments?: string[]
}

export type RecommendInput = {
  /** docs/기획서.md §12의 단계. 이것만 줘도 동작함. */
  stepId?: ProcedureStepId
  /** 단계로 안 떨어지는 상황이거나 맥락을 덧붙이고 싶을 때. */
  situation?: string
  context?: RecommendContext
  /** 카테고리 하드 필터. 기본은 안 씀(아래 주석 참고). */
  category?: string
  limit?: number
}

export type CommunityRecommendation = {
  step: { id: ProcedureStepId; label: string; deadline: string; legalBasis: string } | null
  tips: CommunityTip[]
  disclaimer: string
  /** 임계값을 넘어 후보로 올라온 글 수. 0이면 관련 경험담 자체가 없다는 뜻. */
  candidateCount: number
}

// 유사도 컷. 실측 기준 관련 질문은 0.4~0.55, 무관한 질문은 0.15 언저리로 나와서
// 0.3에서 자름. 이게 없으면 "점심 메뉴" 같은 질문에도 억지로 팁 카드가 만들어짐.
const SIMILARITY_THRESHOLD = 0.3

// LLM에는 문장만 쓰게 하고, id·날짜·좋아요 수 같은 사실은 코드가 채움.
// sourceIndex로 근거 글을 지목하게 해서 메타데이터를 지어낼 수 없게 만든 구조.
const tipDraftSchema = z.object({
  sourceIndex: z.number().int().positive(),
  title: z.string().min(1).max(40),
  summary: z.string().min(1).max(300),
  reason: z.string().min(1).max(200),
  quote: z.string().min(1).max(300),
})
const tipDraftsSchema = z.object({ tips: z.array(tipDraftSchema) })

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  return JSON.parse(candidate)
}

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return '오늘'
  if (days < 7) return `${days}일 전`
  if (days < 30) return `${Math.floor(days / 7)}주 전`
  return `${Math.floor(days / 30)}개월 전`
}

/** 글 하나를 카드로 옮기되 문장은 원문에서 그대로 가져옴 — LLM 실패 시 폴백용. */
function toFallbackTip(match: CommunityPostMatch): CommunityTip {
  const firstSentence = match.content.split(/(?<=[.!?])\s/)[0] ?? match.content
  return {
    id: match.id,
    title: match.categories.map((category) => CATEGORY_LABEL[category]).join(' · '),
    summary: match.content.slice(0, 200),
    reason: `${match.categories.map((category) => CATEGORY_LABEL[category]).join(' · ')} 관련 경험담이야.`,
    quote: firstSentence.slice(0, 200),
    categories: match.categories,
    nickname: match.nickname,
    helpfulCount: match.helpfulCount,
    createdAt: match.createdAt,
    relativeDate: relativeDate(match.createdAt),
    similarity: Number(match.similarity.toFixed(3)),
  }
}

/**
 * 임베딩에 넣을 문장을 만듦.
 *
 * 관계·지역은 일부러 빼둠 — 커뮤니티 글에 그 정보가 거의 없어서 넣으면 유사도만
 * 흐려짐. 대신 LLM에 따로 넘겨서 추천 이유를 쓸 때 반영하게 함.
 * 채무 초과처럼 글 본문에 실제로 나타나는 상황만 검색 문장에 포함시킴.
 */
function buildSearchText(input: RecommendInput): string {
  const parts: string[] = []
  if (input.stepId) parts.push(PROCEDURE_STEPS[input.stepId].searchText)
  if (input.situation?.trim()) parts.push(input.situation.trim())
  if (input.context?.debtExceedsAssets) parts.push('채무가 자산보다 많은 상황.')
  if (input.context?.hasUnverifiedItems) parts.push('금융 조회 결과에 아직 확인되지 않은 항목이 있는 상황.')
  if (input.context?.missingDocuments?.length) {
    parts.push(`아직 준비하지 못한 서류: ${input.context.missingDocuments.join(', ')}.`)
  }
  return parts.join(' ')
}

/** LLM이 추천 이유를 상황에 맞게 쓰도록 넘기는 사용자 맥락. 값이 있는 것만 넣음. */
function describeContext(input: RecommendInput): string[] {
  const context = input.context
  if (!context) return []
  const lines: string[] = []
  if (context.relationToDeceased) lines.push(`고인과의 관계: ${context.relationToDeceased}`)
  if (context.region) lines.push(`지역: ${context.region}`)
  if (context.debtExceedsAssets) lines.push('현재 확인된 채무가 자산보다 많음')
  if (context.hasUnverifiedItems) lines.push('금융 조회 결과에 아직 확인되지 않은 항목이 있음')
  if (typeof context.daysRemaining === 'number') lines.push(`이 단계 기한까지 ${context.daysRemaining}일 남음`)
  if (context.missingDocuments?.length) lines.push(`아직 없는 서류: ${context.missingDocuments.join(', ')}`)
  return lines
}

/**
 * 지금 밟고 있는 단계(stepId)와 사용자 상황을 받아 관련 경험담을 찾고,
 * Solar Pro 3가 각 글을 팁 카드로 정리한 결과를 돌려줌.
 *
 * 메인 챗에서 쓸 때는 schemas/community.ts의 toCommunityReviewBlock()으로
 * COMMUNITY_REVIEW 블록 형태로 변환하면 됨.
 */
export async function recommendCommunityTips(input: RecommendInput): Promise<CommunityRecommendation> {
  const limit = input.limit ?? 3
  const step = input.stepId
    ? {
      id: input.stepId,
      label: PROCEDURE_STEPS[input.stepId].label,
      deadline: PROCEDURE_STEPS[input.stepId].deadline,
      legalBasis: PROCEDURE_STEPS[input.stepId].legalBasis,
    }
    : null

  const searchText = buildSearchText(input)
  if (!searchText.trim()) {
    return { step, tips: [], disclaimer: COMMUNITY_TIP_DISCLAIMER, candidateCount: 0 }
  }

  const queryEmbedding = await embedQuery(searchText)
  // 카테고리 하드 필터는 기본으로 쓰지 않음. ETC에 24개가 몰려 있어서 필터가 오히려
  // 관련 없는 글을 끌어오고, 반대로 RENOUNCE는 2개뿐이라 필터를 걸면 후보가 말라버림.
  // 유사도로 거르는 편이 실측상 더 정확해서 category는 호출부가 명시할 때만 씀.
  const matches = await searchCommunityPosts(queryEmbedding, input.category, limit * 2)
  const candidates = matches.filter((match) => match.similarity >= SIMILARITY_THRESHOLD).slice(0, limit)

  if (candidates.length === 0) {
    return { step, tips: [], disclaimer: COMMUNITY_TIP_DISCLAIMER, candidateCount: 0 }
  }

  const postList = candidates
    .map((match, i) => `${i + 1}. [${match.categories.map((c) => CATEGORY_LABEL[c]).join(' · ')}] ${match.content}`)
    .join('\n')

  const stepLine = step
    ? `${step.label} (기한 ${step.deadline}, 기준 ${PROCEDURE_STEPS[step.id].baseDate})`
    : (input.situation?.trim() ?? '단계 미지정')
  const contextLines = describeContext(input)
  const userMessage = [
    `사용자가 지금 밟고 있는 단계: ${stepLine}`,
    contextLines.length ? `사용자 상황:\n${contextLines.map((line) => `- ${line}`).join('\n')}` : '',
    `관련 경험담 목록:\n${postList}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const raw = await generateSolarChat([
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: userMessage },
    ])
    const drafts = tipDraftsSchema.parse(extractJson(raw))

    const tips = drafts.tips
      .map((draft) => {
        // sourceIndex는 1-based. 범위를 벗어나면 지어낸 것이므로 버림.
        const match = candidates[draft.sourceIndex - 1]
        if (!match) return null
        return communityTipSchema.parse({
          id: match.id,
          title: draft.title,
          summary: draft.summary,
          reason: draft.reason,
          quote: draft.quote,
          categories: match.categories,
          nickname: match.nickname,
          helpfulCount: match.helpfulCount,
          createdAt: match.createdAt,
          relativeDate: relativeDate(match.createdAt),
          similarity: Number(match.similarity.toFixed(3)),
        })
      })
      .filter((tip): tip is CommunityTip => tip !== null)

    return { step, tips, disclaimer: COMMUNITY_TIP_DISCLAIMER, candidateCount: candidates.length }
  } catch (error) {
    // LLM이 죽거나 JSON이 깨져도 추천 자체는 나가야 함 — 원문 기반 카드로 폴백.
    console.error('팁 카드 생성 실패, 원문 기반 폴백 사용:', error)
    return {
      step,
      tips: candidates.map(toFallbackTip),
      disclaimer: COMMUNITY_TIP_DISCLAIMER,
      candidateCount: candidates.length,
    }
  }
}
