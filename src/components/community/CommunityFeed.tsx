import { useEffect, useState } from 'react'
import { fetchCommunityPosts, submitCommunityPost } from '../../client/community-api'
import { CommunityCategory, CommunityPost, CATEGORY_LABEL, communityCategorySchema } from '../../schemas/community'
import { Icon } from '../ui/Icon'
import { CommunityComposer } from './CommunityComposer'
import { CommunityPostCard } from './CommunityPostCard'

const TABS: Array<'ALL' | CommunityCategory> = ['ALL', ...communityCategorySchema.options]

// agent_and_ui와 합칠 때: Sidebar의 '경험 나눔' 메뉴가 활성화됐을 때
// da-main 자리에 이 컴포넌트를 렌더링하면 됨. 챗 안의 COMMUNITY_REVIEW 블록은
// src/schemas/community.ts의 toCommunityReviewItem()으로 같은 데이터를 재사용 가능.
export function CommunityFeed() {
  const [category, setCategory] = useState<'ALL' | CommunityCategory>('ALL')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchCommunityPosts(category)
      .then((data) => !cancelled && setPosts(data))
      .catch(() => !cancelled && setError('글을 불러오지 못했어요.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [category])

  const handleSubmit = async (input: { nickname: string; category: CommunityCategory; content: string }) => {
    const created = await submitCommunityPost(input)
    if (category === 'ALL' || category === created.category) {
      setPosts((current) => [created, ...current])
    }
  }

  return (
    <section className="cm-feed da-glass">
      <header className="cm-feed-header">
        <p className="cm-eyebrow">경험 나눔 · COMMUNITY</p>
        <h1>다른 가족들의 이야기를 나눠요</h1>
      </header>

      <div className="cm-tabs" role="tablist" aria-label="카테고리">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={category === tab}
            className={category === tab ? 'active' : ''}
            onClick={() => setCategory(tab)}
          >
            {tab === 'ALL' ? '전체' : CATEGORY_LABEL[tab]}
          </button>
        ))}
      </div>

      <div className="cm-list">
        {loading && <p className="cm-empty">불러오는 중이에요...</p>}
        {!loading && error && <p className="cm-empty">{error}</p>}
        {!loading && !error && posts.length === 0 && (
          <p className="cm-empty">아직 이 카테고리에 글이 없어요. 첫 경험을 나눠주세요.</p>
        )}
        {!loading && !error && posts.map((post) => <CommunityPostCard key={post.id} post={post} />)}
      </div>

      <CommunityComposer onSubmit={handleSubmit} />

      <p className="cm-disclaimer">
        <Icon name="heart" size={13} /> 이 공간의 글은 개인의 경험이며 공식 안내나 법률 자문이 아니에요.
      </p>
    </section>
  )
}
