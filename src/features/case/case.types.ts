import { AgentUIBlock } from '../../agent/schemas/agent-output'

export type DashboardCaseState = {
  documents: number
  activeTasks: number
  needsCheck: number
  assets: number
  debts: number
  readiness: number
  todayTasks: number
  deadline: string
  selectedDate: string
  uploadedFile: string
  extractionConfirmed: boolean
  checklist: boolean[]
}

export type AgentBlockKind =
  | 'text'
  | 'choice'
  | 'date'
  | 'upload'
  | 'extract'
  | 'finance'
  | 'urgent'
  | 'next'
  | 'checklist'
  | 'institution'
  | 'review'
  | 'complete'

export type AgentMessage = {
  id: number
  role: 'agent' | 'user'
  text: string
  block?: AgentBlockKind
  ui?: AgentUIBlock[]
}

export type CaseStage = {
  label: string
  state: string
  done: boolean
}
