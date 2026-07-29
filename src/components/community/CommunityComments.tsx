import { FormEvent, useEffect, useState } from 'react'
import { fetchCommunityComments, submitCommunityComment } from '../../client/community-api'
import { CommunityComment } from '../../schemas/community'
import { Icon } from '../ui/Icon'

const PREVIEW_COUNT = 1
const MAX_CONTENT_LENGTH = 300

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return '오늘'
  if (days < 7) return `${days}일 전`
  return `${Math.floor(days / 7)}주 전`
}

function MiniCommentForm({
  placeholder,
  submitting,
  onSubmit,
}: {
  placeholder: string
  submitting: boolean
  onSubmit: (nickname: string, content: string) => Promise<void>
}) {
  const [nickname, setNickname] = useState('')
  const [content, setContent] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!nickname.trim() || !content.trim() || submitting) return
    await onSubmit(nickname.trim(), content.trim())
    setContent('')
  }

  return (
    <form className="cm-comment-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        placeholder="닉네임"
        className="cm-comment-nickname"
        maxLength={20}
      />
      <input
        type="text"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={placeholder}
        className="cm-comment-input"
        maxLength={MAX_CONTENT_LENGTH}
      />
      <button type="submit" className="cm-comment-submit" disabled={submitting} aria-label="등록">
        <Icon name="send" size={13} />
      </button>
    </form>
  )
}

export function CommunityComments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [replyTarget, setReplyTarget] = useState<string | null>(null)
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCommunityComments(postId)
      .then((data) => !cancelled && setComments(data))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [postId])

  const topLevel = comments.filter((comment) => !comment.parentId)
  const repliesOf = (id: string) => comments.filter((comment) => comment.parentId === id)

  const visibleTopLevel = expanded ? topLevel : topLevel.slice(0, PREVIEW_COUNT)
  const hiddenCount = topLevel.length - visibleTopLevel.length

  const handleNewComment = async (nickname: string, content: string) => {
    setSubmitting(true)
    setError(null)
    try {
      const created = await submitCommunityComment(postId, { nickname, content, parentId: null })
      setComments((current) => [...current, created])
      setExpanded(true)
    } catch {
      setError('댓글을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReply = async (parentId: string, nickname: string, content: string) => {
    setReplySubmitting(true)
    setError(null)
    try {
      const created = await submitCommunityComment(postId, { nickname, content, parentId })
      setComments((current) => [...current, created])
      setReplyTarget(null)
      setExpandedReplies((current) => ({ ...current, [parentId]: true }))
    } catch {
      setError('답글을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setReplySubmitting(false)
    }
  }

  return (
    <div className="cm-comments">
      {!loading && visibleTopLevel.length > 0 && (
        <ul className="cm-comment-list">
          {visibleTopLevel.map((comment) => {
            const replies = repliesOf(comment.id)
            const repliesExpanded = expandedReplies[comment.id] ?? false
            const visibleReplies = repliesExpanded ? replies : replies.slice(0, PREVIEW_COUNT)
            const hiddenReplyCount = replies.length - visibleReplies.length

            return (
              <li key={comment.id} className="cm-comment">
                <div className="cm-comment-body">
                  <div className="cm-comment-head">
                    <strong>{comment.nickname}</strong>
                    <span>{timeAgo(comment.createdAt)}</span>
                  </div>
                  <p>{comment.content}</p>
                  <button
                    type="button"
                    className="cm-reply-toggle"
                    onClick={() => setReplyTarget(replyTarget === comment.id ? null : comment.id)}
                  >
                    {replyTarget === comment.id ? '답글 취소' : '답글 달기'}
                  </button>
                </div>

                {visibleReplies.length > 0 && (
                  <ul className="cm-reply-list">
                    {visibleReplies.map((reply) => (
                      <li key={reply.id} className="cm-reply">
                        <div className="cm-comment-head">
                          <strong>{reply.nickname}</strong>
                          <span>{timeAgo(reply.createdAt)}</span>
                        </div>
                        <p>{reply.content}</p>
                      </li>
                    ))}
                  </ul>
                )}

                {!repliesExpanded && hiddenReplyCount > 0 && (
                  <button
                    type="button"
                    className="cm-reply-more"
                    onClick={() => setExpandedReplies((current) => ({ ...current, [comment.id]: true }))}
                  >
                    답글 {hiddenReplyCount}개 더 보기
                  </button>
                )}

                {replyTarget === comment.id && (
                  <div className="cm-reply-form">
                    <MiniCommentForm
                      placeholder="답글을 남겨주세요"
                      submitting={replySubmitting}
                      onSubmit={(nickname, content) => handleReply(comment.id, nickname, content)}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!expanded && hiddenCount > 0 && (
        <button type="button" className="cm-comment-more" onClick={() => setExpanded(true)}>
          댓글 {hiddenCount}개 더 보기
        </button>
      )}

      <MiniCommentForm placeholder="댓글을 남겨주세요" submitting={submitting} onSubmit={handleNewComment} />
      {error && <p className="cm-comment-error">{error}</p>}
    </div>
  )
}
