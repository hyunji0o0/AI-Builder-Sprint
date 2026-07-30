import { FormEvent, useEffect, useState } from 'react'
import { fetchCommunityPosts, setCommunityPostHelpful, submitCommunityPost, updateCommunityPost } from '../../client/community-api'
import { getMyPostIds, rememberMyPost } from '../../client/my-community-posts'
import { CommunityCategory, CommunityPost, CATEGORY_LABEL, communityCategorySchema } from '../../schemas/community'
import { Icon } from '../ui/Icon'
import { CommunityComposer } from './CommunityComposer'
import { CommunityPostCard } from './CommunityPostCard'

const EXPERIENCE_CATEGORIES = communityCategorySchema.options.filter((cat) => cat !== 'VENT')
const TOP_TABS = ['ALL', 'EXPERIENCE', 'VENT'] as const
type TopTab = (typeof TOP_TABS)[number]
const TOP_TAB_LABEL: Record<TopTab, string> = { ALL: '전체', EXPERIENCE: '경험 나눔', VENT: CATEGORY_LABEL.VENT }

// agent_and_ui와 합칠 때: Sidebar의 '경험 나눔' 메뉴가 활성화됐을 때
// da-main 자리에 이 컴포넌트를 렌더링하면 됨. 챗 안의 COMMUNITY_REVIEW 블록은
// src/schemas/community.ts의 toCommunityReviewItem()으로 같은 데이터를 재사용 가능.
export function CommunityFeed() {
  const [view, setView] = useState<'list' | 'write'>('list')
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null)
  const [topCategory, setTopCategory] = useState<TopTab>('ALL')
  const [subCategory, setSubCategory] = useState<'ALL' | CommunityCategory>('ALL')
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState<'recent' | 'helpful'>('recent')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // "경험 나눔" + 하위 탭 "전체"는 VENT를 뺀 6개 카테고리 전부 — 서버엔 그런 단일
  // 카테고리가 없으니 ALL로 받아온 뒤 클라이언트에서 VENT만 걸러냄.
  const excludeVent = topCategory === 'EXPERIENCE' && subCategory === 'ALL'
  const fetchCategory =
    topCategory === 'VENT' ? 'VENT' : topCategory === 'EXPERIENCE' && subCategory !== 'ALL' ? subCategory : 'ALL'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchCommunityPosts(scope === 'mine' ? 'ALL' : fetchCategory, keyword, sort)
      .then((data) => {
        if (cancelled) return
        let next = data
        if (scope === 'mine') next = next.filter((post) => getMyPostIds().includes(post.id))
        else if (excludeVent) next = next.filter((post) => post.category !== 'VENT')
        setPosts(next)
      })
      .catch(() => !cancelled && setError('글을 불러오지 못했어요.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [fetchCategory, excludeVent, scope, keyword, sort])

  const handleTopTabClick = (tab: TopTab) => {
    setTopCategory(tab)
    setSubCategory('ALL')
  }

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault()
    setKeyword(searchInput)
  }

  const handleSearchClear = () => {
    setSearchInput('')
    setKeyword('')
  }

  const handleSubmit = async (input: { nickname: string; category: CommunityCategory; content: string }) => {
    if (editingPost) {
      const updated = await updateCommunityPost(editingPost.id, { category: input.category, content: input.content })
      setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)))
      setEditingPost(null)
      setView('list')
      return
    }
    const created = await submitCommunityPost(input)
    rememberMyPost(created.id)
    const matchesCurrentView =
      fetchCategory === 'ALL' ? !excludeVent || created.category !== 'VENT' : fetchCategory === created.category
    if (scope === 'mine' || matchesCurrentView) {
      setPosts((current) => [created, ...current])
    }
    setView('list')
  }

  const handleHelpful = async (id: string, liked: boolean) => {
    try {
      const updated = await setCommunityPostHelpful(id, liked)
      setPosts((current) => current.map((post) => (post.id === updated.id ? updated : post)))
    } catch {
      // 반응 실패는 조용히 무시 — 다음 글 목록 새로고침 때 실제 값으로 맞춰짐.
    }
  }

  const handleEdit = (post: CommunityPost) => {
    setEditingPost(post)
    setView('write')
  }

  const handleCancel = () => {
    setEditingPost(null)
    setView('list')
  }

  return (
    <section className="cm-feed da-glass">
      <header className="cm-feed-header">
        <div>
          <p className="cm-eyebrow">경험 나눔 · COMMUNITY</p>
          <h1>{scope === 'mine' ? '내가 쓴 글' : '다른 가족들의 이야기를 나눠요'}</h1>
        </div>
        {view === 'list' && (
          <div className="cm-header-actions">
            <button
              type="button"
              className={`cm-mine-toggle${scope === 'mine' ? ' active' : ''}`}
              onClick={() => setScope(scope === 'mine' ? 'all' : 'mine')}
            >
              <Icon name="person" size={14} /> {scope === 'mine' ? '전체 글 보기' : '내가 쓴 글'}
            </button>
            <button
              type="button"
              className="cm-write-button"
              onClick={() => {
                setEditingPost(null)
                setView('write')
              }}
            >
              <Icon name="edit" size={14} /> 글쓰기
            </button>
          </div>
        )}
      </header>

      {view === 'write' ? (
        <CommunityComposer initialPost={editingPost} onSubmit={handleSubmit} onCancel={handleCancel} />
      ) : (
        <>
          <form className="cm-search" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="키워드로 검색 (예: 상속세, 안심상속)"
              className="cm-search-input"
            />
            {keyword && (
              <button type="button" className="cm-search-clear" onClick={handleSearchClear}>
                지우기
              </button>
            )}
            <button type="submit" className="cm-search-submit" aria-label="검색">
              <Icon name="send" size={14} />
            </button>
          </form>

          {scope === 'all' && (
            <>
              <div className="cm-tabs-row">
                <div className="cm-tabs" role="tablist" aria-label="카테고리">
                  {TOP_TABS.map((tab) => (
                    <button
                      key={tab}
                      role="tab"
                      aria-selected={topCategory === tab}
                      className={topCategory === tab ? 'active' : ''}
                      onClick={() => handleTopTabClick(tab)}
                    >
                      {TOP_TAB_LABEL[tab]}
                    </button>
                  ))}
                </div>

                <div className="cm-sort" role="group" aria-label="정렬">
                  <button type="button" className={sort === 'recent' ? 'active' : ''} onClick={() => setSort('recent')}>
                    최신순
                  </button>
                  <button type="button" className={sort === 'helpful' ? 'active' : ''} onClick={() => setSort('helpful')}>
                    좋아요순
                  </button>
                </div>
              </div>

              {topCategory === 'EXPERIENCE' && (
                <div className="cm-tabs cm-subtabs" role="tablist" aria-label="경험 나눔 세부 카테고리">
                  <button
                    role="tab"
                    aria-selected={subCategory === 'ALL'}
                    className={subCategory === 'ALL' ? 'active' : ''}
                    onClick={() => setSubCategory('ALL')}
                  >
                    전체
                  </button>
                  {EXPERIENCE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      role="tab"
                      aria-selected={subCategory === cat}
                      className={subCategory === cat ? 'active' : ''}
                      onClick={() => setSubCategory(cat)}
                    >
                      {CATEGORY_LABEL[cat]}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="cm-list">
            {loading && <p className="cm-empty">불러오는 중이에요...</p>}
            {!loading && error && <p className="cm-empty">{error}</p>}
            {!loading && !error && posts.length === 0 && (
              <p className="cm-empty">
                {keyword
                  ? `"${keyword}"에 대한 검색 결과가 없어요.`
                  : scope === 'mine'
                    ? '아직 쓴 글이 없어요. 글쓰기로 첫 경험을 남겨보세요.'
                    : '아직 이 카테고리에 글이 없어요. 첫 경험을 나눠주세요.'}
              </p>
            )}
            {!loading && !error && posts.map((post) => (
              <CommunityPostCard key={post.id} post={post} onEdit={handleEdit} onHelpful={handleHelpful} />
            ))}
          </div>
        </>
      )}

      <p className="cm-disclaimer">
        <Icon name="heart" size={13} /> 이 공간의 글은 개인의 경험이며 공식 안내나 법률 자문이 아니에요.
      </p>
    </section>
  )
}
