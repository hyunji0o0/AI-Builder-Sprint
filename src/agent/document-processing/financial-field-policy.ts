import { DocumentState } from '../schemas/case-state'
import { PipelineExtractedField, ProcessedDocument } from '../schemas/document-pipeline'

export const financialInstitutionRegistry = [
  { key: 'bank', name: '은행연합회' },
  { key: 'life_insurance', name: '생명보험협회' },
  { key: 'nonlife_insurance', name: '손해보험협회' },
  { key: 'financial_investment', name: '금융투자협회' },
  { key: 'credit_finance', name: '여신금융협회' },
  { key: 'korea_post', name: '우정사업본부' },
  { key: 'savings_bank', name: '저축은행중앙회' },
  { key: 'community_credit', name: '새마을금고중앙회' },
  { key: 'forestry_cooperative', name: '산림조합중앙회' },
  { key: 'credit_union', name: '신협중앙회' },
  { key: 'securities_depository', name: '한국예탁결제원' },
  { key: 'deposit_insurance', name: '예금보험공사' },
  { key: 'credit_information', name: '신용정보원' },
] as const

const essentialTopLevelKeys = new Set([
  'organizationKey', 'organizationName', 'message', 'recordCount',
  'hasFinancialRecords', 'hasUnclaimedDepositRecords', 'unclaimedDepositRecordCount',
  'hasDebtRecords', 'debtRecordCount', 'totalAssets', 'totalDebts',
  'pendingInstitution', 'depositAccountCount', 'closedDepositCount',
  'loanCount', 'loanAmount', 'paymentCount', 'guaranteeCount', 'guaranteeAmount',
  'amount', 'balance', 'depositBalance', 'principalBalance', 'cardAmount',
  'policyholderLoanAmount', 'insuranceRefundLoanAmount', 'evaluatedAmount', 'totalAmount',
])

const essentialRecordKeys = new Set([
  'institutionName', 'recordType', 'recordCategory', 'productName', 'debtType',
  'amount', 'balance', 'depositBalance', 'principalBalance', 'loanAmount',
  'cardAmount', 'policyholderLoanAmount', 'insuranceRefundLoanAmount',
  'evaluatedAmount', 'totalAmount', 'quantity', 'quantityOrBalance',
  'recordStatus', 'status', 'statusMessage', 'amountType',
])

export const isFinancialDocumentType = (type: string) => [
  'FINANCIAL_DOCUMENT', 'FINANCIAL_ASSET_DOCUMENT',
  'FINANCIAL_DEBT_DOCUMENT', 'CARD_DEBT_DOCUMENT',
].includes(type)

export const isFinancialDecisionField = (key: string) => {
  const recordMatch = key.match(/^records\.\d+\.(.+)$/)
  return recordMatch ? essentialRecordKeys.has(recordMatch[1]) : essentialTopLevelKeys.has(key)
}

export const selectFinancialDecisionFields = (fields: PipelineExtractedField[]) =>
  fields.filter((field) => isFinancialDecisionField(field.key))

const valueOf = (document: Pick<ProcessedDocument, 'extractedFields'> | Pick<DocumentState, 'extractedFields'>, key: string) => {
  const field = document.extractedFields.find((item) => item.key === key)
  return 'normalizedValue' in (field ?? {})
    ? (field as PipelineExtractedField | undefined)?.normalizedValue
    : field?.value
}

export const organizationOf = (document: Pick<ProcessedDocument, 'extractedFields'> | Pick<DocumentState, 'extractedFields'>) => {
  const key = valueOf(document, 'organizationKey')
  const name = valueOf(document, 'organizationName')
  const normalizedKey = typeof key === 'string' && financialInstitutionRegistry.some((institution) => institution.key === key)
    ? key
    : null
  const matchedByName = typeof name === 'string'
    ? financialInstitutionRegistry.find((institution) => name.replace(/\s+/g, '').includes(institution.name.replace(/\s+/g, '')))
    : undefined
  return {
    key: normalizedKey ?? matchedByName?.key ?? null,
    name: typeof name === 'string' ? name : null,
  }
}

export const analyzeFinancialDocumentCoverage = (documents: DocumentState[]) => {
  const financialDocuments = documents.filter((document) => isFinancialDocumentType(document.type))
  const receivedKeys = new Set(financialDocuments.map((document) => organizationOf(document).key).filter((key): key is string => Boolean(key)))
  const received = financialInstitutionRegistry.filter((institution) => receivedKeys.has(institution.key))
  const missing = financialInstitutionRegistry.filter((institution) => !receivedKeys.has(institution.key))
  return { hasFinancialDocuments: financialDocuments.length > 0, received, missing }
}
