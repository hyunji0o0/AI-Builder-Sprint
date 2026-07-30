import { CommunityReviewBlockItem } from '../schemas/community'

// AgentTestWidget 전용 클라이언트 헬퍼. merge 후 agent_and_ui의 CaseTools
// 배선이 끝나면 이 파일과 /api/community/agent-test 라우트는 지워도 됨.
export async function askCommunityAgent(query: string): Promise<CommunityReviewBlockItem[]> {
  const res = await fetch('/api/community/agent-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? '답변을 가져오지 못했어요.')
  return data as CommunityReviewBlockItem[]
}
