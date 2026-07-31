import { z } from 'zod'
import { CaseState, caseStateSchema, TaskState } from '../schemas/case-state'
import { StateRepository } from '../state/state-repository'

const idSchema = z.string().min(1)
const taskStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE'])

export type FinancialSummary = {
  totalAssets: number
  totalDebts: number
  difference: number
  hasUnverifiedItems: boolean
  riskLevel: 'NORMAL' | 'NEEDS_REVIEW' | 'URGENT_REVIEW'
}

export type CommunityReviewQuery = {
  taskType?: string
  relation?: string | null
  region?: string | null
  financialSituation?: string
  keywords?: string[]
  limit: number
}

export type TaskReadiness = {
  taskId: string
  readiness: number
  documents: Array<{
    type: string
    label: string
    status: 'HELD' | 'NEEDS_REVIEW' | 'MISSING' | 'NOT_APPLICABLE'
  }>
}

export type PreparationPackage = {
  taskId: string
  title: string
  readiness: number
  confirmedFacts: string[]
  unresolvedItems: string[]
  questionsForExpert: string[]
}

export interface CaseTools {
  getCaseState(caseId: string): Promise<CaseState>
  updateCaseState(caseId: string, patch: Partial<CaseState>): Promise<CaseState>
  parseDocument(fileId: string): Promise<{ documentId: string; status: 'NEEDS_CONFIRMATION'; fields: Array<{ key: string; value: string | number | null }> }>
  confirmExtractedField(caseId: string, documentId: string, fieldKey: string, value: string | number | null): Promise<CaseState>
  calculateFinancialSummary(caseId: string): Promise<FinancialSummary>
  calculateDeadlines(caseId: string): Promise<Array<{ taskId: string; deadline: string | null; daysRemaining: number | null; verified: boolean }>>
  detectMissingInformation(caseId: string): Promise<CaseState['missingFields']>
  getPrioritizedTasks(caseId: string): Promise<TaskState[]>
  matchRequiredDocuments(caseId: string, taskId: string): Promise<TaskState['requiredDocuments']>
  findLocalInstitutions(district: string | null, taskType: string): Promise<Array<{ id: string; name: string; district: string; sourceUrl: string | null; verification: 'MOCK_NEEDS_VERIFICATION' }>>
  searchCommunityReviews(query: CommunityReviewQuery): Promise<Array<{ id: string; excerpt: string; reason: string; createdAt: string; helpfulCount: number; url: string | null; label: '사용자 경험' }>>
  updateTaskStatus(caseId: string, taskId: string, status: TaskState['status']): Promise<CaseState>
  generatePersonalProcedure(caseId: string): Promise<TaskState[]>
  selectPriorityTask(caseId: string): Promise<TaskState | null>
  calculateTaskReadiness(caseId: string, taskId: string): Promise<TaskReadiness>
  buildPreparationPackage(caseId: string, taskId: string): Promise<PreparationPackage>
  confirmTaskCompletion(caseId: string, taskId: string): Promise<CaseState>
  generateNextTask(caseId: string): Promise<TaskState | null>
}

export class CaseToolsService implements CaseTools {
  constructor(private repository: StateRepository, private now = () => new Date()) {}

  getCaseState(caseId: string) {
    return this.repository.getCaseState(idSchema.parse(caseId))
  }

  updateCaseState(caseId: string, patch: Partial<CaseState>) {
    return this.repository.updateCaseState(idSchema.parse(caseId), caseStateSchema.partial().parse(patch))
  }

  async parseDocument(fileId: string) {
    idSchema.parse(fileId)
    return { documentId: fileId, status: 'NEEDS_CONFIRMATION' as const, fields: [] }
  }

  async confirmExtractedField(caseId: string, documentId: string, fieldKey: string, value: string | number | null) {
    const state = await this.getCaseState(caseId)
    const documents = state.documents.map((document) => document.id !== documentId ? document : {
      ...document,
      status: 'VERIFIED' as const,
      extractedFields: document.extractedFields.map((field) => field.key !== fieldKey ? field : {
        ...field, value, verificationStatus: 'VERIFIED' as const, verifiedByUser: true,
      }),
    })
    return this.updateCaseState(caseId, { documents })
  }

