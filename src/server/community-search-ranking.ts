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
  '혹시', '바로', '될까', '될까요', '돼', '됨', '할까', '할까요', '괜찮을까', '괜찮을까요',
  '할머니', '할아버지', '아버지', '어머니', '부모님', '배우자', '형제', '자녀',
  '전에', '뭘', '해', '확인', '찾아', '알려', '주세요', '싶은',
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

const cleanSearchToken = (token: string) => token
  // "해지해도", "신고해도"처럼 활용된 동사는 주제어로 되돌린다.
  .replace(/(?:해도|해도될까|해도될까요|해도돼|해도됨)$/u, '')
  .replace(/(?:될까|될까요|돼|됨|할까|할까요|인가요|인가)$/u, '')
  .replace(/(?:은|는|이|가|을|를|에|에서|으로|로|랑|과|와|도|만|부터|까지)$/u, '')

const baseSearchKeywords = (query: string) => normalize(query)
  .split(/\s+/)
  .map(cleanSearchToken)
  .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))

export function extractSearchKeywords(query: string): string[] {
  const baseTokens = baseSearchKeywords(query)
  const queryCompact = compact(query)
  const expanded = new Set(baseTokens)

  for (const group of SYNONYM_GROUPS) {
    if (group.some((term) => queryCompact.includes(compact(term)))) {
      group.forEach((term) => expanded.add(compact(term)))
    }
  }

  return [...expanded].filter((token) => token.length >= 2)
}

type ScoringUnit = { terms: string[]; weight: number }

/** 동의어 확장은 후보를 찾는 데만 쓰고, 점수는 같은 의미를 한 번만 센다. */
function buildScoringUnits(query: string): ScoringUnit[] {
  const baseKeywords = baseSearchKeywords(query)
  const usedGroups = new Set<number>()
  const units: ScoringUnit[] = []

  baseKeywords.forEach((keyword) => {
    const groupIndex = SYNONYM_GROUPS.findIndex((group) => group.some((term) => term === keyword))
    if (groupIndex >= 0) {
      if (usedGroups.has(groupIndex)) return
      usedGroups.add(groupIndex)
      const terms = SYNONYM_GROUPS[groupIndex].filter((term) => (
        // "신고"는 위조의 동의어가 아니라 여러 행정 주제에 공통으로 쓰이는 행동어다.
        !(groupIndex === 8 && term === '신고')
      ))
      units.push({ terms, weight: 1.25 })
      return
    }
    units.push({ terms: [keyword], weight: keyword.length >= 4 ? 1.25 : 1 })
  })

  return units
}

function keywordRelevance(query: string, content: string): number {
  const units = buildScoringUnits(query)
  if (units.length === 0) return 0
  const normalizedContent = compact(content)
  const title = compact(content.split(/\r?\n/, 1)[0] ?? '')
  let matchedWeight = 0
  let totalWeight = 0

  for (const unit of units) {
    totalWeight += unit.weight
    const matchedTerms = unit.terms.filter((term) => normalizedContent.includes(term))
    if (matchedTerms.length) {
      // 같은 의미군에서도 여러 표현이 실제 본문에 함께 나오면 약간 더 관련 있다고 본다.
      const matchWeight = unit.weight * (1 + Math.min(0.4, (matchedTerms.length - 1) * 0.2))
      matchedWeight += matchedTerms.some((term) => title.includes(term)) ? matchWeight * 1.15 : matchWeight
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
        embeddingSimilarity * 0.55 + keywordScore * 0.45 + categoryBonus + helpfulBonus)
      return {
        ...post,
        similarity: hybridScore,
        embeddingSimilarity,
        keywordScore,
        hybridScore,
      }
    })
    .filter((post) => {
      const relevantByKeyword = post.keywordScore >= 0.65
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
