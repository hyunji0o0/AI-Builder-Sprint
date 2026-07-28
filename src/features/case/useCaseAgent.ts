import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { initialCase, initialMessages } from './case.data'
import { AgentBlockKind, AgentMessage, CaseStage } from './case.types'

const responseFor = (question: string): [string, AgentBlockKind] => {
  const compact = question.replace(/\s/g, '')
  if (compact.includes('서류')) return ['현재 준비 상태를 확인했어요. 부족한 서류를 체크하거나 파일을 올려주세요.', 'checklist']
  if (compact.includes('채무') || compact.includes('자산') || compact.includes('재산')) return ['현재 확인된 자산과 채무를 수정할 수 있어요.', 'finance']
  if (compact.includes('부산') || compact.includes('기관')) return ['현재 사건 정보와 가까운 부산 지역 기관을 정리했어요.', 'institution']
  if (compact.includes('후기') || compact.includes('경험') || compact.includes('팁')) return ['비슷한 상황을 경험한 사용자의 팁을 찾았어요.', 'review']
  if (compact.includes('날짜') || compact.includes('상담')) return ['상담을 준비할 날짜를 선택해 주세요.', 'date']
  if (compact.includes('급')) return ['기한이 지나기 전에 먼저 확인해야 할 항목이에요.', 'urgent']
  return ['어떤 방식으로 진행할까요?', 'choice']
}

export function useCaseAgent() {
  const [caseState, setCaseState] = useState(initialCase)
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [activeMenu, setActiveMenu] = useState('AI 홈')
  const [assetDraft, setAssetDraft] = useState(String(initialCase.assets))
  const [debtDraft, setDebtDraft] = useState(String(initialCase.debts))

  const stages: CaseStage[] = useMemo(() => [
    { label: '기본 정보 확인', state: '완료', done: true },
    { label: '서류 확인', state: caseState.documents >= 4 ? '완료' : '진행 중', done: caseState.documents >= 4 },
    { label: '재산·채무 확인', state: caseState.needsCheck === 0 ? '완료' : '진행 중', done: caseState.needsCheck === 0 },
    { label: '상담 준비', state: caseState.activeTasks === 0 ? '준비 완료' : '곧 진행 예정', done: caseState.activeTasks === 0 },
  ], [caseState])

  const addAgent = (text: string, block?: AgentBlockKind) => {
    setMessages((current) => [...current, {
      id: Date.now() + current.length,
      role: 'agent',
      text,
      block,
    }])
  }

  const send = (event?: FormEvent) => {
    event?.preventDefault()
    const question = input.trim()
    if (!question) return
    setMessages((current) => [...current, { id: Date.now(), role: 'user', text: question }])
    setInput('')
    window.setTimeout(() => addAgent(...responseFor(question)), 350)
  }

  const chooseQuick = (label: string, block: AgentBlockKind) => {
    setMessages((current) => [...current, { id: Date.now(), role: 'user', text: label }])
    const text = block === 'urgent'
      ? '현재 가장 먼저 확인해야 하는 항목은 ○○은행 채무 금액이에요.'
      : block === 'checklist'
        ? '상담 전 준비해야 할 서류를 확인해 주세요.'
        : block === 'institution'
          ? '부산에서 방문 가능한 기관을 찾았어요.'
          : '현재 사건과 유사한 경험자의 팁이에요.'
    window.setTimeout(() => addAgent(text, block), 280)
  }

  const menuAction = (label: string) => {
    setActiveMenu(label)
    const mapping: Record<string, [string, AgentBlockKind]> = {
      'AI 홈': ['현재 사건의 진행 상황과 다음 업무를 정리했어요.', 'next'],
      '내 할 일': ['오늘 처리하면 좋은 업무 두 가지를 보여드릴게요.', 'next'],
      '서류함': ['확인된 서류와 부족한 서류를 함께 살펴볼게요.', 'checklist'],
      '경험 나눔': ['비슷한 상황을 겪은 사용자의 경험을 추천할게요.', 'review'],
      '내 정보': ['기본 정보에서 상담 날짜를 확인할 수 있어요.', 'date'],
    }
    addAgent(...mapping[label])
  }

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setCaseState((state) => ({ ...state, uploadedFile: file.name }))
    window.setTimeout(() => addAgent(`${file.name}에서 주요 정보를 추출했어요. 내용을 확인해 주세요.`, 'extract'), 250)
  }

  const confirmExtraction = () => {
    setCaseState((state) => ({
      ...state,
      documents: state.extractionConfirmed ? state.documents : state.documents + 1,
      readiness: Math.min(100, state.readiness + (state.extractionConfirmed ? 0 : 8)),
      extractionConfirmed: true,
    }))
    addAgent('서류 확인이 완료되어 대시보드에 반영했어요.', 'complete')
  }

  const saveFinance = () => {
    setCaseState((state) => ({
      ...state,
      assets: Number(assetDraft) || 0,
      debts: Number(debtDraft) || 0,
      needsCheck: 0,
      readiness: Math.max(state.readiness, 76),
    }))
    addAgent('자산·채무 금액을 저장했고 확인 필요 항목을 해결했어요.', 'complete')
  }

  const completeTask = () => {
    setCaseState((state) => ({
      ...state,
      activeTasks: Math.max(0, state.activeTasks - 1),
      todayTasks: Math.max(0, state.todayTasks - 1),
      readiness: Math.min(100, state.readiness + 10),
    }))
    addAgent('업무를 완료 처리했어요. 진행률과 오늘 할 일을 갱신했습니다.', 'complete')
  }

  const toggleChecklist = (index: number) => {
    setCaseState((state) => {
      const checklist = [...state.checklist]
      checklist[index] = !checklist[index]
      return {
        ...state,
        checklist,
        readiness: checklist.every(Boolean) ? Math.max(state.readiness, 84) : state.readiness,
      }
    })
  }

  const setSelectedDate = (selectedDate: string) =>
    setCaseState((state) => ({ ...state, selectedDate }))

  return {
    caseState,
    messages,
    input,
    activeMenu,
    assetDraft,
    debtDraft,
    stages,
    setInput,
    setAssetDraft,
    setDebtDraft,
    setSelectedDate,
    addAgent,
    send,
    chooseQuick,
    menuAction,
    upload,
    confirmExtraction,
    saveFinance,
    completeTask,
    toggleChecklist,
  }
}

export type CaseAgentController = ReturnType<typeof useCaseAgent>
