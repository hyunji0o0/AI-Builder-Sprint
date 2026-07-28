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
  return (
    <section className="da-agent da-glass">
      <header><GlassIcon icon="sparkle" tone="blue"/><div><span><i/>안심 AI가 함께하고 있어요</span><h2>AI와 함께 정리하기</h2></div></header>
      <div className="da-messages" aria-live="polite">
        {c.messages.map((message) => (
          <div className={`da-message ${message.role}`} key={message.id}>
            {message.role === 'agent' && <GlassIcon icon="sparkle" tone="blue"/>}
            <div className="da-message-content">
              {message.role === 'agent' && <small>안심 AI</small>}
              <div className="da-bubble">
                <p>{message.text}</p>
                {message.role === 'agent' && <AgentBlock block={message.block} controller={c}/>}
              </div>
            </div>
            {message.role === 'user' && <GlassIcon icon="person" tone="peach"/>}
          </div>
        ))}
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
          <input value={c.input} onChange={(e) => c.setInput(e.target.value)} placeholder="궁금한 내용이나 다음에 할 일을 물어보세요" aria-label="AI에게 질문"/>
          <button aria-label="메시지 전송"><Icon name="send"/></button>
        </form>
        <small>AI는 업무 정리를 돕는 안내자예요. 중요한 결정은 전문가와 확인해 주세요.</small>
      </footer>
    </section>
  )
}
