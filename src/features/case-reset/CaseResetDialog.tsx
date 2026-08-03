import { useEffect } from 'react'
import { Icon } from '../../components/ui/Icon'
import './case-reset.css'

type Props = {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function CaseResetDialog({ open, onCancel, onConfirm }: Props) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="cr-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="cr-dialog" role="dialog" aria-modal="true" aria-labelledby="cr-title" aria-describedby="cr-description">
        <div className="cr-icon"><Icon name="refresh" size={30}/></div>
        <small>처음부터 다시 시작</small>
        <h2 id="cr-title">모든 내용을 초기화하시겠습니까?</h2>
        <p id="cr-description">지금까지의 채팅 기록, 사건 진행 상태와 업로드한 문서 정보가 모두 삭제돼. 삭제한 내용은 다시 되돌릴 수 없어.</p>
        <div className="cr-note"><Icon name="info" size={18}/><span>로그인 정보와 경험 나눔에 작성한 게시글은 유지돼.</span></div>
        <footer>
          <button type="button" className="cr-cancel" onClick={onCancel}>취소</button>
          <button type="button" className="cr-confirm" onClick={onConfirm}>모든 내용 초기화</button>
        </footer>
      </section>
    </div>
  )
}

export function MobileCaseResetTrigger({ onClick }: { onClick: () => void }) {
  return <button className="cr-mobile-trigger" onClick={onClick}><Icon name="refresh" size={17}/> 처음부터</button>
}
