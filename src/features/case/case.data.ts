import { AgentMessage, CaseState } from './case.types'

export const initialCase: CaseState = {
  documents: 3,
  activeTasks: 2,
  needsCheck: 1,
  assets: 123000000,
  debts: 42000000,
  readiness: 60,
  todayTasks: 2,
  deadline: '상속 포기 검토 · 2026.08.14까지',
  selectedDate: '',
  uploadedFile: '',
  extractionConfirmed: false,
  checklist: [true, true, false, false],
}

export const initialMessages: AgentMessage[] = [
  {
    id: 1,
    role: 'agent',
    text: '현재 상황을 정리했어요. 대시보드의 항목을 누르거나 아래에서 필요한 업무를 선택해 주세요.',
    block: 'next',
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
