import { useEffect, useRef } from 'react'
import { AgentBlockKind } from '../../features/case/case.types'
import { CaseAgentController } from '../../features/case/useCaseAgent'
import { GlassIcon } from '../ui/GlassIcon'
import { Icon } from '../ui/Icon'
import { AgentBlock } from './AgentBlock'

const quickQuestions: [string, AgentBlockKind][] = [
  ['지금 가장 급한 일', 'urgent'],
  ['부족한 서류', 'checklist'],
  ['부산 기관 찾기', 'institution'],
  ['맞춤 후기 추천', 'review'],
]

export function AgentChat({ controller: c }: { controller: CaseAgentController }) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [c.messages.length, c.isResponding])

  return (
    <section className="da-agent da-glass">
      <div className="da-messages" aria-live="polite">
        {c.messages.map((message) => (
          <div className={`da-message ${message.role}`} key={message.id}>
            {message.role === 'agent' && <img className="da-agent-avatar" src="/aedohal-sigan-icon-3d.svg" alt=""/>}
            <div className="da-message-content">
              {message.role === 'agent' && <small>곁</small>}
              <div className="da-bubble">
                {message.text.split(/\n\s*\n/).map((paragraph, index) => <p key={`${message.id}-paragraph-${index}`}>{paragraph}</p>)}
                {message.role === 'agent' && (
                  message.ui?.length
                    ? message.ui.map((ui, index) => <AgentBlock key={`${message.id}-${ui.type}-${index}`} block={message.block} ui={[ui]} controller={c}/>)
                    : <AgentBlock block={message.block} controller={c}/>
                )}
              </div>
            </div>
            {message.role === 'user' && <GlassIcon icon="person" tone="peach"/>}
          </div>
        ))}
        {c.isResponding && (
          <div className="da-message agent">
            <img className="da-agent-avatar" src="/aedohal-sigan-icon-3d.svg" alt=""/>
            <div className="da-message-content">
              <small>곁</small>
              <div className="da-bubble"><p>답변을 정리하고 있어요…</p></div>
            </div>
          </div>
        )}
        <div className="da-messages-end" ref={messagesEndRef} aria-hidden="true"/>
      </div>
      <footer className="da-composer-wrap">
        <div className="da-quick">
          {quickQuestions.map(([label, block]) => (
            <button onClick={() => c.chooseQuick(label, block)} key={label}>
              <Icon name={block === 'institution' ? 'building' : 'sparkle'} size={14}/>{label}
            </button>
          ))}
        </div>
        <form className="da-composer" onSubmit={c.send}>
          <input value={c.input} onChange={(e) => c.setInput(e.target.value)} placeholder="궁금한 내용이나 다음에 할 일을 물어보세요" aria-label="AI에게 질문" disabled={c.isResponding}/>
          <button aria-label="메시지 전송" disabled={c.isResponding}><Icon name="send"/></button>
        </form>
        <small>AI는 업무 정리를 돕는 안내자예요. 중요한 결정은 전문가와 확인해 주세요.</small>
      </footer>
    </section>
  )
}
