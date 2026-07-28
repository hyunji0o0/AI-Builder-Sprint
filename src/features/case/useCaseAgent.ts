import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { initialCase, initialMessages, toDashboardCase } from './case.data'
import { AgentBlockKind, AgentMessage, CaseStage } from './case.types'
import { requestSolarReply } from '../../agent/client/agent-api'
import { AgentUIBlock } from '../../agent/schemas/agent-output'
import { DocumentProgress } from '../../agent/schemas/document-pipeline'
import { processDocuments } from '../../agent/client/document-api'
import { confirmDocumentField } from '../../agent/documents/run-document-pipeline'

const blockFromUI = (ui: AgentUIBlock[]): AgentBlockKind | undefined => {
  const map: Partial<Record<AgentUIBlock['type'], AgentBlockKind>> = {
    CHOICE: 'choice',
    DATE_INPUT: 'date',
    DOCUMENT_UPLOAD: 'upload',
    EXTRACTION_CONFIRMATION: 'extract',
    FINANCIAL_INPUT: 'finance',
    RISK_ALERT: 'urgent',
    TASK_CARD: 'next',
    DOCUMENT_CHECKLIST: 'checklist',
    INSTITUTION: 'institution',
    COMMUNITY_REVIEW: 'review',
    PROGRESS_SUMMARY: 'text',
  }
  return ui[0] ? map[ui[0].type] : undefined
}

export function useCaseAgent() {
  const [agentCaseState, setAgentCaseState] = useState(initialCase)
  const [caseUi, setCaseUi] = useState({
    selectedDate: '',
    uploadedFile: '',
    extractionConfirmed: false,
    checklist: [true, true, false, false],
  })
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [activeMenu, setActiveMenu] = useState('AI 홈')
  const [assetDraft, setAssetDraft] = useState(String(initialCase.financials.totalAssets ?? 0))
  const [debtDraft, setDebtDraft] = useState(String(initialCase.financials.totalDebts ?? 0))
  const [isResponding, setIsResponding] = useState(false)
  const [documentProgress, setDocumentProgress] = useState<DocumentProgress[]>([])
  const caseState = useMemo(() => toDashboardCase(agentCaseState, caseUi), [agentCaseState, caseUi])

  const stages: CaseStage[] = useMemo(() => [
    { label: '기본 정보 확인', state: '완료', done: true },
    { label: '서류 확인', state: caseState.documents >= 4 ? '완료' : '진행 중', done: caseState.documents >= 4 },
    { label: '재산·채무 확인', state: caseState.needsCheck === 0 ? '완료' : '진행 중', done: caseState.needsCheck === 0 },
    { label: '상담 준비', state: caseState.activeTasks === 0 ? '준비 완료' : '곧 진행 예정', done: caseState.activeTasks === 0 },
  ], [caseState])

  const addAgent = (text: string, block?: AgentBlockKind, ui?: AgentUIBlock[]) => {
    setMessages((current) => [...current, {
      id: Date.now() + current.length,
      role: 'agent',
      text,
      block,
      ui,
    }])
  }

  const send = async (event?: FormEvent) => {
    event?.preventDefault()
    const question = input.trim()
    if (!question || isResponding) return
    const userMessage: AgentMessage = { id: Date.now(), role: 'user', text: question }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setIsResponding(true)

    try {
      const reply = await requestSolarReply(question, agentCaseState, undefined, nextMessages)
      setAgentCaseState(reply.caseState)
      addAgent(reply.output.message, blockFromUI(reply.output.ui), reply.output.ui)
    } catch (error) {
      const message = error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.'
      addAgent(`연결 중 문제가 생겼어요. ${message}`)
    } finally {
      setIsResponding(false)
    }
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

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    setCaseUi((state) => ({ ...state, uploadedFile: files.length === 1 ? files[0].name : `${files.length}개 파일` }))
    setIsResponding(true)
    try {
      const result = await processDocuments(files, agentCaseState, setDocumentProgress)
      setAgentCaseState(result.caseState)
      addAgent(result.output.message, blockFromUI(result.output.ui), result.output.ui)
    } catch (error) {
      const message = error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.'
      addAgent(`이 파일에서는 내용을 충분히 확인하지 못했어요. ${message}`)
    } finally {
      setIsResponding(false)
      event.target.value = ''
    }
  }

  const confirmExtraction = () => {
    setCaseUi((state) => ({ ...state, extractionConfirmed: true }))
    setAgentCaseState((state) => ({
      ...state,
      documents: state.documents.map((document) => document.status === 'NEEDS_CONFIRMATION'
        ? { ...document, status: 'VERIFIED' as const }
        : document),
      stage: 'CHECKING_MISSING_INFO',
      lastUpdatedAt: new Date().toISOString(),
    }))
    addAgent('서류 확인이 완료되어 대시보드에 반영했어요.', 'complete')
  }

  const confirmPipelineField = (documentId: string, fieldKey: string, value: string | number | null) => {
    if (value === null) {
      addAgent('이 값은 직접 입력한 뒤 확인할 수 있어요.', fieldKey === 'amount' ? 'finance' : 'extract')
      return
    }
    setAgentCaseState((state) => confirmDocumentField(state, documentId, fieldKey, value))
    addAgent('확인한 값을 사건 상태와 대시보드에 반영했어요.', 'complete')
  }

  const saveFinance = () => {
    const assets = Number(assetDraft) || 0
    const debts = Number(debtDraft) || 0
    setAgentCaseState((state) => ({
      ...state,
      stage: debts > assets ? 'URGENT_REVIEW' : 'IN_PROGRESS',
      financials: {
        assets: [{ id: 'asset-user', category: 'ASSET', type: 'OTHER', institution: null, amount: assets, amountStatus: 'VERIFIED', source: 'USER_INPUT', sourceDocumentId: null }],
        debts: [{ id: 'debt-user', category: 'DEBT', type: 'OTHER', institution: null, amount: debts, amountStatus: 'VERIFIED', source: 'USER_INPUT', sourceDocumentId: null }],
        totalAssets: assets,
        totalDebts: debts,
        difference: assets - debts,
        hasUnverifiedItems: false,
      },
      missingFields: state.missingFields.map((field) => ({ ...field, resolved: true })),
      lastUpdatedAt: new Date().toISOString(),
    }))
    addAgent('자산·채무 금액을 저장했고 확인 필요 항목을 해결했어요.', 'complete')
  }

  const completeTask = () => {
    setAgentCaseState((state) => {
      const target = state.tasks.find((task) => task.status === 'IN_PROGRESS' || task.status === 'NOT_STARTED')
      return {
        ...state,
        tasks: state.tasks.map((task) => task.id === target?.id ? { ...task, status: 'COMPLETED' as const, readiness: 100 } : task),
        lastUpdatedAt: new Date().toISOString(),
      }
    })
    addAgent('업무를 완료 처리했어요. 진행률과 오늘 할 일을 갱신했습니다.', 'complete')
  }

  const toggleChecklist = (index: number) => {
    setCaseUi((state) => {
      const checklist = [...state.checklist]
      checklist[index] = !checklist[index]
      return { ...state, checklist }
    })
  }

  const setSelectedDate = (selectedDate: string) =>
    setCaseUi((state) => ({ ...state, selectedDate }))

  return {
    caseState,
    agentCaseState,
    messages,
    input,
    activeMenu,
    assetDraft,
    debtDraft,
    isResponding,
    documentProgress,
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
    confirmPipelineField,
    saveFinance,
    completeTask,
    toggleChecklist,
  }
}

export type CaseAgentController = ReturnType<typeof useCaseAgent>
