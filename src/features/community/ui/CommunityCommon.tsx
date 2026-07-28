import { ReactNode } from 'react'
import { GlassIcon } from '../../../components/ui/GlassIcon'
import { Icon } from '../../../components/ui/Icon'
import { COMMUNITY_CATEGORY_TABS } from '../constants/community.constants'
import { CommunityController } from '../hooks/useCommunity'
import { CommunityReview, ReviewCategory } from '../model/community.types'
import { navigateCommunity } from '../routing/community.routes'

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

export function SimilarReviewFilter({ controller: c }: { controller: CommunityController }) {
  return <div className="cm-similar da-glass">
    <div><GlassIcon icon="sparkle" tone="peach"/><span>내 상황과 비슷한 후기 5개가 있어요.</span></div>
    <div className="cm-context-tags"><i>부모님</i><i>부산</i><i>채무 확인 중</i><i>전문가 상담 준비</i></div>
    <button className={c.similarOnly ? 'active' : ''} onClick={() => c.setSimilarOnly(!c.similarOnly)}>{c.similarOnly ? '전체 후기 보기' : '맞춤 후기만 보기'}</button>
  </div>
}

export function ReviewCategoryBadge({ category }: { category: ReviewCategory }) {
  return <span className={`cm-category cm-category-${category.replace(/[·\s]/g,'')}`}>{category}</span>
}

export function SimilarityBadge() {
  return <span className="cm-similarity">내 상황과 유사</span>
}

export function CommunityDisclaimer({ children }: { children?: ReactNode }) {
  return <div className="cm-disclaimer"><Icon name="alert" size={16}/><span>{children || '후기는 개인의 경험이며, 정확한 절차는 공식 기관에서 확인해주세요.'}</span></div>
}

export { navigateCommunity }

export function CommunityBoardRow({ review, number, similarity }: { review: CommunityReview; number: number | string; similarity: number }) {
  return <button className={`cm-row ${review.isNotice ? 'notice' : ''}`} onClick={() => navigateCommunity(`/community/${review.id}`)}>
    <span className="cm-number">{review.isNotice ? '공지' : number}</span>
    <span><ReviewCategoryBadge category={review.category}/></span>
    <strong title={review.title}>{review.title}{review.commentCount > 0 && <small>[{review.commentCount}]</small>}{similarity >= 40 && !review.isNotice && <SimilarityBadge/>}</strong>
    <span>{review.authorName}</span><time>{review.createdAt.slice(5).replace('-','.')}</time>
    <span className="cm-helpful"><Icon name="heart" size={14}/>{review.helpfulCount}</span>
  </button>
}
