import { checklistItems } from '../../features/case/case.data'
import { AgentBlockKind } from '../../features/case/case.types'
import { CaseAgentController } from '../../features/case/useCaseAgent'
import { GlassIcon } from '../ui/GlassIcon'
import { Icon } from '../ui/Icon'

type Props = { block?: AgentBlockKind; controller: CaseAgentController }

export function AgentBlock({ block, controller: c }: Props) {
  if (!block || block === 'text') return null

  if (block === 'choice') return (
    <div className="da-choice">
      <button onClick={() => c.addAgent('서류 확인부터 진행할게요.', 'upload')}>서류부터 확인</button>
      <button onClick={() => c.addAgent('자산·채무부터 확인할게요.', 'finance')}>재산·채무 확인</button>
    </div>
  )

  if (block === 'date') return (
    <div className="da-form-card">
      <label><Icon name="calendar"/>상담 희망일<input type="date" value={c.caseState.selectedDate} onChange={(e) => c.setSelectedDate(e.target.value)}/></label>
      <button onClick={() => c.addAgent(`${c.caseState.selectedDate || '선택한 날짜'}로 상담 준비 일정을 저장했어요.`, 'complete')}>날짜 저장</button>
    </div>
  )

  if (block === 'upload') return (
    <label className="da-upload">
      <Icon name="upload" size={27}/>
      <strong>{c.caseState.uploadedFile || '서류를 선택하거나 끌어다 놓으세요'}</strong>
      <span>PDF, JPG, PNG · 최대 10MB</span>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={c.upload}/>
    </label>
  )

  if (block === 'extract') return (
    <div className="da-extract">
      <div><span>문서 종류</span><strong>금융거래 조회 결과서</strong></div>
      <div><span>금융기관</span><strong>○○은행</strong><button aria-label="추출 결과 수정"><Icon name="edit" size={15}/></button></div>
      <div><span>채무 금액</span><strong>확인 필요</strong></div>
      <button onClick={c.confirmExtraction}>추출 결과 확인</button>
    </div>
  )

  if (block === 'finance') return (
    <div className="da-finance">
      <label>현재 확인된 자산<input inputMode="numeric" value={c.assetDraft} onChange={(e) => c.setAssetDraft(e.target.value)}/><span>원</span></label>
      <label>현재 확인된 채무<input inputMode="numeric" value={c.debtDraft} onChange={(e) => c.setDebtDraft(e.target.value)}/><span>원</span></label>
      <button onClick={c.saveFinance}>금액 저장</button>
    </div>
  )

  if (block === 'urgent') return (
    <div className="da-action-card da-coral">
      <GlassIcon icon="alert" tone="coral"/>
      <div><small>긴급 확인</small><strong>○○은행 채무 금액 확인</strong><span>정확한 상속 방법 판단을 위해 필요해요.</span></div>
      <button onClick={() => c.addAgent('채무 금액을 입력해 주세요.', 'finance')}>확인하기</button>
    </div>
  )

  if (block === 'next') return (
    <div className="da-stack">
      <div className="da-action-card da-coral">
        <GlassIcon icon="alert" tone="coral"/>
        <div><small>먼저 확인</small><strong>정확하지 않은 채무 금액 확인</strong><span>준비도 50%</span></div>
        <button onClick={() => c.addAgent('현재 확인이 필요한 채무 정보를 입력해 주세요.', 'finance')}>이어하기</button>
      </div>
      <div className="da-action-card da-amber">
        <GlassIcon icon="users" tone="amber"/>
        <div><small>다음 단계</small><strong>상속 방법 전문가 상담 준비</strong><span>준비도 60%</span></div>
        <button onClick={() => c.addAgent('상담 날짜와 준비 서류를 확인할게요.', 'date')}>준비하기</button>
      </div>
    </div>
  )

  if (block === 'checklist') return (
    <div className="da-checklist">
      {checklistItems.map((item, index) => (
        <button className={c.caseState.checklist[index] ? 'checked' : ''} onClick={() => c.toggleChecklist(index)} key={item}>
          <span><Icon name="check" size={15}/></span>{item}
        </button>
      ))}
      <label className="da-mini-upload"><Icon name="upload" size={16}/>부족한 서류 업로드<input type="file" onChange={c.upload}/></label>
    </div>
  )

  if (block === 'institution') return (
    <div className="da-institution">
      <GlassIcon icon="building" tone="blue"/>
      <div><small>부산광역시 연제구</small><strong>부산시청 행복민원실</strong><span>안심상속 원스톱 서비스 · 평일 09:00–18:00</span><p>부산 연제구 중앙대로 1001 · 방문 전 전화 확인 권장</p></div>
      <button onClick={() => c.addAgent('방문 준비를 위해 필요한 서류 체크리스트를 열었어요.', 'checklist')}>준비 서류</button>
    </div>
  )

  if (block === 'review') return (
    <div className="da-review">
      <div className="da-review-head"><GlassIcon icon="users" tone="sage"/><div><small>사용자 경험</small><strong>비슷한 경험자의 팁</strong></div></div>
      <blockquote>“방문 전에 필요한 서류를 전화로 다시 확인하니 재방문하지 않아도 됐어요.”</blockquote>
      <div className="da-tags"><span>부모님</span><span>부산</span><span>채무 확인</span></div>
      <footer><span><Icon name="heart" size={15}/> 도움이 됐어요 38</span><button>후기 전체 보기</button></footer>
      <p>개인의 경험이며 공식 안내나 법률 자문이 아닙니다.</p>
    </div>
  )

  return (
    <div className="da-complete">
      <GlassIcon icon="check" tone="sage"/>
      <div><strong>업무 처리가 완료됐어요</strong><span>변경된 내용이 대시보드에 반영되었습니다.</span></div>
    </div>
  )
}
