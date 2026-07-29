import { CaseAgentController } from './useCaseAgent'
import { GlassIcon } from '../../components/ui/GlassIcon'
import { Icon } from '../../components/ui/Icon'

const taskStatusLabel = {
  NOT_STARTED: '대기',
  IN_PROGRESS: '진행 중',
  COMPLETED: '완료',
  NOT_APPLICABLE: '해당 없음',
} as const

const documentStatusLabel = {
  UPLOADED: '업로드됨',
  PARSING: '분석 중',
  NEEDS_CONFIRMATION: '확인 필요',
  VERIFIED: '확인 완료',
  FAILED: '처리 실패',
} as const

export function CaseSectionView({ controller: c }: { controller: CaseAgentController }) {
  if (c.activeMenu === '내 할 일') {
    return (
      <section className="da-section-view da-glass">
        <header><div><span>MY TASKS</span><h1>내 할 일</h1><p>현재 사건 상태를 기준으로 생성된 업무를 확인하고 관리할 수 있어요.</p></div><GlassIcon icon="check" tone="peach"/></header>
        <div className="da-section-list">
          {c.agentCaseState.tasks.map((task) => (
            <article key={task.id}>
              <span className={`da-section-status ${task.priority.toLowerCase()}`}>{taskStatusLabel[task.status]}</span>
              <div><strong>{task.title}</strong><p>{task.reason ?? '현재 사건에서 확인이 필요한 업무예요.'}</p><small>준비도 {task.readiness}% · 우선순위 {task.priority === 'URGENT' ? '긴급' : task.priority === 'HIGH' ? '중요' : '일반'}</small></div>
            </article>
          ))}
        </div>
      </section>
    )
  }

  if (c.activeMenu === '서류함') {
    return (
      <section className="da-section-view da-glass">
        <header><div><span>DOCUMENTS</span><h1>서류함</h1><p>업로드한 서류와 확인 상태를 한곳에서 볼 수 있어요.</p></div><GlassIcon icon="folder" tone="amber"/></header>
        <div className="da-document-grid">
          {c.agentCaseState.documents.map((document) => (
            <article key={document.id}>
              <GlassIcon icon="file" tone={document.status === 'VERIFIED' ? 'sage' : 'amber'}/>
              <div><strong>{document.fileName}</strong><span>{documentStatusLabel[document.status]}</span><small>확인된 항목 {document.extractedFields.filter((field) => field.verifiedByUser).length}개</small></div>
            </article>
          ))}
          <label className="da-section-upload"><Icon name="upload"/>새 서류 추가<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={c.upload}/></label>
        </div>
      </section>
    )
  }

  return (
    <section className="da-section-view da-glass">
      <header><div><span>MY INFORMATION</span><h1>내 정보</h1><p>Agent가 업무를 정리할 때 사용하는 사건 기본정보예요.</p></div><GlassIcon icon="person" tone="blue"/></header>
      <div className="da-info-grid">
        <article><span>고인과의 관계</span><strong>{c.agentCaseState.user.relationToDeceased ?? '확인 필요'}</strong></article>
        <article><span>거주 지역</span><strong>{[c.agentCaseState.user.region.city, c.agentCaseState.user.region.district].filter(Boolean).join(' ') || '확인 필요'}</strong></article>
        <article><span>사망일</span><strong>{c.agentCaseState.deceased.deathDate ?? '확인 필요'}</strong></article>
        <article><span>상속 사실 인지일</span><strong>{c.agentCaseState.deceased.inheritanceAwarenessDate ?? '확인 필요'}</strong></article>
        <article><span>확인된 자산</span><strong>{(c.agentCaseState.financials.totalAssets ?? 0).toLocaleString('ko-KR')}원</strong></article>
        <article><span>확인된 채무</span><strong>{(c.agentCaseState.financials.totalDebts ?? 0).toLocaleString('ko-KR')}원</strong></article>
      </div>
    </section>
  )
}
