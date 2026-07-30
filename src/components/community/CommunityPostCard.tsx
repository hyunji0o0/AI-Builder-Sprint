import { useState } from 'react'
import { CATEGORY_LABEL, CommunityCategory, CommunityPost } from '../../schemas/community'
import { isMyPost } from '../../client/my-community-posts'
import { forgetLikedPost, hasLikedPost, rememberLikedPost } from '../../client/community-likes'
import { GlassIcon } from '../ui/GlassIcon'
import { Icon } from '../ui/Icon'
import { CommunityComments } from './CommunityComments'

const CATEGORY_TONE: Record<CommunityCategory, string> = {
  RENOUNCE: 'coral',
  TAX: 'amber',
  TRANSFER: 'sage',
  INSURANCE: 'blue',
  SUBSCRIPTION: 'peach',
  VENT: 'lavender',
  ETC: 'blue',
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return '오늘'
  if (days < 7) return `${days}일 전`
  return `${Math.floor(days / 7)}주 전`
}

export function CommunityPostCard({
  post,
  onEdit,
  onHelpful,
}: {
  post: CommunityPost
  onEdit: (post: CommunityPost) => void
  onHelpful: (id: string, liked: boolean) => void
}) {
  // 아이콘 톤은 대표(첫 번째) 카테고리 기준, 뱃지는 달린 카테고리 전부 보여줌.
  const tone = CATEGORY_TONE[post.categories[0]] ?? 'blue'
  const [liked, setLiked] = useState(() => hasLikedPost(post.id))

  const handleHelpful = () => {
    const next = !liked
    setLiked(next)
    if (next) rememberLikedPost(post.id)
    else forgetLikedPost(post.id)
    onHelpful(post.id, next)
  }

  return (
    <article className="cm-card">
      <div className="cm-card-head">
        <GlassIcon icon="users" tone={tone} />
        <div className="cm-card-meta">
          <strong>{post.nickname}</strong>
          <span>{timeAgo(post.createdAt)}</span>
        </div>
        <span className="cm-badges">
          {post.categories.map((category) => (
            <span key={category} className={`cm-badge cm-${CATEGORY_TONE[category] ?? 'blue'}`}>
              {CATEGORY_LABEL[category]}
            </span>
          ))}
        </span>
        {isMyPost(post.id) && (
          <button type="button" className="cm-card-edit" onClick={() => onEdit(post)} aria-label="내 글 수정">
            <Icon name="edit" size={13} />
          </button>
        )}
      </div>
      <p className="cm-card-content">{post.content}</p>
      <footer className="cm-card-footer">
        <button
          type="button"
          className={`cm-helpful-button${liked ? ' liked' : ''}`}
          onClick={handleHelpful}
          aria-pressed={liked}
          aria-label={liked ? `도움이 됐어요 취소 (현재 ${post.helpfulCount}명)` : `도움이 됐어요 (현재 ${post.helpfulCount}명)`}
        >
          <Icon name="heart" size={14} /> 도움이 됐어요 {post.helpfulCount}
        </button>
      </footer>
      <CommunityComments postId={post.id} />
    </article>
  )
}
