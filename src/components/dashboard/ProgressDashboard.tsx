import { CaseAgentController } from '../../features/case/useCaseAgent'
import { Icon } from '../ui/Icon'

type Props = Pick<CaseAgentController, 'caseState' | 'stages' | 'addAgent'>

export function ProgressDashboard({ caseState, stages, addAgent }: Props) {
  return (
    <header className="da-progress da-glass">
      <div className="da-progress-title">
        <div><span>애도할 시간 · CASE JOURNEY</span><h1>YOUR PROGRESS</h1></div>
        <button onClick={() => addAgent(`주요 검토 기한은 ${caseState.deadline}예요.`, 'urgent')}>
          <Icon name="calendar" size={16}/>{caseState.deadline}
        </button>
      </div>
      <div className="da-steps">
        {stages.map((stage, index) => (
          <button
            onClick={() => addAgent(`${stage.label} 단계는 현재 ‘${stage.state}’ 상태예요.`, index === 1 ? 'upload' : index === 2 ? 'finance' : 'checklist')}
            className={stage.done ? 'done' : stage.current ? 'current' : ''}
            key={stage.label}
          >
            <span className="da-stage-orb">{stage.done ? <Icon name="check"/> : index + 1}</span>
            <div><strong>{stage.label}</strong><small>{stage.state}</small></div>
          </button>
        ))}
      </div>
    </header>
  )
}
