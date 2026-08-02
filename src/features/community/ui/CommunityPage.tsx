import { GlassIcon } from '../../../components/ui/GlassIcon'
import { Icon } from '../../../components/ui/Icon'
import { COMMUNITY_MAX_VISIBLE_PAGES, COMMUNITY_PAGE_SIZE } from '../constants/community.constants'
import { CommunityController } from '../hooks/useCommunity'
import { getVisibleCommunityPages } from '../services/community.service'
import {
  CategoryTabs, CommunityBoardRow, CommunityDisclaimer, CommunityHeader,
  CommunitySearchBar, CommunityWriteButton, navigateCommunity,
} from './CommunityCommon'

export function CommunityPage({ controller: c }: { controller: CommunityController }) {
  return <section className="cm-workspace">
    <main className="cm-main">
      <CommunityHeader/>
      <CommunitySearchBar controller={c}/>
      <CategoryTabs controller={c}/>
      <CommunityBoard controller={c}/>
      <CommunityDisclaimer/>
    </main>
    <aside className="cm-aside">
      <HelpfulReviewRanking controller={c}/>
    </aside>
  </section>
}

export function CommunityBoard({ controller: c }: { controller: CommunityController }) {
  if (c.error) return <div className="cm-empty da-glass"><GlassIcon icon="alert" tone="coral"/><h3>후기를 불러오는 중 문제가 생겼어요.</h3><p>잠시 후 다시 시도하거나 전체 게시판을 확인해주세요.</p><button onClick={() => void c.retry()}>다시 시도</button></div>
  if (!c.loading && c.pagedReviews.length === 0) return <CommunityEmptyState controller={c}/>
  return <section className="cm-board da-glass" aria-busy={c.loading}>
    <CommunityBoardHeader controller={c}/>
    <div className="cm-table-head"><span>번호</span><span>분류</span><span>제목</span><span>작성자</span><span>작성일</span><span>도움</span></div>
    <div className="cm-rows">
      {c.loading ? <div className="cm-loading">후기를 불러오고 있어요…</div> : c.pagedReviews.map((review, index) =>
        <CommunityBoardRow key={review.id} review={review} number={(c.page - 1) * COMMUNITY_PAGE_SIZE + index + 1} similarity={c.similarity(review)}/>)}
    </div>
    <footer><CommunityPagination controller={c}/><CommunityWriteButton compact/></footer>
  </section>
}

export function CommunityBoardHeader({ controller: c }: { controller: CommunityController }) {
  return <div className="cm-board-header"><div><strong>전체 후기</strong><span>{c.reviews.length}개</span></div>
    <select aria-label="후기 정렬" value={c.sort} onChange={(event) => c.setSort(event.target.value as CommunityController['sort'])}>
      <option value="LATEST">최신순</option><option value="HELPFUL">도움순</option>
    </select>
  </div>
}

export function CommunityPagination({ controller: c }: { controller: CommunityController }) {
  const pages = getVisibleCommunityPages(c.page, c.totalPages, COMMUNITY_MAX_VISIBLE_PAGES)
  return <nav className="cm-pagination" aria-label="후기 페이지">
    <button className="cm-page-move" disabled={c.page === 1} onClick={() => c.setPage(Math.max(1,c.page-1))}>
      <Icon name="chevronLeft" size={15}/> 이전 페이지
    </button>
    {pages.map((page) => <button aria-current={c.page === page ? 'page' : undefined} className={c.page === page ? 'active' : ''} onClick={() => c.setPage(page)} key={page}>{page}</button>)}
    <button className="cm-page-move" disabled={c.page === c.totalPages} onClick={() => c.setPage(Math.min(c.totalPages,c.page+1))}>
      다음 페이지 <Icon name="chevronRight" size={15}/>
    </button>
  </nav>
}

export function HelpfulReviewRanking({ controller: c }: { controller: CommunityController }) {
  return <section className="cm-ranking da-glass"><header><GlassIcon icon="heart" tone="peach"/><h2>많이 도움 된 글</h2></header>
    <ol>{c.helpfulRanking.map((review,index) => <li key={review.id}><button onClick={() => navigateCommunity(`/community/${review.id}`)}><b>{index+1}</b><span>{review.title}<small>도움 {review.helpfulCount}</small></span></button></li>)}</ol>
  </section>
}

function CommunityEmptyState({ controller: c }: { controller: CommunityController }) {
  return <div className="cm-empty da-glass"><GlassIcon icon="search" tone="blue"/><h3>조건에 맞는 후기를 아직 찾지 못했어요.</h3><p>검색 조건을 바꾸거나 내 경험을 먼저 나눌 수 있어요.</p><div><button onClick={c.reset}>검색 조건 초기화</button><button onClick={() => navigateCommunity('/community/write')}>내 경험 작성하기</button></div></div>
}
