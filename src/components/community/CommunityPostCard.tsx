import { CATEGORY_LABEL, CommunityPost } from '../../schemas/community'
import { isMyPost } from '../../client/my-community-posts'
import { GlassIcon } from '../ui/GlassIcon'
import { Icon } from '../ui/Icon'

const CATEGORY_TONE: Record<CommunityPost['category'], string> = {
  RENOUNCE: 'coral',
  TAX: 'amber',
  TRANSFER: 'sage',
  INSURANCE: 'blue',
  SUBSCRIPTION: 'peach',
  ETC: 'blue',
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return '오늘'
  if (days < 7) return `${days}일 전`
  return `${Math.floor(days / 7)}주 전`
}

export function CommunityPostCard({ post, onEdit }: { post: CommunityPost; onEdit: (post: CommunityPost) => void }) {
  const tone = CATEGORY_TONE[post.category]
  return (
    <article className="cm-card">
      <div className="cm-card-head">
        <GlassIcon icon="users" tone={tone} />
        <div className="cm-card-meta">
          <strong>{post.nickname}</strong>
          <span>{timeAgo(post.createdAt)}</span>
        </div>
        <span className={`cm-badge cm-${tone}`}>{CATEGORY_LABEL[post.category]}</span>
        {isMyPost(post.id) && (
          <button type="button" className="cm-card-edit" onClick={() => onEdit(post)} aria-label="내 글 수정">
            <Icon name="edit" size={13} />
          </button>
        )}
      </div>
      <p className="cm-card-content">{post.content}</p>
      <footer className="cm-card-footer">
        <span><Icon name="heart" size={14} /> 도움이 됐어요 {post.helpfulCount}</span>
      </footer>
    </article>
  )
}
