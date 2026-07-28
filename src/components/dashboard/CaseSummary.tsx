import { money } from '../../features/case/case.data'
import { CaseAgentController } from '../../features/case/useCaseAgent'
import { GlassIcon } from '../ui/GlassIcon'
import { Icon } from '../ui/Icon'

type Props = Pick<CaseAgentController, 'caseState' | 'addAgent' | 'completeTask'>

export function CaseSummary({ caseState, addAgent, completeTask }: Props) {
  return (
    <aside className="da-summary da-glass">
      <span>CASE SUMMARY</span><h2>내 사건 요약</h2>
      <div className="da-summary-counts">
        <button onClick={() => addAgent(`현재 확인된 서류는 ${caseState.documents}개예요.`, 'checklist')}><GlassIcon icon="file" tone="sage"/><span>확인된 서류<strong>{caseState.documents}개</strong></span></button>
        <button onClick={() => addAgent(`현재 진행 중인 업무는 ${caseState.activeTasks}개예요.`, 'next')}><GlassIcon icon="clock" tone="amber"/><span>진행 중인 업무<strong>{caseState.activeTasks}개</strong></span></button>
        <button onClick={() => addAgent('현재 확인이 필요한 항목은 ○○은행 채무 금액이에요.', 'finance')}><GlassIcon icon="alert" tone="coral"/><span>확인 필요<strong>{caseState.needsCheck}개</strong></span></button>
      </div>
      <div className="da-money">
        <button onClick={() => addAgent('현재 확인된 자산·채무 금액을 수정할 수 있어요.', 'finance')}><span><GlassIcon icon="home" tone="sage"/>현재 확인된 자산</span><strong>약 {money(caseState.assets)}</strong></button>
        <button onClick={() => addAgent('채무 금액 확인을 이어서 진행할게요.', 'finance')}><span><GlassIcon icon="wallet" tone="coral"/>현재 확인된 채무</span><strong>약 {money(caseState.debts)}</strong></button>
      </div>
      <div className="da-summary-note"><Icon name="sparkle" size={16}/>입력한 정보를 기준으로 AI가 정리한 요약입니다.</div>
      <button className="da-done-button" onClick={completeTask}><Icon name="check"/>현재 업무 완료</button>
    </aside>
  )
}
