import type { CommunityCategory, CommunityPost } from '../schemas/community'
import type { CommunityPostMatch } from './community-store'

export type RankedCommunityPost = CommunityPostMatch & {
  embeddingSimilarity: number
  keywordScore: number
  hybridScore: number
}

const STOP_WORDS = new Set([
  '고인', '관련', '보통', '일반적', '일반적인', '어떻게', '알려줘', '설명해줘',
  '방법', '절차', '질문', '경우', '해도', '해야', '있어', '없어', '하고', '싶어',
])

const SYNONYM_GROUPS = [
  ['휴대폰', '핸드폰', '통신', '전화', '회선'],
  ['해지', '정지', '종료', '명의정리'],
  ['상속포기', '한정승인', '상속채무', '가정법원'],
  ['빚', '채무', '대출', '부채'],
  ['상속세', '세금', '세무서', '신고기한'],
  ['보험금', '보험청구', '수익자', '보험사'],
  ['장례', '장례식장', '조문', '빈소'],
  ['명의이전', '소유권이전', '등기', '자동차이전'],
  ['위조', '가짜서류', '문서조작', '신고'],
  ['피싱', '사칭문자', '가짜문자', '스미싱'],
  ['계좌', '예금', '통장', '금융조회'],
]

const normalize = (text: string) => text
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

const compact = (text: string) => normalize(text).replace(/\s+/g, '')

export function extractSearchKeywords(query: string): string[] {
  const normalized = normalize(query)
  const baseTokens = normalized
    .split(/\s+/)
    .map((token) => token.replace(/(?:은|는|이|가|을|를|에|에서|으로|로|랑|과|와|도|만|부터|까지)$/u, ''))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
  const queryCompact = compact(query)
  const expanded = new Set(baseTokens)

  for (const group of SYNONYM_GROUPS) {
    if (group.some((term) => queryCompact.includes(compact(term)))) {
      group.forEach((term) => expanded.add(compact(term)))
    }
  }

  return [...expanded].filter((token) => token.length >= 2)
}

function keywordRelevance(query: string, content: string): number {
  const keywords = extractSearchKeywords(query)
  if (keywords.length === 0) return 0
  const normalizedContent = compact(content)
  const title = compact(content.split(/\r?\n/, 1)[0] ?? '')
  let matchedWeight = 0
  let totalWeight = 0

  for (const keyword of keywords) {
    const weight = keyword.length >= 4 ? 1.25 : 1
    totalWeight += weight
    if (normalizedContent.includes(keyword)) {
      matchedWeight += title.includes(keyword) ? weight * 1.15 : weight
    }
  }

  return Math.min(1, matchedWeight / Math.max(1, totalWeight))
}

const tokenSet = (text: string) => new Set(normalize(text).split(/\s+/).filter((token) => token.length >= 2))

function jaccardSimilarity(left: string, right: string): number {
  const a = tokenSet(left)
  const b = tokenSet(right)
  if (a.size === 0 || b.size === 0) return 0
  const intersection = [...a].filter((token) => b.has(token)).length
  return intersection / (a.size + b.size - intersection)
}

function isNearDuplicate(candidate: CommunityPost, selected: CommunityPost[]): boolean {
  const candidateCompact = compact(candidate.content)
  return selected.some((post) => {
    const selectedCompact = compact(post.content)
    return candidateCompact === selectedCompact
      || (Math.min(candidateCompact.length, selectedCompact.length) >= 40
        && (candidateCompact.includes(selectedCompact) || selectedCompact.includes(candidateCompact)))
      || jaccardSimilarity(candidate.content, post.content) >= 0.72
  })
}

export function rankCommunityPosts(
  query: string,
  embeddingMatches: CommunityPostMatch[],
  keywordMatches: CommunityPost[],
  options: { limit?: number; category?: string } = {},
): RankedCommunityPost[] {
  const limit = Math.max(0, Math.min(options.limit ?? 3, 3))
  const byId = new Map<string, { post: CommunityPost; embeddingSimilarity: number }>()

  keywordMatches.forEach((post) => byId.set(post.id, { post, embeddingSimilarity: 0 }))
  embeddingMatches.forEach((post) => byId.set(post.id, {
    post,
    embeddingSimilarity: Math.max(byId.get(post.id)?.embeddingSimilarity ?? 0, post.similarity),
  }))

  const ranked = [...byId.values()]
    // 지역 모임 모집 글은 커뮤니티 안에서만 노출하고 행정 팁 카드 근거로는 쓰지 않는다.
    .filter(({ post }) => !post.content.includes('[관련 업무] 지역모임'))
    .map(({ post, embeddingSimilarity }) => {
      const keywordScore = keywordRelevance(query, post.content)
      const categoryBonus = options.category && options.category !== 'ALL'
        && post.categories.includes(options.category as CommunityCategory) ? 0.04 : 0
      const helpfulBonus = Math.min(0.03, Math.log10(post.helpfulCount + 1) * 0.012)
      const hybridScore = Math.min(1,
        embeddingSimilarity * 0.65 + keywordScore * 0.35 + categoryBonus + helpfulBonus)
      return {
        ...post,
        similarity: hybridScore,
        embeddingSimilarity,
        keywordScore,
        hybridScore,
      }
    })
    .filter((post) => {
      const relevantByKeyword = post.keywordScore >= 0.28
      const relevantByEmbedding = post.embeddingSimilarity >= 0.38
        && (post.keywordScore >= 0.05 || post.embeddingSimilarity >= 0.43)
      return relevantByKeyword || relevantByEmbedding
    })
    .sort((a, b) => b.hybridScore - a.hybridScore
      || b.keywordScore - a.keywordScore
      || b.helpfulCount - a.helpfulCount)

  const selected: RankedCommunityPost[] = []
  for (const candidate of ranked) {
    if (!isNearDuplicate(candidate, selected)) selected.push(candidate)
    if (selected.length >= limit) break
  }
  return selected
}
