import { useEffect, useState } from 'react'
import { Icon } from '../../components/ui/Icon'
import { guideSteps } from './guide-content'
import './user-guide.css'

type Props = { open: boolean; onClose: () => void }

export function UserGuide({ open, onClose }: Props) {
  const [stepIndex, setStepIndex] = useState(0)
  const step = guideSteps[stepIndex]

  useEffect(() => {
    if (open) setStepIndex(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') setStepIndex((value) => Math.min(guideSteps.length - 1, value + 1))
      if (event.key === 'ArrowLeft') setStepIndex((value) => Math.max(0, value - 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null
  const isLast = stepIndex === guideSteps.length - 1

  return (
    <div className="ug-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="ug-modal" role="dialog" aria-modal="true" aria-labelledby="ug-title">
        <button className="ug-close" onClick={onClose} aria-label="사용 설명 닫기">×</button>
        <div className={`ug-visual ${step.tone}`}>
          <img src="/aedohal-sigan-icon-3d.svg" alt=""/>
          <div className="ug-visual-orb"><Icon name={step.icon} size={42}/></div>
          <span>{String(stepIndex + 1).padStart(2, '0')}</span>
          <p>애도할 시간<br/>사용 설명</p>
        </div>
        <div className="ug-content">
          <header>
            <small>{step.eyebrow}</small>
            <h2 id="ug-title">{step.title}</h2>
            <p>{step.description}</p>
          </header>
          <div className="ug-points">
            {step.points.map((point, index) => (
              <article key={point.title}>
                <span><Icon name={index === 0 ? step.icon : 'check'} size={21}/></span>
                <div><strong>{point.title}</strong><p>{point.description}</p></div>
              </article>
            ))}
          </div>
          <footer>
            <div className="ug-progress" aria-label={`${guideSteps.length}단계 중 ${stepIndex + 1}단계`}>
              {guideSteps.map((item, index) => <button key={item.title} className={index === stepIndex ? 'active' : ''} onClick={() => setStepIndex(index)} aria-label={`${index + 1}단계로 이동`}/>) }
            </div>
            <div className="ug-actions">
              {stepIndex > 0 && <button className="secondary" onClick={() => setStepIndex(stepIndex - 1)}><Icon name="chevronLeft" size={18}/> 이전</button>}
              <button className="primary" onClick={() => isLast ? onClose() : setStepIndex(stepIndex + 1)}>{isLast ? '시작하기' : '다음'} {!isLast && <Icon name="chevronRight" size={18}/>}</button>
            </div>
          </footer>
        </div>
      </section>
    </div>
  )
}

export function MobileUserGuideTrigger({ onClick }: { onClick: () => void }) {
  return <button className="ug-mobile-trigger" onClick={onClick}><Icon name="sparkle" size={17}/> 사용 설명</button>
}
