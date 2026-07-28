import { AgentUIBlock, SuggestedAction } from './types'
import { CaseState } from '../schemas/case-state'
import { CaseTools, FinancialSummary } from '../tools/case-tools'
import { ActionSelection } from './action-selector'

export type ExecutionResult = {
  state: CaseState
  ui: AgentUIBlock[]
  facts: string[]
  suggestedActions: SuggestedAction[]
  usedTools: string[]
  failed: boolean
  financialSummary?: FinancialSummary
}

const logTool = (caseId: string, tool: string, success: boolean, startedAt: number) => {
  console.info(JSON.stringify({ caseId, tool, success, durationMs: Date.now() - startedAt }))
}

export async function executeSelection(selection: ActionSelection, state: CaseState, tools: CaseTools): Promise<ExecutionResult> {
  const result: ExecutionResult = { state, ui: [], facts: [], suggestedActions: [], usedTools: [], failed: false }

  const run = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    if (result.usedTools.length >= 3) throw new Error('TOOL_LIMIT_REACHED')
    const startedAt = Date.now()
    try {
      const value = await operation()
      result.usedTools.push(name)
      logTool(state.caseId, name, true, startedAt)
      return value
    } catch (error) {
      logTool(state.caseId, name, false, startedAt)
      throw error
    }
  }

  try {
    switch (selection.action) {
      case 'ONBOARD':
        result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, { stage: 'COLLECTING_BASIC_INFO' }))
        result.ui.push({ type: 'CHOICE', prompt: '먼저 어떤 정보부터 확인할까요?', options: [{ id: 'basic_info', label: '기본 정보 확인' }, { id: 'later', label: '나중에 이어하기' }] })
        break
      case 'UPLOAD':
        result.ui.push({ type: 'DOCUMENT_UPLOAD', accept: ['.pdf', '.jpg', '.jpeg', '.png'], taskId: state.currentFocus.id })
        result.suggestedActions.push({ id: 'later', label: '나중에 올리기' })
        break
      case 'CONFIRM_EXTRACTION': {
        const document = state.documents.find((item) => item.status === 'NEEDS_CONFIRMATION')
        if (document) result.ui.push({ type: 'EXTRACTION_CONFIRMATION', documentId: document.id, fields: document.extractedFields.map((field) => ({ key: field.key, value: field.value, needsReview: field.verificationStatus === 'NEEDS_REVIEW' })) })
        else result.ui.push({ type: 'DOCUMENT_UPLOAD', accept: ['.pdf', '.jpg', '.jpeg', '.png'], taskId: state.currentFocus.id })
        break
      }
      case 'FINANCIAL_INPUT':
        result.ui.push({ type: 'FINANCIAL_INPUT', category: 'BOTH', itemId: null })
        break
      case 'SHOW_STATUS': {
        result.state = await run('getCaseState', () => tools.getCaseState(state.caseId))
        const completed = result.state.tasks.filter((task) => task.status === 'COMPLETED').length
        result.ui.push({ type: 'PROGRESS_SUMMARY', progress: calculateProgress(result.state), completedTasks: completed, totalTasks: result.state.tasks.length })
        break
      }
      case 'SHOW_NEXT_TASK': {
        const tasks = await run('getPrioritizedTasks', () => tools.getPrioritizedTasks(state.caseId))
        const task = tasks[0]
        if (task) result.ui.push({ type: 'TASK_CARD', taskId: task.id, title: task.title, priority: task.priority, readiness: task.readiness, actions: [{ id: 'continue', label: '이어하기' }, { id: 'later', label: '나중에 확인' }] })
        break
      }
      case 'SHOW_DOCUMENTS': {
        const tasks = await run('getPrioritizedTasks', () => tools.getPrioritizedTasks(state.caseId))
        const task = tasks[0]
        const items = task ? await run('matchRequiredDocuments', () => tools.matchRequiredDocuments(state.caseId, task.id)) : []
        result.ui.push({ type: 'DOCUMENT_CHECKLIST', taskId: task?.id ?? null, items: items.map((item) => ({ id: item.type, label: item.label, verified: item.verified })) })
        break
      }
      case 'SHOW_DEADLINE': {
        const deadlines = await run('calculateDeadlines', () => tools.calculateDeadlines(state.caseId))
        const known = deadlines.filter((item) => item.deadline !== null)
        result.facts = known.length ? known.map((item) => `${item.deadline} · ${item.daysRemaining}일 남음${item.verified ? '' : ' · 공식 출처 확인 필요'}`) : ['현재 검증된 기한 정보가 없어 확인이 필요합니다.']
        break
      }
      case 'CHECK_FINANCIAL_RISK':
      case 'LEGAL_BOUNDARY': {
        const summary = await run('calculateFinancialSummary', () => tools.calculateFinancialSummary(state.caseId))
        result.state = await run('getCaseState', () => tools.getCaseState(state.caseId))
        const deadlines = await run('calculateDeadlines', () => tools.calculateDeadlines(state.caseId))
        result.financialSummary = summary
        const deadlineFact = deadlines.find((item) => item.deadline)
        result.facts = [
          `현재 입력 기준 자산 ${summary.totalAssets.toLocaleString('ko-KR')}원`,
          `현재 입력 기준 채무 ${summary.totalDebts.toLocaleString('ko-KR')}원`,
          `차이 ${summary.difference.toLocaleString('ko-KR')}원`,
          summary.hasUnverifiedItems ? '미확인 또는 추정 항목이 있습니다.' : '모든 금액이 확인 상태입니다.',
          deadlineFact ? `관련 검토 기한 ${deadlineFact.deadline}${deadlineFact.verified ? '' : ' · 공식 출처 확인 필요'}` : '관련 검토 기한 확인 필요',
        ]
        result.ui.push({
          type: 'RISK_ALERT',
          level: summary.riskLevel === 'URGENT_REVIEW' ? 'URGENT_REVIEW' : summary.riskLevel === 'NEEDS_REVIEW' ? 'WARNING' : 'INFO',
          title: summary.riskLevel === 'URGENT_REVIEW' ? '부채 초과 가능성 긴급 검토' : '자산·채무 확인 결과',
          facts: result.facts,
          disclaimer: '현재 확인된 자료 기준이며 정보 제공일 뿐 법률 자문이 아닙니다.',
        })
        result.suggestedActions.push({ id: 'prepare_consultation', label: '전문가 상담 준비' }, { id: 'verify_amounts', label: '미확인 금액 확인' })
        break
      }
      case 'SHOW_INSTITUTION': {
        const results = await run('findLocalInstitutions', () => tools.findLocalInstitutions(state.user.region.district, state.currentFocus.type || 'GENERAL'))
        result.ui.push({ type: 'INSTITUTION', results })
        break
      }
      case 'SHOW_COMMUNITY_REVIEW': {
        const reviews = await run('searchCommunityReviews', () => tools.searchCommunityReviews({ taskType: state.currentFocus.type || undefined, relation: state.user.relationToDeceased, region: state.user.region.city, limit: 3 }))
        result.ui.push({ type: 'COMMUNITY_REVIEW', reviews, disclaimer: '개인의 경험이며 공식 안내나 법률 자문이 아닙니다. 필요한 서류는 공식 기관에도 확인해 주세요.' })
        break
      }
      case 'COMPLETE_TASK': {
        const tasks = await run('getPrioritizedTasks', () => tools.getPrioritizedTasks(state.caseId))
        if (tasks[0]) result.state = await run('updateTaskStatus', () => tools.updateTaskStatus(state.caseId, tasks[0].id, 'COMPLETED'))
        break
      }
      case 'PAUSE':
        result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
          emotionalContext: { ...state.emotionalContext, userRequestedPause: true },
        }))
        result.suggestedActions.push({ id: 'resume_later', label: '나중에 이어하기' })
        break
      case 'CHAT':
      case 'FALLBACK':
        break
    }
  } catch {
    result.failed = true
    result.ui = [{ type: 'CHOICE', prompt: '지금은 자동 처리를 완료하지 못했어요. 어떤 방식으로 이어갈까요?', options: [{ id: 'manual_input', label: '직접 입력하기' }, { id: 'later', label: '나중에 진행' }] }]
    result.suggestedActions = [{ id: 'manual_input', label: '직접 입력하기' }, { id: 'later', label: '나중에 진행' }]
  }

  return result
}

export const calculateProgress = (state: CaseState) => {
  if (!state.tasks.length) return state.onboardingCompleted ? 100 : 0
  const total = state.tasks.reduce((sum, task) => sum + (task.status === 'COMPLETED' ? 100 : task.readiness), 0)
  return Math.round(total / state.tasks.length)
}
