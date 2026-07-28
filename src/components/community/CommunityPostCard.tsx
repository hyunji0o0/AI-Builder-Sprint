import { CATEGORY_LABEL, CommunityPost } from '../../schemas/community'
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

export function CommunityPostCard({ post }: { post: CommunityPost }) {
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
      </div>
      <p className="cm-card-content">{post.content}</p>
      <footer className="cm-card-footer">
        <span><Icon name="heart" size={14} /> 도움이 됐어요 {post.helpfulCount}</span>
      </footer>
    </article>
  )
}
