import { CaseState, caseStateSchema } from '../schemas/case-state'

export interface StateRepository {
  getCaseState(caseId: string): Promise<CaseState>
  updateCaseState(caseId: string, patch: Partial<CaseState>): Promise<CaseState>
}

export class MemoryStateRepository implements StateRepository {
  private state: CaseState

  constructor(initial: CaseState) {
    this.state = caseStateSchema.parse(initial)
  }

  async getCaseState(caseId: string) {
    if (caseId !== this.state.caseId) throw new Error('CASE_NOT_FOUND')
    return structuredClone(this.state)
  }

  async updateCaseState(caseId: string, patch: Partial<CaseState>) {
    if (caseId !== this.state.caseId) throw new Error('CASE_NOT_FOUND')
    this.state = caseStateSchema.parse({
      ...this.state,
      ...patch,
      lastUpdatedAt: new Date().toISOString(),
    })
    return structuredClone(this.state)
  }
}

