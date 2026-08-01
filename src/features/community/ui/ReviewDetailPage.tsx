import { useEffect, useMemo, useState } from 'react'
import { forgetLikedPost, hasLikedPost, rememberLikedPost } from '../../../client/community-likes'
import { GlassIcon } from '../../../components/ui/GlassIcon'
import { Icon } from '../../../components/ui/Icon'
import { CommunityReview } from '../model/community.types'
import { communityRepository } from '../services/community.service'
import { CommunityDisclaimer, ReviewCategoryBadges, navigateCommunity } from './CommunityCommon'
import { ReviewComments } from './ReviewComments'

export function ReviewDetailPage({ id }: { id: string }) {
  const [review, setReview] = useState<CommunityReview | null>()
  useEffect(() => { void communityRepository.getReview(id).then(setReview) }, [id])
  if (review === undefined) return <section className="cm-workspace cm-single"><div className="cm-empty da-glass">후기를 불러오고 있어요…</div></section>
  if (review === null) return <section className="cm-workspace cm-single"><div className="cm-empty da-glass"><h2>후기를 찾지 못했어요.</h2><button onClick={() => navigateCommunity('/community')}>게시판으로 돌아가기</button></div></section>
  return <section className="cm-workspace cm-single"><article className="cm-detail da-glass">
    <button className="cm-back" onClick={() => navigateCommunity('/community')}><Icon name="arrowLeft" size={18}/>목록으로</button>
    <div className="cm-detail-heading"><ReviewCategoryBadges categories={review.categories}/><span className="cm-experience-label">사용자 경험</span>{review.isSynthetic && <span className="cm-synthetic">해커톤 테스트용 가상 후기</span>}<h1>{review.title}</h1><div><span>{review.authorName}</span><time>{review.createdAt}</time><span><Icon name="heart" size={14}/> 도움 {review.helpfulCount}</span></div></div>
    <ReviewArticleContent review={review}/>
    <HelpfulButton review={review} onUpdate={setReview}/>
    <ReviewComments postId={review.id}/>
    <RelatedReviews current={review}/>
    <CommunityDisclaimer>이 글은 개인의 경험입니다. 상황과 기관에 따라 필요한 절차가 다를 수 있으므로 정확한 내용은 공식 기관에서 확인해주세요.</CommunityDisclaimer>
  </article></section>
}

export function ReviewArticleContent({ review }: { review: CommunityReview }) {
  const { situation, difficulty, actionTaken, preparedDocuments, usefulTip, caution } = review.body
  const hasStructuredDetail = Boolean(difficulty || actionTaken || preparedDocuments.length || usefulTip || caution)

  if (!hasStructuredDetail) {
    return <div className="cm-review-article">{situation.split('\n').filter((line) => line.trim()).map((line, index) => <p key={index}>{line}</p>)}</div>
  }

  return <div className="cm-review-article">
    <p>
      {situation} 처음에는 {difficulty} 무엇부터 확인해야 할지 정리하는 데에도 시간이 조금 필요했습니다.
    </p>
    <p>
      그래서 저는 {actionTaken} 한 번에 전부 처리하려고 하기보다는 확인한 내용을 하나씩 적어가며 진행했어요.
    </p>
    {preparedDocuments.length > 0 && <p>
      당시 준비했던 서류는 {preparedDocuments.join(', ')}였습니다. 필요한 서류가 기관마다 다를 수 있다는 이야기를 들어서,
      방문하기 전 제출할 곳에 다시 한번 확인했습니다.
    </p>}
    <p>
      직접 해보니 {usefulTip} 같은 상황을 정리하고 계신 분이라면 방문하거나 문의하기 전에 한 번 확인해보셔도 좋을 것 같아요.
    </p>
    <p className="cm-review-caution">※ {caution}</p>
  </div>
}

export function HelpfulButton({ review, onUpdate }: { review: CommunityReview; onUpdate: (review: CommunityReview) => void }) {
  const [helped,setHelped] = useState(() => hasLikedPost(review.id))
  const click = async () => {
    const next = !helped
    const result = await communityRepository.setHelpful(review.id, next)
    if (!result) return
    if (next) rememberLikedPost(review.id); else forgetLikedPost(review.id)
    setHelped(next)
    onUpdate(result)
  }
  return <button className={`cm-helpful-button ${helped ? 'active' : ''}`} onClick={click}><GlassIcon icon="heart" tone="peach"/><span>{helped ? '도움이 됐다고 표시했어요' : '도움이 됐어요'}<small>{review.helpfulCount}</small></span></button>
}

function RelatedReviews({ current }: { current: CommunityReview }) {
  const [reviews,setReviews] = useState<CommunityReview[]>([])
  const primaryCategory = current.categories[0]
  useEffect(() => { void communityRepository.getReviews({ text:'',scope:'ALL',category:primaryCategory,region:null,sort:'HELPFUL' }).then((items) => setReviews(items.filter((item) => item.id !== current.id).slice(0,3))) }, [primaryCategory,current.id])
  const list = useMemo(() => reviews, [reviews])
  return <section className="cm-related"><h2>관련 후기</h2>{list.map((review) => <button key={review.id} onClick={() => navigateCommunity(`/community/${review.id}`)}><span>{review.categories[0]}</span><strong>{review.title}</strong></button>)}</section>
}
