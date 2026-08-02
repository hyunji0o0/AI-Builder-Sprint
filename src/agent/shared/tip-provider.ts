/**
 * 커뮤니티 경험담을 팁 카드로 돌려주는 외부 의존성의 경계.
 *
 * 대화 Agent가 커뮤니티 구현(Supabase·임베딩 검색·Solar 요약)을 직접 import하지 않게
 * 인터페이스만 두고, 실제 구현은 서버(vite-agent-plugin)에서 주입한다.
 * 이렇게 해야 대화 Agent가 사건 Agent나 문서 파이프라인과 얽히지 않는다는 경계가 유지되고,
 * 테스트에서는 가짜 구현을 넣어 네트워크 없이 검증할 수 있다.
 */

/** agent-output.ts의 COMMUNITY_REVIEW 블록이 기대하는 카드 한 장. */
export type AgentTipCard = {
  id: string
  excerpt: string
  reason: string
  createdAt: string
  helpfulCount: number
  url: string | null
  label: '사용자 경험'
}

export type TipQuery = {
  /** 사용자가 방금 물어본 내용. 그대로 검색어로 쓴다. */
  situation: string
  limit: number
}

export interface TipProvider {
  search(query: TipQuery): Promise<AgentTipCard[]>
}
