import { ReactNode, useEffect, useState } from 'react'
import { fetchCommunityComments } from '../../../client/community-api'
import { GlassIcon } from '../../../components/ui/GlassIcon'
import { Icon } from '../../../components/ui/Icon'
import { COMMUNITY_CATEGORY_TABS } from '../constants/community.constants'
import { CommunityController } from '../hooks/useCommunity'
import { CommunityReview, ReviewCategory } from '../model/community.types'
import { navigateCommunity } from '../routing/community.routes'
import { toKstDate } from '../services/community.format'

export function CommunityHeader() {
  return <header className="cm-header"><div><span>COMMUNITY</span><h1>경험 나눔 게시판</h1><p>먼저 겪은 사람들의 경험과 실제 도움이 된 팁을 나눠보세요.</p></div></header>
}

export function CommunityWriteButton({ compact = false }: { compact?: boolean }) {
  return <button className={`cm-write-button ${compact ? 'compact' : ''}`} onClick={() => navigateCommunity('/community/write')}><GlassIcon icon="edit" tone="peach"/><span>글쓰기</span></button>
}

export function CommunitySearchBar({ controller: c }: { controller: CommunityController }) {
  return <div className="cm-search da-glass">
    <label><Icon name="search"/><input aria-label="후기 검색" placeholder="제목, 내용, 지역, 업무로 검색" value={c.searchText} onChange={(event) => c.setSearchText(event.target.value)}/></label>
    <select aria-label="검색 범위" value={c.searchScope} onChange={(event) => c.setSearchScope(event.target.value as CommunityController['searchScope'])}>
      <option value="ALL">전체</option><option value="TITLE">제목</option><option value="CONTENT">내용</option><option value="AUTHOR">작성자</option>
    </select>
    <CommunityWriteButton compact/>
  </div>
}

export function CategoryTabs({ controller: c }: { controller: CommunityController }) {
  return <div className="cm-categories" role="tablist" aria-label="후기 카테고리">
    {COMMUNITY_CATEGORY_TABS.map((item) => <button role="tab" aria-selected={c.category === item} className={c.category === item ? 'active' : ''} onClick={() => c.setCategory(item)} key={item}>{item}</button>)}
  </div>
}

export function ReviewCategoryBadge({ category }: { category: ReviewCategory }) {
  return <span className={`cm-category cm-category-${category.replace(/[·\s]/g,'')}`}>{category}</span>
}

export function ReviewCategoryBadges({ categories, max }: { categories: ReviewCategory[]; max?: number }) {
  const visible = max ? categories.slice(0, max) : categories
  const hidden = categories.length - visible.length
  return <span className="cm-category-list">
    {visible.map((category) => <ReviewCategoryBadge category={category} key={category}/>)}
    {hidden > 0 && <span className="cm-category cm-category-more">+{hidden}</span>}
  </span>
}

export function CommunityDisclaimer({ children }: { children?: ReactNode }) {
  return <div className="cm-disclaimer"><Icon name="alert" size={16}/><span>{children || '후기는 개인의 경험이며, 정확한 절차는 공식 기관에서 확인해주세요.'}</span></div>
}

export { navigateCommunity }

export function CommunityBoardRow({ review, number, similarity }: { review: CommunityReview; number: number | string; similarity: number }) {
  const [commentCount, setCommentCount] = useState(review.commentCount)
  useEffect(() => { void fetchCommunityComments(review.id).then((comments) => setCommentCount(comments.length)).catch(() => {}) }, [review.id])
  return <button className={`cm-row ${review.isNotice ? 'notice' : ''}`} onClick={() => navigateCommunity(`/community/${review.id}`)}>
    <span className="cm-number">{review.isNotice ? '공지' : number}</span>
    <span><ReviewCategoryBadges categories={review.categories} max={2}/></span>
    <strong title={review.title}>{review.title}{commentCount > 0 && <small>[{commentCount}]</small>}</strong>
    <span>{review.authorName}</span><time>{toKstDate(review.createdAt).slice(5).replace('-','.')}</time>
    <span className="cm-helpful"><Icon name="heart" size={14}/>{review.helpfulCount}</span>
  </button>
}