  async calculateFinancialSummary(caseId: string): Promise<FinancialSummary> {
    const state = await this.getCaseState(caseId)
    const items = [...state.financials.assets, ...state.financials.debts]
    const totalAssets = state.financials.assets.reduce((sum, item) => sum + (item.amount ?? 0), 0)
    const totalDebts = state.financials.debts.reduce((sum, item) => sum + (item.amount ?? 0), 0)
    const hasUnverifiedItems = items.some((item) => item.amountStatus !== 'VERIFIED' || item.amount === null)
    const difference = totalAssets - totalDebts
    const riskLevel = difference < 0 ? 'URGENT_REVIEW' : hasUnverifiedItems ? 'NEEDS_REVIEW' : 'NORMAL'
    await this.updateCaseState(caseId, {
      stage: riskLevel === 'URGENT_REVIEW' ? 'URGENT_REVIEW' : state.stage,
      financials: { ...state.financials, totalAssets, totalDebts, difference, hasUnverifiedItems },
    })
    return { totalAssets, totalDebts, difference, hasUnverifiedItems, riskLevel }
  }

  async calculateDeadlines(caseId: string) {
    const state = await this.getCaseState(caseId)
    const today = this.now()
    return state.tasks.map((task) => {
      if (!task.deadline) return { taskId: task.id, deadline: null, daysRemaining: null, verified: false }
      const deadline = new Date(`${task.deadline}T00:00:00`)
      const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000)
      return { taskId: task.id, deadline: task.deadline, daysRemaining, verified: task.officialSourceIds.length > 0 }
    })
  }

  async detectMissingInformation(caseId: string) {
    return (await this.getCaseState(caseId)).missingFields.filter((field) => !field.resolved)
  }

  async getPrioritizedTasks(caseId: string) {
    const rank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 }
    return (await this.getCaseState(caseId)).tasks
      .filter((task) => task.status !== 'COMPLETED' && task.status !== 'NOT_APPLICABLE')
      .sort((a, b) => rank[a.priority] - rank[b.priority])
  }

  async matchRequiredDocuments(caseId: string, taskId: string) {
    const task = (await this.getCaseState(caseId)).tasks.find((item) => item.id === idSchema.parse(taskId))
    if (!task) throw new Error('TASK_NOT_FOUND')
    return task.requiredDocuments
  }

  async findLocalInstitutions(district: string | null, taskType: string) {
    void district
    z.string().min(1).parse(taskType)
    return []
  }

  async searchCommunityReviews(query: CommunityReviewQuery) {
    z.number().int().min(1).max(10).parse(query.limit)
    return []
  }

  async updateTaskStatus(caseId: string, taskId: string, status: TaskState['status']) {
    const state = await this.getCaseState(caseId)
    const parsedStatus = taskStatusSchema.parse(status)
    const tasks = state.tasks.map((task) => task.id === idSchema.parse(taskId) ? { ...task, status: parsedStatus } : task)
    return this.updateCaseState(caseId, { tasks })
  }

  async generatePersonalProcedure(caseId: string) {
    const state = await this.getCaseState(caseId)
    const verifiedTypes = new Set<string>(
      state.documents.filter((document) => document.status === 'VERIFIED').map((document) => document.type),
    )
    const required = [
      ['DEATH_CERTIFICATE', '사망진단서'],
      ['FAMILY_RELATION_CERTIFICATE', '가족관계증명서'],
      ['FINANCIAL_DEBT_DOCUMENT', '안심상속 조회 결과'],
      ['BASIC_CERTIFICATE', '고인의 기본증명서'],
      ['RESIDENT_REGISTRATION', '상속인의 주민등록등본'],
    ] as const
    const requiredDocuments = required.map(([type, label]) => ({
      type,
      label,
      required: true,
      verified: verifiedTypes.has(type),
    }))
    const hasPendingFinancialResult = state.financials.hasUnverifiedItems
    const awarenessDateMissing = state.deceased.inheritanceAwarenessDate === null
    const debtExceedsAssets = state.financials.difference !== null && state.financials.difference < 0
    const tasks: TaskState[] = []

    if (hasPendingFinancialResult) {
      tasks.push({
        id: 'verify-pending-financial-result',
        type: 'VERIFY_PENDING_FINANCIAL_RESULT',
        title: '처리 중인 금융 조회 결과 확인',
        priority: 'URGENT',
        status: 'IN_PROGRESS',
        deadline: null,
        daysRemaining: null,
        readiness: 50,
        requiredDocuments: requiredDocuments.filter((item) => item.type === 'FINANCIAL_DEBT_DOCUMENT'),
        officialSourceIds: [],
        category: 'FINANCIAL',
        reason: '금융 조회 결과에 아직 금액이 확인되지 않은 기관이 있어 현재 자산·채무 합계를 최종 상태로 볼 수 없어요.',
        dependsOnTaskIds: [],
        basisFacts: ['미확인 금융 항목 존재', ...state.warnings.filter((warning) => warning.type === 'MISSING_INFORMATION').map((warning) => warning.message)],
        applicability: 'CONFIRMED',
      })
    }

    if (awarenessDateMissing) {
      tasks.push({
        id: 'confirm-inheritance-awareness-date',
        type: 'CONFIRM_INHERITANCE_AWARENESS_DATE',
        title: '상속 사실을 알게 된 날짜 확인',
        priority: 'HIGH',
        status: 'NOT_STARTED',
        deadline: null,
        daysRemaining: null,
        readiness: 0,
        requiredDocuments: [],
        officialSourceIds: [],
        category: 'INFORMATION',
        reason: '관련 검토 기한을 계산하려면 기준이 되는 날짜를 먼저 확인해야 해요.',
        dependsOnTaskIds: [],
        basisFacts: ['상속 사실 인지일 미입력'],
        applicability: 'CONFIRMED',
      })
    }

    if (debtExceedsAssets || hasPendingFinancialResult) {
      tasks.push({
        id: 'prepare-inheritance-consultation',
        type: 'PREPARE_INHERITANCE_CONSULTATION',
        title: '상속 방법 전문가 검토 준비',
        priority: debtExceedsAssets ? 'HIGH' : 'NORMAL',
        status: 'NOT_STARTED',
        deadline: null,
        daysRemaining: null,
        readiness: 0,
        requiredDocuments,
        officialSourceIds: [],
        category: 'CONSULTATION',
        reason: debtExceedsAssets
          ? '현재 확인된 채무가 자산보다 많아 법률적 결론을 내리기 전에 전문가 검토 준비가 필요해요.'
          : '금융 조회가 모두 끝난 뒤 확인된 자료를 바탕으로 전문가에게 검토받을 준비가 필요해요.',
        dependsOnTaskIds: [
          ...(hasPendingFinancialResult ? ['verify-pending-financial-result'] : []),
          ...(awarenessDateMissing ? ['confirm-inheritance-awareness-date'] : []),
        ],
        basisFacts: [
          ...(state.financials.totalAssets !== null ? [`확인된 자산 ${state.financials.totalAssets.toLocaleString('ko-KR')}원`] : []),
          ...(state.financials.totalDebts !== null ? [`확인된 채무 ${state.financials.totalDebts.toLocaleString('ko-KR')}원`] : []),
          ...(debtExceedsAssets ? [`채무가 자산보다 ${Math.abs(state.financials.difference ?? 0).toLocaleString('ko-KR')}원 많음`] : []),
        ],
        applicability: 'REVIEW_REQUIRED',
      })
    }

    tasks.push({
      id: 'confirm-death-report',
      type: 'CONFIRM_DEATH_REPORT',
      title: '사망신고 처리 여부 확인',
      priority: 'NORMAL',
      status: 'NOT_STARTED',
      deadline: null,
      daysRemaining: null,
      readiness: verifiedTypes.has('DEATH_CERTIFICATE') ? 100 : 0,
      requiredDocuments: requiredDocuments.filter((item) => item.type === 'DEATH_CERTIFICATE'),
      officialSourceIds: [],
      category: 'OFFICIAL_PROCESS',
      reason: '사망진단서는 확인됐지만 실제 신고 처리 완료 여부는 문서 분석 결과만으로 알 수 없어 별도 확인이 필요해요.',
      dependsOnTaskIds: [],
      basisFacts: [verifiedTypes.has('DEATH_CERTIFICATE') ? '사망진단서 보유' : '사망진단서 미확인', '사망신고 완료 여부 미확인'],
      applicability: 'REVIEW_REQUIRED',
    })

    const previousById = new Map(state.tasks.map((task) => [task.id, task]))
    const personalizedTasks = tasks.map((task) => {
      const previous = previousById.get(task.id)
      return previous?.status === 'COMPLETED'
        ? { ...task, status: 'COMPLETED' as const, readiness: 100 }
        : task
    })
    await this.updateCaseState(caseId, { tasks: personalizedTasks })
    return personalizedTasks
  }

  async selectPriorityTask(caseId: string) {
    const state = await this.getCaseState(caseId)
    const prioritized = await this.getPrioritizedTasks(caseId)
    const statusById = new Map(state.tasks.map((task) => [task.id, task.status]))
    return prioritized.find((task) =>
      (task.dependsOnTaskIds ?? []).every((dependencyId) => {
        const status = statusById.get(dependencyId)
        return status === 'COMPLETED' || status === 'NOT_APPLICABLE'
      }),
    ) ?? null
  }

  async calculateTaskReadiness(caseId: string, taskId: string): Promise<TaskReadiness> {
    const state = await this.getCaseState(caseId)
    const task = state.tasks.find((item) => item.id === idSchema.parse(taskId))
    if (!task) throw new Error('TASK_NOT_FOUND')
    const documentByType = new Map(state.documents.map((document) => [document.type, document]))
    const documents = task.requiredDocuments.map((required) => {
      const document = documentByType.get(required.type as CaseState['documents'][number]['type'])
      return {
        type: required.type,
        label: required.label,
        status: !required.required
          ? 'NOT_APPLICABLE' as const
          : document?.status === 'VERIFIED'
            ? 'HELD' as const
            : document
              ? 'NEEDS_REVIEW' as const
              : 'MISSING' as const,
      }
    })
    const requiredDocuments = documents.filter((item) => item.status !== 'NOT_APPLICABLE')
    const readiness = requiredDocuments.length
      ? Math.round(requiredDocuments.filter((item) => item.status === 'HELD').length / requiredDocuments.length * 100)
      : 100
    const tasks = state.tasks.map((item) => item.id === task.id ? { ...item, readiness } : item)
    await this.updateCaseState(caseId, { tasks })
    return { taskId: task.id, readiness, documents }
  }

  async buildPreparationPackage(caseId: string, taskId: string): Promise<PreparationPackage> {
    const state = await this.getCaseState(caseId)
    const task = state.tasks.find((item) => item.id === idSchema.parse(taskId))
    if (!task) throw new Error('TASK_NOT_FOUND')
    const readiness = await this.calculateTaskReadiness(caseId, task.id)
    const confirmedFacts = [
      state.deceased.deathDate ? `확인된 사망일 ${state.deceased.deathDate}` : null,
      state.financials.totalAssets !== null ? `확인된 자산 ${state.financials.totalAssets.toLocaleString('ko-KR')}원` : null,
      state.financials.totalDebts !== null ? `확인된 채무 ${state.financials.totalDebts.toLocaleString('ko-KR')}원` : null,
    ].filter((item): item is string => Boolean(item))
    const unresolvedItems = [
      ...state.missingFields.filter((field) => !field.resolved).map((field) => field.label),
      ...readiness.documents.filter((item) => item.status !== 'HELD' && item.status !== 'NOT_APPLICABLE').map((item) => item.label),
    ]
    return {
      taskId: task.id,
      title: task.title,
      readiness: readiness.readiness,
      confirmedFacts,
      unresolvedItems: [...new Set(unresolvedItems)],
      questionsForExpert: [
        '현재 확인된 자산과 채무를 기준으로 어떤 절차를 검토해야 하나요?',
        '아직 처리 중인 금융기관 조회 결과를 기다려야 하나요?',
        '검토 기한은 어떤 날짜를 기준으로 계산해야 하나요?',
      ],
    }
  }

  async confirmTaskCompletion(caseId: string, taskId: string) {
    return this.updateTaskStatus(caseId, taskId, 'COMPLETED')
  }

  async generateNextTask(caseId: string) {
    return this.selectPriorityTask(caseId)
  }
}

/** 테스트에서만 명시적으로 주입하는 별칭입니다. */
export class MockCaseTools extends CaseToolsService {}
