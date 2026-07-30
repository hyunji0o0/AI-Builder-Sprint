import { FormEvent, useState } from 'react'
import { CATEGORY_LABEL, CommunityCategory, CommunityPost, communityCategorySchema } from '../../schemas/community'
import { Icon } from '../ui/Icon'

type SubmitInput = { nickname: string; categories: CommunityCategory[]; content: string }

const MAX_CONTENT_LENGTH = 500

// 회원가입 붙기 전까지는 닉네임을 직접 입력받는 스텁.
// 나중에 로그인 붙이면 nickname state를 로그인 유저 정보로 대체하면 됨 (스키마 변경 없음).
export function CommunityComposer({
  initialPost,
  onSubmit,
  onCancel,
}: {
  initialPost?: CommunityPost | null
  onSubmit: (input: SubmitInput) => Promise<void>
  onCancel: () => void
}) {
  const isEditing = Boolean(initialPost)
  const [nickname, setNickname] = useState(initialPost?.nickname ?? '')
  // 글 하나에 카테고리를 여러 개 달 수 있음(DB categories text[]). 최소 1개는 필요.
  const [categories, setCategories] = useState<CommunityCategory[]>(
    initialPost?.categories ?? [communityCategorySchema.options[0]],
  )
  const [content, setContent] = useState(initialPost?.content ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCategory = (category: CommunityCategory) => {
    setCategories((current) =>
      current.includes(category)
        ? current.length > 1
          ? current.filter((item) => item !== category)
          : current // 마지막 하나는 해제 불가
        : [...current, category],
    )
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!nickname.trim() || !content.trim() || !categories.length || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ nickname: nickname.trim(), categories, content: content.trim() })
    } catch {
      setError(isEditing ? '글을 수정하지 못했어요. 잠시 후 다시 시도해 주세요.' : '글을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.')
      setSubmitting(false)
    }
  }

  return (
    <form className="cm-composer cm-composer-board" onSubmit={handleSubmit}>
      <div className="cm-composer-categories">
        {communityCategorySchema.options.map((cat) => (
          <button
            key={cat}
            type="button"
            aria-pressed={categories.includes(cat)}
            className={categories.includes(cat) ? 'active' : ''}
            onClick={() => toggleCategory(cat)}
          >
            {CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>
      <span className="cm-composer-hint">카테고리는 여러 개 고를 수 있어요.</span>

      <div className="cm-composer-nickname-row">
        <span className="cm-composer-avatar"><Icon name="sparkle" size={16} /></span>
        {isEditing ? (
          <span className="cm-composer-nickname-static">{nickname}</span>
        ) : (
          <input
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="닉네임"
            className="cm-composer-nickname"
            maxLength={20}
          />
        )}
      </div>

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="오늘 겪은 일, 도움이 됐던 팁을 나눠주세요"
        className="cm-composer-textarea"
        maxLength={MAX_CONTENT_LENGTH}
        rows={5}
      />
      <span className={`cm-composer-counter${content.length >= MAX_CONTENT_LENGTH ? ' limit' : ''}`}>
        {content.length}/{MAX_CONTENT_LENGTH}
      </span>

      {error && <p className="cm-composer-error">{error}</p>}

      <div className="cm-composer-actions">
        <button type="button" className="cm-composer-cancel" onClick={onCancel} disabled={submitting}>
          취소
        </button>
        <button type="submit" className="cm-composer-submit" disabled={submitting}>
          <Icon name="send" size={15} /> {isEditing ? '수정 완료' : '글 등록'}
        </button>
      </div>
    </form>
  )
}
