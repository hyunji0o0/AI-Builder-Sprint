import { createInitialCaseState } from '../../agent/state/initial-case'
import { CaseState } from '../../agent/schemas/case-state'
import { AgentMessage, DashboardCaseState } from './case.types'

export const initialCase = createInitialCaseState()

export const toDashboardCase = (
  state: CaseState,
  ui: Pick<DashboardCaseState, 'selectedDate' | 'uploadedFile' | 'extractionConfirmed' | 'checklist'>,
): DashboardCaseState => {
  const activeTasks = state.tasks.filter((task) => task.status === 'IN_PROGRESS' || task.status === 'NOT_STARTED').length
  const readiness = state.tasks.length
    ? Math.round(state.tasks.reduce((sum, task) => sum + (task.status === 'COMPLETED' ? 100 : task.readiness), 0) / state.tasks.length)
    : state.onboardingCompleted ? 100 : 0
  const deadlineTask = state.tasks.find((task) => task.deadline)
  return {
    documents: state.documents.filter((document) => document.status === 'VERIFIED').length,
    activeTasks,
    needsCheck: state.missingFields.filter((field) => !field.resolved).length,
    assets: state.financials.totalAssets ?? 0,
    debts: state.financials.totalDebts ?? 0,
    readiness,
    todayTasks: state.tasks.filter((task) => task.status === 'IN_PROGRESS').length,
    deadline: deadlineTask?.deadline ? `${deadlineTask.title} · ${deadlineTask.deadline}까지` : '주요 검토 기한 · 확인 필요',
    ...ui,
  }
}

export const initialMessages: AgentMessage[] = [
  {
    id: 1,
    role: 'agent',
    text: '안녕. 복잡한 사후 행정 업무를 함께 차근차근 정리해볼게. 궁금한 내용이나 지금 도움이 필요한 일을 편하게 말해줘.',
  },
]

export const checklistItems = [
  '가족관계증명서',
  '기본증명서',
  '금융거래 조회 결과',
  '상담 질문 메모',
]

export const money = (value: number) =>
  `${Math.round(value / 10000).toLocaleString('ko-KR')}만 원`
