import { CaseState, caseStateSchema } from '../schemas/case-state'

export const createInitialCaseState = (): CaseState => caseStateSchema.parse({
  caseId: 'demo-case',
  stage: 'IN_PROGRESS',
  user: {
    relationToDeceased: '부모님',
    region: { city: '부산광역시', district: null },
  },
  deceased: { name: null, deathDate: null, inheritanceAwarenessDate: null },
  documents: [
    { id: 'doc-1', type: 'DEATH_CERTIFICATE', fileName: '사망진단서.pdf', status: 'VERIFIED', extractedFields: [] },
    { id: 'doc-2', type: 'FAMILY_RELATION_CERTIFICATE', fileName: '가족관계증명서.pdf', status: 'VERIFIED', extractedFields: [] },
    { id: 'doc-3', type: 'FINANCIAL_ASSET_DOCUMENT', fileName: '금융조회.pdf', status: 'VERIFIED', extractedFields: [] },
  ],
  financials: {
    assets: [{ id: 'asset-1', category: 'ASSET', type: 'DEPOSIT', institution: null, amount: 123000000, amountStatus: 'ESTIMATED', source: 'USER_INPUT', sourceDocumentId: null }],
    debts: [{ id: 'debt-1', category: 'DEBT', type: 'LOAN', institution: '○○은행', amount: 42000000, amountStatus: 'ESTIMATED', source: 'USER_INPUT', sourceDocumentId: null }],
    totalAssets: 123000000,
    totalDebts: 42000000,
    difference: 81000000,
    hasUnverifiedItems: true,
  },
  tasks: [
    { id: 'verify-debt', type: 'VERIFY_DEBT', title: '정확하지 않은 채무 금액 확인', priority: 'URGENT', status: 'IN_PROGRESS', deadline: null, daysRemaining: null, readiness: 50, requiredDocuments: [], officialSourceIds: [] },
    { id: 'prepare-consultation', type: 'CONSULTATION', title: '상속 방법 전문가 상담 준비', priority: 'HIGH', status: 'NOT_STARTED', deadline: '2026-08-14', daysRemaining: null, readiness: 60, requiredDocuments: [], officialSourceIds: [] },
  ],
  missingFields: [{ id: 'missing-debt-amount', field: 'financials.debts.debt-1.amount', label: '○○은행 채무 금액', resolved: false }],
  warnings: [],
  currentFocus: { type: null, id: null },
  emotionalContext: { currentSignal: 'NEUTRAL', intensity: 'LOW', tonePreference: 'BALANCED', recentComfortCount: 0, userRequestedPause: false },
  onboardingCompleted: true,
  lastUpdatedAt: new Date().toISOString(),
})
