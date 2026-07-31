import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { toDashboardCase } from './case.data'
import { AgentBlockKind, AgentMessage, CaseStage, UploadedDocument } from './case.types'
import { requestSolarReply } from '../../agent/client/agent-api'
import { AgentUIBlock } from '../../agent/schemas/agent-output'
import { DocumentProgress } from '../../agent/schemas/document-pipeline'
import { processDocuments } from '../../agent/client/document-api'
import { confirmAllDocumentFields, confirmDocumentField } from '../../agent/document-processing/run-document-pipeline'
import { resolveCaseScenario } from './case.scenario'

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
  const [scenario] = useState(() => resolveCaseScenario(window.location.search))
  const [agentCaseState, setAgentCaseState] = useState(scenario.caseState)
  const [caseUi, setCaseUi] = useState({
    selectedDate: '',
    uploadedFile: '',
    extractionConfirmed: false,
    checklist: [true, true, false, false],
  })
  const [messages, setMessages] = useState<AgentMessage[]>(scenario.messages)
  const [input, setInput] = useState('')
  const [activeMenu, setActiveMenu] = useState('AI 홈')
  const [assetDraft, setAssetDraft] = useState(scenario.caseState.financials.totalAssets === null ? '' : String(scenario.caseState.financials.totalAssets))
  const [debtDraft, setDebtDraft] = useState(scenario.caseState.financials.totalDebts === null ? '' : String(scenario.caseState.financials.totalDebts))
  const [isResponding, setIsResponding] = useState(false)
  const [responseStatus, setResponseStatus] = useState('답변을 준비하고 있어요…')
  const [documentProgress, setDocumentProgress] = useState<DocumentProgress[]>([])
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([])
  const [previewDocument, setPreviewDocument] = useState<UploadedDocument | null>(null)
  const uploadedDocumentsRef = useRef<UploadedDocument[]>([])
  const onboardingStartedRef = useRef(false)
  const caseState = useMemo(() => toDashboardCase(agentCaseState, caseUi), [agentCaseState, caseUi])

  useEffect(() => {
    uploadedDocumentsRef.current = uploadedDocuments
  }, [uploadedDocuments])

  useEffect(() => () => {
    uploadedDocumentsRef.current.forEach((document) => URL.revokeObjectURL(document.url))
  }, [])

  const stages: CaseStage[] = useMemo(() => {
    const onboardingStarted = Object.values(agentCaseState.onboarding)
      .some((value) => value === 'COMPLETED' || value === 'NOT_COMPLETED')
    const basicDone = agentCaseState.onboardingCompleted
    const documentsStarted = agentCaseState.documents.length > 0
    const documentsDone = documentsStarted
      && agentCaseState.documents.every((document) => document.status === 'VERIFIED')
    const financialsStarted = agentCaseState.financials.totalAssets !== null
      || agentCaseState.financials.totalDebts !== null
      || agentCaseState.financials.assets.length > 0
      || agentCaseState.financials.debts.length > 0
    const financialsDone = agentCaseState.financials.totalAssets !== null
      && agentCaseState.financials.totalDebts !== null
      && !agentCaseState.financials.hasUnverifiedItems
    const consultationTasks = agentCaseState.tasks.filter((task) => task.category === 'CONSULTATION')
    const consultationStarted = consultationTasks.length > 0
    const consultationDone = consultationStarted
      && consultationTasks.every((task) => task.status === 'COMPLETED' || task.status === 'NOT_APPLICABLE')

    const currentIndex = !basicDone ? 0 : !documentsDone ? 1 : !financialsDone ? 2 : 3
    return [
      { label: '기본 정보 확인', state: basicDone ? '완료' : onboardingStarted ? '확인 중' : '시작 전', done: basicDone },
      { label: '서류 확인', state: documentsDone ? '완료' : documentsStarted ? '확인 중' : '대기', done: documentsDone },
      { label: '재산·채무 확인', state: financialsDone ? '완료' : financialsStarted ? '확인 중' : '대기', done: financialsDone },
      { label: '상담 준비', state: consultationDone ? '완료' : consultationStarted ? '준비 중' : '대기', done: consultationDone },
    ].map((stage, index) => ({ ...stage, current: index === currentIndex }))
  }, [agentCaseState])

  const addAgent = (text: string, block?: AgentBlockKind, ui?: AgentUIBlock[]) => {
    setMessages((current) => [...current, {
      id: Date.now() + current.length,
      role: 'agent',
      text,
      block,
      ui,
    }])
  }

  useEffect(() => {
    if (onboardingStartedRef.current || agentCaseState.stage !== 'FIRST_VISIT' || agentCaseState.onboardingCompleted) return
    onboardingStartedRef.current = true
    setIsResponding(true)
    setResponseStatus('현재 상황을 먼저 확인하고 있어요…')

    const startOnboarding = async () => {
      try {
        const reply = await requestSolarReply(
          '서비스를 시작하고 현재 처리 상태부터 확인해줘',
          agentCaseState,
          'START_ONBOARDING',
          messages,
        )
        setAgentCaseState(reply.caseState)
        setMessages((current) => [...current, {
          id: Date.now() + current.length,
          role: 'agent',
          text: reply.output.message,
          block: blockFromUI(reply.output.ui),
          ui: reply.output.ui,
        }])
      } catch {
        const ui: AgentUIBlock[] = [{
          type: 'CHOICE',
          prompt: '사망신고는 이미 마쳤어?',
          options: [
            { id: 'onboarding_death_completed', label: '이미 신고했어' },
            { id: 'onboarding_death_not_completed', label: '아직 하지 않았어' },
            { id: 'onboarding_pause', label: '나중에 확인할게' },
          ],
        }]
        setAgentCaseState((state) => ({
          ...state,
          stage: 'COLLECTING_BASIC_INFO',
          onboarding: { ...state.onboarding, currentStep: 'DEATH_REPORT' },
        }))
        setMessages((current) => [...current, {
          id: Date.now() + current.length,
          role: 'agent',
          text: '서비스를 시작하기 전에 현재 처리 상태부터 차례로 확인할게. 한 번에 하나씩 물어볼게. 먼저, 사망신고는 이미 마쳤어?',
          block: 'choice',
          ui,
        }])
      } finally {
        setIsResponding(false)
      }
    }

    void startOnboarding()
  }, [agentCaseState, messages])

  const send = async (event?: FormEvent) => {
    event?.preventDefault()
    const question = input.trim()
    if (!question || isResponding) return
    const userMessage: AgentMessage = { id: Date.now(), role: 'user', text: question }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')

    if (/(문서|서류|파일).*(보낼|보내|올릴|올려|업로드|첨부)|(?:보낼|올릴|업로드|첨부).*(문서|서류|파일)/.test(question.replace(/\s+/g, ''))) {
      addAgent('좋아. 아래에서 문서를 선택해줘. 파일을 올리면 문서 종류와 중요한 내용을 확인해서 보기 쉽게 정리해줄게.', 'upload')
      return
    }

    setIsResponding(true)
    setResponseStatus('답변을 준비하고 있어요…')

    try {
      const reply = await requestSolarReply(question, agentCaseState, undefined, nextMessages)
      setAgentCaseState(reply.caseState)
      addAgent(reply.output.message, blockFromUI(reply.output.ui), reply.output.ui)
    } catch (error) {
      const message = error instanceof Error ? error.message : '잠시 후 다시 시도해줘.'
      addAgent(`연결하는 중에 문제가 생겼어. ${message}`)
    } finally {
      setIsResponding(false)
    }
  }

  const advanceWorkflow = async () => {
    if (isResponding) return
    const userMessage: AgentMessage = { id: Date.now(), role: 'user', text: '다음 준비 단계로 진행해줘' }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setIsResponding(true)
    setResponseStatus('다음 업무를 정리하고 있어요…')
    try {
      const reply = await requestSolarReply('다음 준비 단계로 진행해줘', agentCaseState, 'CONTINUE_WORKFLOW', nextMessages)
      setAgentCaseState(reply.caseState)
      addAgent(reply.output.message, blockFromUI(reply.output.ui), reply.output.ui)
    } catch (error) {
      const message = error instanceof Error ? error.message : '잠시 후 다시 시도해줘.'
      addAgent(`다음 단계를 진행하지 못했어. ${message}`)
    } finally {
      setIsResponding(false)
    }
  }

  const handleUiAction = (actionId: string, label: string) => {
    if (actionId === 'onboarding_pause') {
      setAgentCaseState((state) => ({
        ...state,
        emotionalContext: { ...state.emotionalContext, userRequestedPause: true },
        lastUpdatedAt: new Date().toISOString(),
      }))
      addAgent('응, 지금까지 확인한 상태로 저장해둘게. 준비되면 여기서 다시 이어가면 돼.')
      return
    }
    if (actionId === 'onboarding_death_completed' || actionId === 'onboarding_death_not_completed') {
      const completed = actionId === 'onboarding_death_completed'
      setAgentCaseState((state) => ({
        ...state,
        onboarding: {
          ...state.onboarding,
          deathReportStatus: completed ? 'COMPLETED' : 'NOT_COMPLETED',
          currentStep: 'FINANCIAL_INQUIRY',
        },
        tasks: completed
          ? state.tasks.map((task) => task.type === 'CONFIRM_DEATH_REPORT'
            ? { ...task, status: 'COMPLETED' as const, readiness: 100 }
            : task)
          : state.tasks,
        lastUpdatedAt: new Date().toISOString(),
      }))
      const ui: AgentUIBlock[] = [{
        type: 'CHOICE',
        prompt: '고인의 금융재산과 채무를 확인하는 금융조회는 진행했어?',
        options: [
          { id: 'onboarding_financial_completed', label: '조회했어' },
          { id: 'onboarding_financial_not_completed', label: '아직 안 했어' },
          { id: 'onboarding_pause', label: '나중에 확인할게' },
        ],
      }]
      addAgent(
        `${completed ? '사망신고를 마친 것으로 저장했어.' : '아직 하지 않은 것으로 저장했어. 준비 방법은 상태 확인을 마친 뒤 가장 먼저 연결해줄게.'}\n\n고인의 금융재산과 채무를 확인하는 금융조회는 진행했어?`,
        'choice',
        ui,
      )
      return
    }
    if (actionId === 'onboarding_financial_completed' || actionId === 'onboarding_financial_not_completed') {
      const completed = actionId === 'onboarding_financial_completed'
      setAgentCaseState((state) => ({
        ...state,
        onboarding: {
          ...state.onboarding,
          financialInquiryStatus: completed ? 'COMPLETED' : 'NOT_COMPLETED',
          currentStep: 'ONE_STOP_SERVICE',
        },
        lastUpdatedAt: new Date().toISOString(),
      }))
      const ui: AgentUIBlock[] = [{
        type: 'CHOICE',
        prompt: '안심상속 원스톱 서비스는 신청했어?',
        options: [
          { id: 'onboarding_one_stop_completed', label: '신청했어' },
          { id: 'onboarding_one_stop_not_completed', label: '아직 안 했어' },
          { id: 'onboarding_pause', label: '나중에 확인할게' },
        ],
      }]
      addAgent(
        `${completed ? '금융조회를 진행한 것으로 저장했어.' : '금융조회가 아직인 것으로 저장했어.'}\n\n마지막으로 한 가지만 더 확인할게. 안심상속 원스톱 서비스는 신청했어?`,
        'choice',
        ui,
      )
      return
    }
    if (actionId === 'onboarding_one_stop_completed' || actionId === 'onboarding_one_stop_not_completed') {
      const oneStopCompleted = actionId === 'onboarding_one_stop_completed'
      const deathPending = agentCaseState.onboarding.deathReportStatus === 'NOT_COMPLETED'
      const financialPending = agentCaseState.onboarding.financialInquiryStatus === 'NOT_COMPLETED'
      setAgentCaseState((state) => ({
        ...state,
        onboarding: {
          ...state.onboarding,
          oneStopServiceStatus: oneStopCompleted ? 'COMPLETED' : 'NOT_COMPLETED',
          currentStep: 'COMPLETE',
        },
        onboardingCompleted: true,
        stage: 'WAITING_FOR_DOCUMENT',
        lastUpdatedAt: new Date().toISOString(),
      }))

      let message = '기본 상태 확인을 마쳤어.'
      let prompt = '가지고 있는 문서를 올려서 다음 절차를 정리해볼까?'
      let options = [
        { id: 'onboarding_upload_documents', label: '문서 올리기' },
        { id: 'later', label: '나중에 이어가기' },
      ]
      if (deathPending) {
        message += ' 지금은 사망신고 준비가 가장 먼저야.'
        prompt = '사망신고 준비부터 같이 해볼까?'
        options = [{ id: 'show_death_report_steps', label: '준비 시작하기' }, { id: 'later', label: '나중에 이어가기' }]
      } else if (financialPending) {
        message += ' 다음으로 금융재산·채무 조회를 준비하는 게 좋아.'
        prompt = '금융조회에 필요한 문서부터 확인해볼까?'
        options = [{ id: 'onboarding_start_financial', label: '금융조회 준비하기' }, { id: 'later', label: '나중에 이어가기' }]
      } else if (!oneStopCompleted) {
        message += ' 다음으로 안심상속 원스톱 서비스 신청 여부를 정리하면 돼.'
        prompt = '원스톱 서비스 준비를 이어갈까?'
        options = [{ id: 'onboarding_start_one_stop', label: '준비하기' }, { id: 'later', label: '나중에 이어가기' }]
      }
      const ui: AgentUIBlock[] = [{ type: 'CHOICE', prompt, options }]
      addAgent(`${message}\n\n${prompt}`, 'choice', ui)
      return
    }
    if (actionId === 'onboarding_upload_documents' || actionId === 'onboarding_start_financial') {
      addAgent(
        actionId === 'onboarding_start_financial'
          ? '금융조회 결과 문서가 있다면 올려줘. 문서에서 확인된 금융재산과 채무를 정리해줄게.'
          : '가지고 있는 문서를 올려줘. 종류를 먼저 확인하고 필요한 내용만 하나씩 보여줄게.',
        'upload',
      )
      return
    }
    if (actionId === 'onboarding_start_one_stop') {
      addAgent('안심상속 원스톱 서비스 신청에 필요한 현재 정보를 먼저 확인할게. 공식 신청 경로와 준비 서류는 검증된 자료를 기준으로 연결해야 해.', 'upload')
      return
    }
    if ([
      'start_personal_procedure', 'show_first_task', 'collect_documents',
      'prepare_task', 'connect_official', 'confirm_completion', 'generate_next', 'continue',
    ].includes(actionId)) {
      void advanceWorkflow()
      return
    }
    if (actionId === 'show_death_report_steps') {
      setInput('사망신고 준비물을 정리해줘')
      return
    }
    if (actionId === 'death_report_not_started') {
      setInput('사망신고에 제출할 서류와 양식을 준비해줘')
      return
    }
    if (actionId === 'death_report_completed') {
      setAgentCaseState((state) => ({
        ...state,
        tasks: state.tasks.map((task) => task.type === 'CONFIRM_DEATH_REPORT'
          ? { ...task, status: 'COMPLETED' as const, readiness: 100 }
          : task),
        currentFocus: state.currentFocus.type === 'CONFIRM_DEATH_REPORT'
          ? { type: null, id: null }
          : state.currentFocus,
        lastUpdatedAt: new Date().toISOString(),
      }))
      addAgent('사망신고를 완료한 것으로 기록했어. 대시보드에 반영했고, 다음 필요한 업무도 이어서 확인할 수 있어.', 'complete')
      return
    }
    if (actionId === 'later' || actionId === 'resume_later') {
      addAgent('응, 지금 상태로 저장해둘게. 필요할 때 다시 이어갈 수 있어.')
      return
    }
    addAgent(`${label}을 선택했어.`)
  }

  const saveAwarenessDate = () => {
    if (!caseUi.selectedDate) {
      addAgent('날짜를 선택한 뒤 저장해줘.')
      return
    }
    setAgentCaseState((state) => ({
      ...state,
      deceased: { ...state.deceased, inheritanceAwarenessDate: caseUi.selectedDate },
      missingFields: state.missingFields.map((field) => field.field === 'deceased.inheritanceAwarenessDate'
        ? { ...field, resolved: true }
        : field),
      lastUpdatedAt: new Date().toISOString(),
    }))
    addAgent('상속 사실을 알게 된 날짜를 저장했어. 기한을 계산할 때는 공식 기준도 함께 확인해야 해.', 'complete')
  }

  const chooseQuick = async (label: string, block: AgentBlockKind) => {
    void block
    if (isResponding) return
    const userMessage: AgentMessage = { id: Date.now(), role: 'user', text: label }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setIsResponding(true)
    setResponseStatus(label.includes('기관') ? '공식 기관 정보를 찾고 있어요…' : label.includes('후기') ? '사용자 후기를 찾고 있어요…' : '현재 사건 상태를 확인하고 있어요…')
    try {
      const reply = await requestSolarReply(label, agentCaseState, undefined, nextMessages)
      setAgentCaseState(reply.caseState)
      addAgent(reply.output.message, blockFromUI(reply.output.ui), reply.output.ui)
    } catch (error) {
      const message = error instanceof Error ? error.message : '잠시 후 다시 시도해줘.'
      addAgent(`요청을 처리하지 못했어. ${message}`)
    } finally {
      setIsResponding(false)
    }
  }

  const menuAction = (label: string) => {
    setActiveMenu(label)
  }

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    const attachments = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
    }))
    setUploadedDocuments((current) => [...current, ...attachments])
    setActiveMenu('AI 홈')
    setMessages((current) => [...current, {
      id: Date.now(),
      role: 'user',
      text: files.length === 1 ? '문서를 업로드했어.' : `문서 ${files.length}개를 업로드했어.`,
      attachments,
    }])
    setCaseUi((state) => ({ ...state, uploadedFile: files.length === 1 ? files[0].name : `${files.length}개 파일` }))
    setIsResponding(true)
    setResponseStatus('문서를 확인 중이에요…')
    try {
      const result = await processDocuments(files, agentCaseState, setDocumentProgress)
      setAgentCaseState(result.caseState)
      addAgent(result.output.message, blockFromUI(result.output.ui), result.output.ui)
    } catch (error) {
      const message = error instanceof Error ? error.message : '잠시 후 다시 시도해줘.'
      addAgent(`이 파일에서는 내용을 충분히 확인하지 못했어. ${message}`)
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
    addAgent('서류 확인을 마치고 대시보드에 반영했어.', 'complete')
  }

  const confirmPipelineField = async (documentId: string, fieldKey: string, value: string | number | null) => {
    if (value === null) {
      addAgent('이 값은 직접 입력한 뒤 확인할 수 있어.', fieldKey === 'amount' ? 'finance' : 'extract')
      return
    }
    const nextState = confirmDocumentField(agentCaseState, documentId, fieldKey, value)
    setAgentCaseState(nextState)
    addAgent('확인한 값을 사건 상태와 대시보드에 반영했어.', 'complete')
    if (nextState.documents.length > 0 && nextState.documents.every((document) => document.status === 'VERIFIED')) {
      setIsResponding(true)
      setResponseStatus('확인한 문서를 바탕으로 다음 업무를 정리하고 있어요…')
      try {
        const reply = await requestSolarReply('문서 확인이 끝났어. 개인별 절차를 시작해줘.', nextState, 'CONTINUE_WORKFLOW', messages)
        setAgentCaseState(reply.caseState)
        addAgent(reply.output.message, blockFromUI(reply.output.ui), reply.output.ui)
      } finally {
        setIsResponding(false)
      }
    }
  }

  const confirmPipelineDocument = (documentId: string) => {
    const nextState = confirmAllDocumentFields(agentCaseState, documentId)
    setAgentCaseState(nextState)
    const document = nextState.documents.find((item) => item.id === documentId)
    addAgent(
      document?.status === 'VERIFIED'
        ? '확인한 내용을 사건 정보에 반영했어. 이제 이 문서를 기준으로 다음 업무를 정리할 수 있어.'
        : '확인한 값은 반영했어. 값이 비어 있거나 추가 확인이 필요한 항목은 하나씩 확인해줘.',
      'complete',
    )
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
    addAgent('자산·채무 금액을 저장했고 확인이 필요했던 항목도 해결했어.', 'complete')
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
    addAgent('업무를 완료 처리했어. 진행률과 오늘 할 일도 새로 반영했어.', 'complete')
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
    responseStatus,
    documentProgress,
    uploadedDocuments,
    previewDocument,
    stages,
    setInput,
    setAssetDraft,
    setDebtDraft,
    setSelectedDate,
    setPreviewDocument,
    addAgent,
    send,
    advanceWorkflow,
    handleUiAction,
    saveAwarenessDate,
    chooseQuick,
    menuAction,
    upload,
    confirmExtraction,
    confirmPipelineField,
    confirmPipelineDocument,
    saveFinance,
    completeTask,
    toggleChecklist,
  }
}

export type CaseAgentController = ReturnType<typeof useCaseAgent>
