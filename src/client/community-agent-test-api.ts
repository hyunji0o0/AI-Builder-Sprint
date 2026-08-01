import { CommunityReviewBlockItem } from '../schemas/community'

// AgentTestWidget 전용 클라이언트 헬퍼. 실제 추천 엔진(/api/community/recommend,
// community-recommend.ts + community-prompt.ts)을 format: 'block'으로 호출해서
// COMMUNITY_REVIEW 블록 모양 그대로 받아옴 — merge 후 메인챗이 쓰는 것과 동일한 경로.
export async function askCommunityAgent(query: string): Promise<CommunityReviewBlockItem[]> {
  const res = await fetch('/api/community/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ situation: query, limit: 3, format: 'block' }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? '답변을 가져오지 못했어요.')
  return (data.reviews ?? []) as CommunityReviewBlockItem[]
}
