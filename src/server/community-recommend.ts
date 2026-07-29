import { CATEGORY_LABEL } from '../schemas/community'
import { CommunityPostMatch, searchCommunityPosts } from './community-store'
import { embedQuery, generateSolarChat } from './upstage-client'

export type CommunityRecommendation = {
  answer: string
  sources: CommunityPostMatch[]
}

// 사용자 상황(query)을 임베딩 → 카테고리 필터 + 유사도 검색으로 관련 글을 찾고,
// Solar Pro 3한테 그 글들만 근거로 답을 종합해달라고 요청함. merge 후 agent_and_ui의
// COMMUNITY_REVIEW 블록이 이 함수를 호출하도록 연결하면 됨.
export async function recommendCommunityTips(query: string, category?: string, limit = 5): Promise<CommunityRecommendation> {
  const queryEmbedding = await embedQuery(query)
  const matches = await searchCommunityPosts(queryEmbedding, category, limit)

  if (matches.length === 0) {
    return { answer: '관련된 커뮤니티 경험담을 아직 찾지 못했어요.', sources: [] }
  }

  const context = matches.map((match, i) => `${i + 1}. [${CATEGORY_LABEL[match.category]}] ${match.content}`).join('\n')

  const answer = await generateSolarChat([
    {
      role: 'system',
      content:
        '너는 상속·장례 절차를 돕는 커뮤니티의 팁 큐레이터야. 아래 제공된 실제 이용자 ' +
        '경험담 목록만 근거로 삼아서, 사용자 질문에 맞는 답을 2~4문장으로 정리해줘. ' +
        '목록에 없는 내용은 지어내지 말고, 목록만으로 답하기 부족하면 그렇다고 말해.',
    },
    {
      role: 'user',
      content: `사용자 질문: ${query}\n\n관련 경험담 목록:\n${context}`,
    },
  ])

  return { answer, sources: matches }
}
