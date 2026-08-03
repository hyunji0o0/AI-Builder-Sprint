import {
  fetchCommunityComments, fetchCommunityPost, fetchCommunityPosts,
  setCommunityPostHelpful, submitCommunityPost,
} from '../../../client/community-api'
import { CATEGORY_LABEL, CommunityCategory, CommunityPost } from '../../../schemas/community'
import { CommunityRepository, CommunityReview, CommunitySearchQuery, CreateReviewInput, ReviewCategory } from '../model/community.types'
import { filterAndSortReviews } from './community.filter'

const LABEL_TO_CODE: Record<string, CommunityCategory> = Object.fromEntries(
  Object.entries(CATEGORY_LABEL).map(([code, label]) => [label, code]),
) as Record<string, CommunityCategory>

const labelToCategoryCode = (label: string): CommunityCategory => LABEL_TO_CODE[label] ?? 'ETC'
const categoryCodeToLabel = (code: CommunityCategory): ReviewCategory => (CATEGORY_LABEL[code] ?? '기타') as ReviewCategory

/**
 * DB엔 title 컬럼이 없어서(스키마 변경 없이 가려고), 제목은 content의 첫 줄로 저장한다:
 *   {제목}\n\n{본문}
 * 두 번째 줄바꿈(빈 줄)을 기준으로 제목/본문을 가르며, 첫 줄이 없거나(빈 줄 없음) 너무
 * 길면(80자 초과) 옛 글(제목 없이 저장된 것)로 보고 전체를 본문으로 취급한다.
 * 글쓰기 폼의 서술형 필드(상황/어려웠던 점/조치/준비서류/팁/주의사항)와 지역/관계/업무도
 * 같은 본문 안에 라벨로 얹을 수 있게 남겨뒀지만, 지금 글쓰기 폼은 자유 텍스트 한 칸뿐이라
 * 이 구조화 경로는 대부분 안 탄다.
 */
type ParsedReviewContent = {
  title: string
  situation: string
  difficulty: string
  actionTaken: string
  preparedDocuments: string[]
  usefulTip: string
  caution: string
  region: string | null
  relation: string | null
  taskType: string
}

const TITLE_MAX_LENGTH = 80

export function serializeReviewToContent(input: CreateReviewInput): string {
  const hasStructuredDetail = Boolean(
    input.body.difficulty || input.body.actionTaken || input.body.preparedDocuments.length ||
    input.body.usefulTip || input.body.caution || input.region || input.relation || input.taskType,
  )
  const body = hasStructuredDetail
    ? [
      `[상황] ${input.body.situation}`,
      `[어려웠던 점] ${input.body.difficulty}`,
      `[실제로 한 일] ${input.body.actionTaken}`,
      `[준비한 서류] ${input.body.preparedDocuments.join(', ')}`,
      `[미리 알았으면 좋았을 팁] ${input.body.usefulTip}`,
      `[주의한 점] ${input.body.caution}`,
      `[지역] ${input.region ?? ''}`,
      `[고인과의 관계] ${input.relation ?? ''}`,
      `[관련 업무] ${input.taskType}`,
    ].join('\n')
    : input.body.situation

  const title = input.title.trim()
  return title ? `${title}\n\n${body}` : body
}

export function parseContentToReview(content: string): ParsedReviewContent {
  const result: ParsedReviewContent = {
    title: '', situation: '', difficulty: '', actionTaken: '', preparedDocuments: [],
    usefulTip: '', caution: '', region: null, relation: null, taskType: '',
  }

  const separatorIndex = content.indexOf('\n\n')
  const titleCandidate = separatorIndex > 0 ? content.slice(0, separatorIndex).trim() : ''
  const hasTitleLine = titleCandidate.length > 0 && titleCandidate.length <= TITLE_MAX_LENGTH && !titleCandidate.includes('\n')
  const body = hasTitleLine ? content.slice(separatorIndex + 2) : content
  if (hasTitleLine) result.title = titleCandidate

  const setters: Record<string, (value: string) => void> = {
    '상황': (value) => { result.situation = value },
    '어려웠던 점': (value) => { result.difficulty = value },
    '실제로 한 일': (value) => { result.actionTaken = value },
    '준비한 서류': (value) => { result.preparedDocuments = value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [] },
    '미리 알았으면 좋았을 팁': (value) => { result.usefulTip = value },
    '주의한 점': (value) => { result.caution = value },
    '지역': (value) => { result.region = value || null },
    '고인과의 관계': (value) => { result.relation = value || null },
    '관련 업무': (value) => { result.taskType = value },
  }
  const lineRegex = /^\[([^\]]+)\]\s?(.*)$/
  let matchedAny = false
  body.split('\n').forEach((line) => {
    const match = lineRegex.exec(line.trim())
    const setter = match && setters[match[1]]
    if (!match || !setter) return
    matchedAny = true
    setter(match[2].trim())
  })
  if (!matchedAny) result.situation = body
  return result
}

export function mapPostToReview(post: CommunityPost, commentCount: number): CommunityReview {
  const parsed = parseContentToReview(post.content)
  const isOperationalExample = post.nickname === '곁 운영팀' && post.content.includes('[운영 예시 ID]')
  return {
    id: post.id,
    categories: post.categories.map(categoryCodeToLabel),
    title: parsed.title || post.content.slice(0, 40),
    authorName: post.nickname,
    isAnonymous: true,
    region: parsed.region,
    relation: parsed.relation,
    taskType: parsed.taskType,
    situationTags: [parsed.region, parsed.taskType].filter((value): value is string => Boolean(value)),
    body: {
      situation: parsed.situation,
      difficulty: parsed.difficulty,
      actionTaken: parsed.actionTaken,
      preparedDocuments: parsed.preparedDocuments,
      usefulTip: parsed.usefulTip,
      caution: parsed.caution,
    },
    createdAt: post.createdAt,
    helpfulCount: post.helpfulCount,
    commentCount,
    isNotice: false,
    isSynthetic: isOperationalExample,
  }
}

/** 화면(UI/UX)은 그대로 두고 데이터만 Supabase/Upstage 백엔드로 흘려보내는 어댑터. */
export class SupabaseCommunityRepository implements CommunityRepository {
  async getReviews(query: CommunitySearchQuery): Promise<CommunityReview[]> {
    const categoryCode = query.category && query.category !== '전체' ? labelToCategoryCode(query.category) : undefined
    const sort = query.sort === 'HELPFUL' ? 'helpful' : 'recent'
    // 서버는 content만 ilike 검색하지만 기존 UI는 제목/작성자 범위 검색도 지원해야 하므로
    // 키워드는 서버에 보내지 않고 항상 클라이언트에서 filterAndSortReviews로 걸러낸다.
    const posts = await fetchCommunityPosts(categoryCode, undefined, sort)
    const reviews = posts.map((post) => mapPostToReview(post, 0))
    return filterAndSortReviews(reviews, query)
  }

  async getReview(id: string): Promise<CommunityReview | null> {
    try {
      const [post, comments] = await Promise.all([fetchCommunityPost(id), fetchCommunityComments(id)])
      return mapPostToReview(post, comments.length)
    } catch {
      return null
    }
  }

  async createReview(input: CreateReviewInput): Promise<CommunityReview> {
    const post = await submitCommunityPost({
      nickname: input.authorName,
      categories: input.categories.map(labelToCategoryCode),
      content: serializeReviewToContent(input),
    })
    return mapPostToReview(post, 0)
  }

  async setHelpful(id: string, liked: boolean): Promise<CommunityReview | null> {
    const post = await setCommunityPostHelpful(id, liked)
    return mapPostToReview(post, 0)
  }
}
