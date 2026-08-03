import { CaseState, caseStateSchema } from '../schemas/case-state'

// HTTP 환경(비보안 컨텍스트)에서는 crypto.randomUUID가 없으므로 폴리필 제공
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // 폴리필: Math.random 기반 UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const createInitialCaseState = (): CaseState => caseStateSchema.parse({
  caseId: generateUUID(),
  stage: 'FIRST_VISIT',
  user: {
    relationToDeceased: null,
    region: { city: null, district: null },
  },
  deceased: { name: null, deathDate: null, inheritanceAwarenessDate: null },
  documents: [],
  financials: {
    assets: [],
    debts: [],
    totalAssets: null,
    totalDebts: null,
    difference: null,
    hasUnverifiedItems: false,
  },
  financialCoverage: {
    status: 'NOT_CHECKED',
    receivedOrganizationKeys: [],
    missingOrganizationKeys: [],
  },
  tasks: [],
  missingFields: [],
  warnings: [],
  currentFocus: { type: null, id: null },
  emotionalContext: { currentSignal: 'NEUTRAL', intensity: 'LOW', tonePreference: 'BALANCED', recentComfortCount: 0, userRequestedPause: false },
  memory: {
    conversationSummary: '',
    confirmedFacts: [],
    pendingInteraction: null,
    recentEvents: [],
    lastIntent: null,
  },
  onboarding: {
    currentStep: 'DEATH_REPORT',
    deathReportStatus: 'UNKNOWN',
    financialInquiryStatus: 'UNKNOWN',
    oneStopServiceStatus: 'UNKNOWN',
  },
  onboardingCompleted: false,
  lastUpdatedAt: new Date().toISOString(),
})
