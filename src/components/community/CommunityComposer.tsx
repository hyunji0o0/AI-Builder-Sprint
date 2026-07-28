import { FormEvent, useState } from 'react'
import { CATEGORY_LABEL, CommunityCategory, communityCategorySchema } from '../../schemas/community'
import { Icon } from '../ui/Icon'

type SubmitInput = { nickname: string; category: CommunityCategory; content: string }

// 회원가입 붙기 전까지는 닉네임을 직접 입력받는 스텁.
// 나중에 로그인 붙이면 nickname state를 로그인 유저 정보로 대체하면 됨 (스키마 변경 없음).
export function CommunityComposer({ onSubmit }: { onSubmit: (input: SubmitInput) => Promise<void> }) {
  const [nickname, setNickname] = useState('')
  const [category, setCategory] = useState<CommunityCategory>(communityCategorySchema.options[0])
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!nickname.trim() || !content.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({ nickname: nickname.trim(), category, content: content.trim() })
      setContent('')
    } catch {
      setError('글을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="cm-composer" onSubmit={handleSubmit}>
      <div className="cm-composer-categories">
        {communityCategorySchema.options.map((cat) => (
          <button
            key={cat}
            type="button"
            className={category === cat ? 'active' : ''}
            onClick={() => setCategory(cat)}
          >
            {CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      <div className="cm-composer-row">
        <span className="cm-composer-avatar"><Icon name="sparkle" size={16} /></span>
        <input
          type="text"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="닉네임"
          className="cm-composer-nickname"
          maxLength={20}
        />
        <input
          type="text"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="오늘 겪은 일, 도움이 됐던 팁을 나눠주세요"
          className="cm-composer-input"
          maxLength={500}
        />
        <button type="submit" className="cm-composer-send" disabled={submitting} aria-label="글 등록">
          <Icon name="send" size={16} />
        </button>
      </div>
      {error && <p className="cm-composer-error">{error}</p>}
    </form>
  )
}
