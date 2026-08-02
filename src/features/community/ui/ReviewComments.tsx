import { FormEvent, useEffect, useMemo, useState } from 'react'
import { fetchCommunityComments, submitCommunityComment } from '../../../client/community-api'
import { GlassIcon } from '../../../components/ui/GlassIcon'
import { CommunityComment } from '../../../schemas/community'
import { toKstDate } from '../services/community.format'

export function ReviewComments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<CommunityComment[]>([])
  const [loading, setLoading] = useState(true)
  const [replyTo, setReplyTo] = useState<string | null>(null)

  const load = () => {
    void fetchCommunityComments(postId)
      .then(setComments)
      .catch((error) => {
        console.error(
          '댓글을 불러오지 못했어요:',
          error,
        )
      })
      .finally(() => {
        setLoading(false)
      })
  }
  useEffect(() => { setLoading(true); load() }, [postId])

  const topLevel = useMemo(() => comments.filter((comment) => !comment.parentId), [comments])
  const repliesOf = (parentId: string) => comments.filter((comment) => comment.parentId === parentId)

  const submit = async (nickname: string, content: string, parentId: string | null) => {
    if (!nickname.trim() || !content.trim()) return
    await submitCommunityComment(postId, { nickname: nickname.trim(), content: content.trim(), parentId })
    setReplyTo(null)
    load()
  }

  return <section className="cm-comments da-glass">
    <header><GlassIcon icon="edit" tone="blue"/><h2>댓글 {comments.length > 0 && <small>{comments.length}</small>}</h2></header>
    {loading ? <p className="cm-comments-loading">댓글을 불러오고 있어요…</p> : topLevel.length === 0
      ? <p className="cm-comments-empty">아직 댓글이 없어요. 첫 댓글을 남겨보세요.</p>
      : <ul className="cm-comment-list">
        {topLevel.map((comment) => <li key={comment.id} className="cm-comment">
          <CommentBody comment={comment}/>
          <button className="cm-comment-reply-toggle" onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}>답글쓰기</button>
          {replyTo === comment.id && <CommentForm compact onSubmit={(nickname, content) => submit(nickname, content, comment.id)}/>}
          {repliesOf(comment.id).length > 0 && <ul className="cm-comment-replies">
            {repliesOf(comment.id).map((reply) => <li key={reply.id} className="cm-comment cm-comment-reply"><CommentBody comment={reply}/></li>)}
          </ul>}
        </li>)}
      </ul>}
    <CommentForm onSubmit={(nickname, content) => submit(nickname, content, null)}/>
  </section>
}

function CommentBody({ comment }: { comment: CommunityComment }) {
  return <div className="cm-comment-body">
    <div className="cm-comment-meta"><strong>{comment.nickname}</strong><time>{toKstDate(comment.createdAt)}</time></div>
    <p>{comment.content}</p>
  </div>
}

function CommentForm({ onSubmit, compact = false }: { onSubmit: (nickname: string, content: string) => void; compact?: boolean }) {
  const [nickname, setNickname] = useState('')
  const [content, setContent] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit(nickname, content)
    setNickname('')
    setContent('')
  }
  return <form className={`cm-comment-form ${compact ? 'compact' : ''}`} onSubmit={submit}>
    <input aria-label="닉네임" placeholder="닉네임" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={20}/>
    <textarea aria-label="댓글 내용" placeholder={compact ? '답글을 남겨보세요' : '댓글을 남겨보세요'} value={content} onChange={(event) => setContent(event.target.value)}/>
    <button type="submit" disabled={!nickname.trim() || !content.trim()}>등록</button>
  </form>
}
