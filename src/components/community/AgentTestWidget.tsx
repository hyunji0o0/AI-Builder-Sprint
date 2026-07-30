import { FormEvent, useState } from 'react'
import { askCommunityAgent } from '../../client/community-agent-test-api'
import { fetchCommunityPost } from '../../client/community-api'
import { CommunityPost, CommunityReviewBlockItem } from '../../schemas/community'
import { Icon } from '../ui/Icon'

type Turn = {
  id: string
  query: string
  status: 'loading' | 'done' | 'error'
  cards?: CommunityReviewBlockItem[]
  error?: string
}

type DetailState = CommunityPost | 'loading' | 'error'

// 메인챗 에이전트가 아직 없어서(agent_and_ui merge 전), searchCommunityReviewsForAgent()를
// 화면에서 직접 눌러보며 테스트할 수 있게 만든 임시 위젯 — 여러 사이트에 흔한
// 우측 하단 동그란 챗 버블 패턴. merge 후에는 실제 메인챗이 이 자리를 대신하니
// 이 컴포넌트와 /api/community/agent-test 라우트는 지워도 됨(§CLAUDE.md 다음 할 일).
export function AgentTestWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [expanded, setExpanded] = useState<Record<string, DetailState>>({})

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const query = input.trim()
    if (!query || submitting) return
    const turnId = `${Date.now()}`
    setTurns((current) => [...current, { id: turnId, query, status: 'loading' }])
    setInput('')
    setSubmitting(true)
    try {
      const cards = await askCommunityAgent(query)
      setTurns((current) => current.map((turn) => (turn.id === turnId ? { ...turn, status: 'done', cards } : turn)))
    } catch {
      setTurns((current) =>
        current.map((turn) => (turn.id === turnId ? { ...turn, status: 'error', error: '답변을 가져오지 못했어요.' } : turn)),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleExpand = async (id: string) => {
    const current = expanded[id]
    if (current && current !== 'loading' && current !== 'error') {
      setExpanded((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }
    setExpanded((prev) => ({ ...prev, [id]: 'loading' }))
    try {
      const post = await fetchCommunityPost(id)
      setExpanded((prev) => ({ ...prev, [id]: post }))
    } catch {
      setExpanded((prev) => ({ ...prev, [id]: 'error' }))
    }
  }

  return (
    <div className="cm-agent-widget">
      {open && (
        <div className="cm-agent-panel da-glass">
          <header className="cm-agent-panel-head">
            <strong>AI에게 물어보기 (테스트)</strong>
            <button type="button" className="cm-agent-close" onClick={() => setOpen(false)} aria-label="닫기">
              <Icon name="close" size={13} />
            </button>
          </header>

          <div className="cm-agent-messages">
            {turns.length === 0 && (
              <p className="cm-agent-empty">
                지금 겪고 있는 상황을 편하게 적어보세요.
                <br />
                예: "채무가 자산보다 많을 수도 있어서 상속포기를 고민 중이에요"
              </p>
            )}
            {turns.map((turn) => (
              <div key={turn.id} className="cm-agent-turn">
                <p className="cm-agent-query">{turn.query}</p>
                {turn.status === 'loading' && <p className="cm-agent-status">관련 경험담을 찾는 중이에요...</p>}
                {turn.status === 'error' && <p className="cm-agent-status error">{turn.error}</p>}
                {turn.status === 'done' && turn.cards?.length === 0 && (
                  <p className="cm-agent-status">관련된 경험담을 찾지 못했어요.</p>
                )}
                {turn.status === 'done' && turn.cards && turn.cards.length > 0 && (
                  <div className="cm-agent-cards">
                    {turn.cards.map((card) => {
                      const detail = expanded[card.id]
                      const detailPost = detail && detail !== 'loading' && detail !== 'error' ? detail : null
                      return (
                        <div key={card.id} className="cm-agent-card">
                          <p className="cm-agent-card-excerpt">{card.excerpt}</p>
                          <p className="cm-agent-card-reason">{card.reason}</p>
                          <div className="cm-agent-card-footer">
                            <span>
                              <Icon name="heart" size={11} /> {card.helpfulCount}
                            </span>
                            <button type="button" onClick={() => handleExpand(card.id)}>
                              {detailPost ? '접기' : '더 자세히 보기'}
                            </button>
                          </div>
                          {detail === 'loading' && <p className="cm-agent-status">불러오는 중...</p>}
                          {detail === 'error' && <p className="cm-agent-status error">원글을 불러오지 못했어요.</p>}
                          {detailPost && (
                            <div className="cm-agent-detail">
                              <strong>{detailPost.nickname}</strong>
                              <p>{detailPost.content}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form className="cm-agent-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="상황을 적어보세요"
              className="cm-agent-input"
            />
            <button type="submit" className="cm-agent-send" disabled={submitting} aria-label="전송">
              <Icon name="send" size={14} />
            </button>
          </form>
        </div>
      )}

      <button type="button" className="cm-agent-bubble" onClick={() => setOpen((value) => !value)} aria-label="AI에게 물어보기">
        <Icon name="sparkle" size={20} />
      </button>
    </div>
  )
}
