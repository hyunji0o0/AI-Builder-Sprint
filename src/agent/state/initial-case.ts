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
  tasks: [],
  missingFields: [],
  warnings: [],
  currentFocus: { type: null, id: null },
  emotionalContext: { currentSignal: 'NEUTRAL', intensity: 'LOW', tonePreference: 'BALANCED', recentComfortCount: 0, userRequestedPause: false },
  onboardingCompleted: false,
  lastUpdatedAt: new Date().toISOString(),
})
