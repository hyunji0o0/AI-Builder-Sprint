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
}

export class MockCaseTools implements CaseTools {
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
    z.string().min(1).parse(taskType)
    return [{
      id: 'mock-institution',
      name: '공식 기관 정보 확인 필요',
      district: district || '부산광역시',
      sourceUrl: null,
      verification: 'MOCK_NEEDS_VERIFICATION' as const,
    }]
  }

  async searchCommunityReviews(query: CommunityReviewQuery) {
    const limit = z.number().int().min(1).max(10).parse(query.limit)
    return [{
      id: 'review-demo-1',
      excerpt: '방문 전에 필요한 서류를 전화로 다시 확인해 재방문을 줄였어요.',
      reason: `${query.relation || '가족'} 사후 행정 · ${query.region || '지역 미지정'} · ${query.taskType || '업무'} 경험`,
      createdAt: '2026-07-01',
      helpfulCount: 38,
      url: null,
      label: '사용자 경험' as const,
    }].slice(0, limit)
  }

  async updateTaskStatus(caseId: string, taskId: string, status: TaskState['status']) {
    const state = await this.getCaseState(caseId)
    const parsedStatus = taskStatusSchema.parse(status)
    const tasks = state.tasks.map((task) => task.id === idSchema.parse(taskId) ? { ...task, status: parsedStatus } : task)
    return this.updateCaseState(caseId, { tasks })
  }
}

