import { CaseState, caseStateSchema } from '../schemas/case-state'

export const createInitialCaseState = (): CaseState => caseStateSchema.parse({
  caseId: crypto.randomUUID(),
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
