import { checklistItems } from '../../features/case/case.data'
import { AgentBlockKind } from '../../features/case/case.types'
import { CaseAgentController } from '../../features/case/useCaseAgent'
import { navigateCommunity } from '../../features/community/routing/community.routes'
import { GlassIcon } from '../ui/GlassIcon'
import { Icon } from '../ui/Icon'
import { AgentUIBlock } from '../../agent/schemas/agent-output'

type Props = { block?: AgentBlockKind; ui?: AgentUIBlock[]; controller: CaseAgentController }

export function AgentBlock({ block, ui, controller: c }: Props) {
  const structured = ui?.[0]
  if (structured?.type === 'CHOICE') return (
    <div className="da-choice">
      {structured.options.map((option) => <button key={option.id} onClick={() => c.handleUiAction(option.id, option.label)}>{option.label}</button>)}
    </div>
  )

  if (structured?.type === 'RISK_ALERT') return (
    <div className="da-action-card da-coral">
      <GlassIcon icon="alert" tone="coral"/>
      <div><small>현재 확인된 자료 기준</small><strong>{structured.title}</strong>{structured.facts.map((fact) => <span key={fact}>{fact}</span>)}<span>{structured.disclaimer}</span></div>
    </div>
  )

  if (structured?.type === 'TASK_CARD') return (
    <div className={`da-action-card ${structured.priority === 'URGENT' ? 'da-coral' : 'da-amber'}`}>
      <GlassIcon icon={structured.priority === 'URGENT' ? 'alert' : 'check'} tone={structured.priority === 'URGENT' ? 'coral' : 'amber'}/>
      <div><small>{structured.priority === 'URGENT' ? '먼저 확인' : '다음 단계'}</small><strong>{structured.title}</strong><span>준비도 {structured.readiness}%</span></div>
      <button onClick={() => c.handleUiAction(structured.actions[0]?.id ?? 'continue', structured.actions[0]?.label ?? '이어하기')}>
        {structured.actions[0]?.label ?? '이어하기'}
      </button>
    </div>
  )

  if (structured?.type === 'DEATH_REPORT_PREPARATION') return (
    <div className="da-death-report">
      <header>
        <GlassIcon icon="file" tone="peach"/>
        <div>
          <small>공식 접수 준비</small>
          <strong>{structured.title}</strong>
          <span>기한 · {structured.deadlineText}</span>
        </div>
        <em>{structured.submissionMethods.join(' · ')}</em>
      </header>
      <div className="da-death-checklist">
        {structured.checklist.map((item) => (
          <article className={item.status.toLowerCase()} key={item.id}>
            <span><Icon name={item.status === 'HELD' ? 'check' : 'file'} size={17}/></span>
            <div>
              <strong>{item.label}</strong>
              {item.note && <small>{item.note}</small>}
            </div>
            <b>{item.status === 'HELD' ? '보유' : item.status === 'OPTIONAL' ? '조건부' : '준비 필요'}</b>
          </article>
        ))}
      </div>
      <div className="da-official-links">
        {structured.resources.map((resource) => (
          <a href={resource.url} target="_blank" rel="noreferrer" key={resource.id}>
            <Icon name={resource.kind === 'FORM' ? 'upload' : 'chevronRight'} size={17}/>
            <span>{resource.label}</span>
          </a>
        ))}
      </div>
      <aside className="da-official-notice">
        <span><Icon name="alert" size={21}/></span>
        <div><strong>접수 전에 꼭 확인하세요</strong><p>{structured.notice}</p></div>
      </aside>
      <footer>
        {structured.actions.map((action) => (
          <button key={action.id} onClick={() => c.handleUiAction(action.id, action.label)}>{action.label}</button>
        ))}
      </footer>
    </div>
  )

  if (structured?.type === 'PROCEDURE_PLAN') return (
    <div className="da-procedure-plan">
      <header>
        <span>개인별 사후 절차</span>
        <strong>지금 자료를 기준으로 정리한 순서야</strong>
      </header>
      <div className="da-procedure-steps">
        {structured.steps.map((step, index) => {
          const priorityLabel = step.priority === 'URGENT' ? '우선 확인' : step.priority === 'HIGH' ? '중요' : '일반'
          const statusLabel = step.status === 'IN_PROGRESS' ? '진행 중' : step.status === 'COMPLETED' ? '완료' : step.status === 'NOT_APPLICABLE' ? '해당 없음' : '대기'
          return (
            <article className={step.priority === 'URGENT' ? 'urgent' : ''} key={step.taskId}>
              <span className="da-procedure-number">{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <small>{priorityLabel} · {statusLabel} · {step.applicability === 'CONFIRMED' ? '현재 정보로 필요 확인' : '공식 기준 검토 필요'}</small>
                <p>{step.reason}</p>
                {step.basisFacts.length > 0 && <em>근거: {step.basisFacts.join(' · ')}</em>}
                {step.dependencyTitles.length > 0 && <em>먼저 할 일: {step.dependencyTitles.join(', ')}</em>}
              </div>
            </article>
          )
        })}
      </div>
      <button className="da-procedure-next" onClick={c.advanceWorkflow}>가장 먼저 할 일 확인 <Icon name="chevronRight" size={16}/></button>
    </div>
  )

  if (structured?.type === 'MISSING_INFORMATION_QUESTION') return (
    <div className="da-form-card">
      <strong>{structured.prompt}</strong>
      {structured.inputType === 'DATE' && (
        <label><Icon name="calendar"/>날짜 선택<input type="date" value={c.caseState.selectedDate} onChange={(event) => c.setSelectedDate(event.target.value)}/></label>
      )}
      <button onClick={c.saveAwarenessDate}>답변 저장</button>
    </div>
  )

  if (structured?.type === 'TASK_READINESS') return (
    <div className="da-checklist">
      <div><strong>{structured.title}</strong><span>현재 준비도 {structured.readiness}%</span></div>
      {structured.documents.map((document) => (
        <div key={document.type}>
          <strong>{document.label}</strong>
          <span>{document.status === 'HELD' ? '보유' : document.status === 'NEEDS_REVIEW' ? '확인 필요' : document.status === 'MISSING' ? '부족' : '해당 없음'}</span>
        </div>
      ))}
      <label className="da-mini-upload"><Icon name="upload" size={16}/>부족한 서류 업로드<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={c.upload}/></label>
      <button onClick={c.advanceWorkflow}>현재 자료로 준비하기</button>
    </div>
  )

  if (structured?.type === 'PREPARATION_PACKAGE') return (
    <div className="da-review">
      <div className="da-review-head"><GlassIcon icon="file" tone="sage"/><div><small>상담·방문 준비 패키지</small><strong>{structured.title}</strong></div></div>
      <p>준비도 {structured.readiness}%</p>
      {structured.confirmedFacts.map((fact) => <p key={fact}>확인 · {fact}</p>)}
      {structured.unresolvedItems.map((item) => <p key={item}>확인 필요 · {item}</p>)}
      <strong>전문가에게 물어볼 질문</strong>
      {structured.questionsForExpert.map((question) => <p key={question}>{question}</p>)}
      <small>{structured.disclaimer}</small>
      <button onClick={c.advanceWorkflow}>공식 처리 단계 확인</button>
    </div>
  )

  if (structured?.type === 'OFFICIAL_PROCESS') return (
    <div className="da-institution">
      <GlassIcon icon="building" tone="blue"/>
      <div>
        <small>공식 정보 확인 필요</small>
        <strong>{structured.institutions[0]?.name ?? '연결할 기관 확인 필요'}</strong>
        <span>{structured.institutions[0]?.district}</span>
        {structured.checklist.map((item) => <p key={item}>· {item}</p>)}
      </div>
      <button onClick={c.advanceWorkflow}>처리 완료로 기록</button>
    </div>
  )

  if (structured?.type === 'COMPLETION_CONFIRMATION') return (
    <div className="da-complete da-completion-banner">
      <GlassIcon icon="check" tone="sage"/>
      <div><small>완료한 업무</small><strong>{structured.title}</strong><span>사건 상태와 진행률에 반영했어.</span></div>
      {structured.actions.map((action) => (
        <button key={action.id} onClick={() => c.handleUiAction(action.id, action.label)}>{action.label}</button>
      ))}
    </div>
  )

  if (structured?.type === 'INSTITUTION') return (
    <div className="da-institution">
      <GlassIcon icon="building" tone="blue"/>
      <div><small>공식 정보 확인 필요</small><strong>{structured.results[0]?.name || '기관 정보 없음'}</strong><span>{structured.results[0]?.district}</span></div>
    </div>
  )

  if (structured?.type === 'COMMUNITY_REVIEW') {
    const review = structured.reviews[0]
    return review ? (
      <div className="da-review">
        <div className="da-review-head"><GlassIcon icon="users" tone="sage"/><div><small>{review.label}</small><strong>비슷한 경험자의 팁</strong></div></div>
        <blockquote>“{review.excerpt}”</blockquote>
        <footer><span><Icon name="heart" size={15}/> 도움이 됐어요 {review.helpfulCount}</span><span>{review.createdAt}</span>{review.url && <button onClick={() => navigateCommunity(review.url!)}>원본 글 보기</button>}</footer>
        <p>추천 이유: {review.reason}<br/>{structured.disclaimer}</p>
      </div>
    ) : null
  }

  if (structured?.type === 'DOCUMENT_BATCH_SUMMARY') return (
    <div className="da-document-summary">
      {structured.files.map((file) => (
        <div key={file.documentId}>
          <span><Icon name="file" size={18}/></span>
          <div><strong>{file.fileName}</strong><small>문서 분석 완료 · 분류 신뢰도 {Math.round(file.confidence * 100)}%</small></div>
        </div>
      ))}
      {structured.issues.map((issue) => <p key={`${issue.code}-${issue.documentId}`}>{issue.message}</p>)}
    </div>
  )

  if (structured?.type === 'DOCUMENT_EXTRACTION_REVIEW') return (
    <section className="da-document-review">
      <header>
        <div><small>추출 내용 확인</small><strong>{structured.documentTypeLabel}</strong><span>{structured.fileName}</span></div>
        <em>신뢰도 {Math.round(structured.confidence * 100)}%</em>
      </header>
      <p>{structured.notice}</p>
      <div className="da-document-review-items">
        {structured.items.map((item) => (
          <div key={item.fieldKey}>
            <span>{item.label}</span>
            <strong>{item.formattedValue}</strong>
          </div>
        ))}
      </div>
      <footer>
        <button onClick={() => c.confirmPipelineDocument(structured.documentId)}>모두 정확해요</button>
        <button onClick={() => c.addAgent('수정할 항목의 이름과 정확한 값을 알려줘. 확인한 뒤 반영할게.')}>수정할 내용이 있어요</button>
      </footer>
    </section>
  )

  if (structured?.type === 'DOCUMENT_CLASSIFICATION_CONFIRMATION') return (
    <div className="da-extract">
      <div><span>파일</span><strong>{structured.fileName}</strong></div>
      <div><span>예상 문서 종류</span><strong>{structured.suggestedType}</strong></div>
      <div><span>분류 신뢰도</span><strong>{Math.round(structured.confidence * 100)}%</strong></div>
      <button onClick={() => c.addAgent('문서 종류를 확인했어.', 'extract')}>문서 종류 확인</button>
    </div>
  )

  if (structured?.type === 'FIELD_VERIFICATION') return (
    <div className="da-extract">
      <div><span>{structured.label}</span><strong>{structured.formattedValue}</strong></div>
      <div><span>원문 근거</span><strong>{structured.sourceText || '원문에서 직접 확인 필요'}</strong></div>
      <button onClick={() => c.confirmPipelineField(structured.documentId, structured.fieldKey, structured.value)}>맞아요</button>
      <button onClick={() => c.addAgent(`${structured.label} 값을 직접 입력해줘.`, structured.fieldKey === 'amount' ? 'finance' : 'extract')}>수정할게</button>
    </div>
  )

  if (structured?.type === 'DOCUMENT_CONFLICT') return (
    <div className="da-action-card da-coral">
      <GlassIcon icon="alert" tone="coral"/>
      <div><small>문서 간 교차검증</small><strong>{structured.title}</strong>{structured.issues.map((issue) => <span key={issue.code}>{issue.message}</span>)}</div>
      <button onClick={() => c.addAgent('충돌한 항목을 원문과 함께 하나씩 확인할게.', 'extract')}>하나씩 확인</button>
    </div>
  )

  if (!block || block === 'text') return null

  if (block === 'choice') return (
    <div className="da-choice">
      <button onClick={() => c.addAgent('서류 확인부터 진행할게.', 'upload')}>서류부터 확인</button>
      <button onClick={() => c.addAgent('자산·채무부터 확인할게.', 'finance')}>재산·채무 확인</button>
    </div>
  )

  if (block === 'date') return (
    <div className="da-form-card">
      <label><Icon name="calendar"/>상담 희망일<input type="date" value={c.caseState.selectedDate} onChange={(e) => c.setSelectedDate(e.target.value)}/></label>
      <button onClick={() => c.addAgent(`${c.caseState.selectedDate || '선택한 날짜'}로 상담 준비 일정을 저장했어.`, 'complete')}>날짜 저장</button>
    </div>
  )

  if (block === 'upload') return (
    <label className="da-upload">
      <Icon name="upload" size={27}/>
      <strong>{c.caseState.uploadedFile || '서류를 선택하거나 끌어다 놓으세요'}</strong>
      <span>PDF, JPG, PNG · 최대 10MB</span>
      <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={c.upload}/>
      {c.documentProgress.map((progress) => <small key={progress.fileId}>{progress.label} · {progress.progress}%</small>)}
    </label>
  )

  if (block === 'extract') return (
    <div className="da-extract">
      <div><span>문서 분석</span><strong>올린 문서의 분석 결과를 확인해줘</strong></div>
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
      <div><small>긴급 확인</small><strong>확인이 필요한 정보가 있어</strong><span>확인되지 않은 항목부터 살펴볼게.</span></div>
      <button onClick={() => c.addAgent('확인되지 않은 정보를 입력해줘.', 'finance')}>확인하기</button>
    </div>
  )

  if (block === 'next') return (
    <div className="da-stack">
      <div className="da-action-card da-coral">
        <GlassIcon icon="alert" tone="coral"/>
        <div><small>다음 업무</small><strong>사건 상태를 확인하고 있어</strong><span>확인된 정보에 따라 다음 업무가 표시돼.</span></div>
        <button onClick={() => c.advanceWorkflow()}>다음 업무 확인</button>
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
      <label className="da-mini-upload"><Icon name="upload" size={16}/>부족한 서류 업로드<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={c.upload}/></label>
    </div>
  )

  if (block === 'institution') return (
    <div className="da-institution">
      <GlassIcon icon="building" tone="blue"/>
      <div><strong>연결된 공식 기관 정보가 없어요</strong><p>검증된 기관 데이터가 연결되면 현재 지역과 업무에 맞춰 보여줄게.</p></div>
    </div>
  )

  if (block === 'review') return (
    <div className="da-review">
      <div className="da-review-head"><GlassIcon icon="users" tone="sage"/><div><strong>등록된 사용자 후기가 없어요</strong></div></div>
      <p>실제 후기가 등록되면 현재 사건과 비슷한 경험을 찾아 보여줄게.</p>
    </div>
  )

  return (
    <div className="da-complete">
      <GlassIcon icon="check" tone="sage"/>
      <div><strong>업무 처리가 완료됐어요</strong><span>변경된 내용이 대시보드에 반영되었습니다.</span></div>
    </div>
  )
}
