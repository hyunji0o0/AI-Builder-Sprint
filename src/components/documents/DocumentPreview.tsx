import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { UploadedDocument } from '../../features/case/case.types'

type Props = {
  document: UploadedDocument | null
  onClose: () => void
}

export function DocumentPreview({ document, onClose }: Props) {
  useEffect(() => {
    if (!document) return
    const previousOverflow = window.document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [document, onClose])

  if (!document) return null

  return createPortal(
    <div className="da-preview-backdrop" role="dialog" aria-modal="true" aria-label="업로드 문서 미리보기" onClick={onClose}>
      <section className="da-preview-modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <div><small>문서 미리보기</small><strong>{document.name}</strong></div>
          <button type="button" onClick={onClose} aria-label="미리보기 닫기">×</button>
        </header>
        {document.type === 'application/pdf' || document.name.toLowerCase().endsWith('.pdf')
          ? <iframe src={document.url} title={document.name}/>
          : <img src={document.url} alt={document.name}/>
        }
      </section>
    </div>,
    window.document.body,
  )
}
