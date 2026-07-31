import { CaseState } from '../schemas/case-state'

export function calculateProgress(state: CaseState) {
  if (!state.tasks.length) return 0
  const points = state.tasks.reduce((sum, task) => {
    if (task.status === 'COMPLETED' || task.status === 'NOT_APPLICABLE') return sum + 1
    if (task.status === 'IN_PROGRESS') return sum + 0.5
    return sum
  }, 0)
  return Math.round((points / state.tasks.length) * 100)
}

export function buildStateSummary(state: CaseState) {
  return {
    stage: state.stage,
    progress: calculateProgress(state),
    todayTaskCount: state.tasks.filter((task) => task.status === 'IN_PROGRESS').length,
    verifiedDocumentCount: state.documents.filter((document) => document.status === 'VERIFIED').length,
    needsReviewCount: state.missingFields.filter((field) => !field.resolved).length
      + state.documents.filter((document) => document.status === 'NEEDS_CONFIRMATION').length,
  }
}
