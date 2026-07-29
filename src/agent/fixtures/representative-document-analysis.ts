import { CaseState, caseStateSchema } from '../schemas/case-state'
import {
  DocumentPipelineResult,
  documentPipelineResultSchema,
} from '../schemas/document-pipeline'
import { createInitialCaseState } from '../state/initial-case'

/**
 * OCR·문서 추출 담당 API가 반환한다고 가정하는 대표 분석 결과입니다.
 * 실제 연동 시 이 fixture를 수정하지 않고 같은 스키마의 응답으로 교체합니다.
 */
export const createRepresentativeDocumentAnalysis = (): DocumentPipelineResult =>
  documentPipelineResultSchema.parse({
    batchId: 'demo-inheritance-batch',
    documents: [
      {
        documentId: 'demo-death-certificate',
        fileName: '사망진단서.pdf',
        mimeType: 'application/pdf',
        inputForm: 'PDF',
        documentType: 'DEATH_CERTIFICATE',
        classificationConfidence: 0.98,
        alternativeTypes: [],
        status: 'PARSED',
        extractedFields: [
          {
            key: 'deathDate',
            label: '사망일',
            value: '2026-07-07',
            normalizedValue: '2026-07-07',
            source: {
              page: 1,
              textSnippet: '사망일시 2026년 7월 7일',
              boundingBox: [0.18, 0.31, 0.62, 0.37],
            },
            confidence: 0.97,
            verificationStatus: 'NEEDS_USER_REVIEW',
          },
        ],
        validationIssues: [],
      },
      {
        documentId: 'demo-family-certificate',
        fileName: '가족관계증명서.pdf',
        mimeType: 'application/pdf',
        inputForm: 'PDF',
        documentType: 'FAMILY_RELATION_CERTIFICATE',
        classificationConfidence: 0.96,
        alternativeTypes: [],
        status: 'PARSED',
        extractedFields: [
          {
            key: 'relationToDeceased',
            label: '고인과의 관계',
            value: '자녀',
            normalizedValue: '자녀',
            source: {
              page: 1,
              textSnippet: '본인과의 관계 자녀',
              boundingBox: [0.2, 0.54, 0.58, 0.59],
            },
            confidence: 0.94,
            verificationStatus: 'NEEDS_USER_REVIEW',
          },
        ],
        validationIssues: [],
      },
      {
        documentId: 'demo-financial-result',
        fileName: '안심상속_금융거래조회결과.pdf',
        mimeType: 'application/pdf',
        inputForm: 'PDF',
        documentType: 'FINANCIAL_DEBT_DOCUMENT',
        classificationConfidence: 0.95,
        alternativeTypes: [{ type: 'FINANCIAL_ASSET_DOCUMENT', confidence: 0.41 }],
        status: 'NEEDS_REVIEW',
        extractedFields: [
          {
            key: 'totalAssets',
            label: '확인된 자산',
            value: 12_000_000,
            normalizedValue: 12_000_000,
            source: {
              page: 1,
              textSnippet: '조회된 금융자산 합계 12,000,000원',
              boundingBox: [0.55, 0.42, 0.88, 0.47],
            },
            confidence: 0.93,
            verificationStatus: 'NEEDS_USER_REVIEW',
          },
          {
            key: 'totalDebts',
            label: '확인된 채무',
            value: 84_000_000,
            normalizedValue: 84_000_000,
            source: {
              page: 2,
              textSnippet: '조회된 채무 합계 84,000,000원',
              boundingBox: [0.54, 0.38, 0.88, 0.44],
            },
            confidence: 0.91,
            verificationStatus: 'NEEDS_USER_REVIEW',
          },
          {
            key: 'pendingInstitution',
            label: '조회 처리 중인 기관',
            value: '○○기관',
            normalizedValue: '○○기관',
            source: {
              page: 2,
              textSnippet: '○○기관 조회 처리 중',
              boundingBox: [0.14, 0.71, 0.61, 0.76],
            },
            confidence: 0.96,
            verificationStatus: 'NEEDS_USER_REVIEW',
          },
        ],
        validationIssues: [
          {
            code: 'INSTITUTION_RESULT_PENDING',
            severity: 'WARNING',
            documentId: 'demo-financial-result',
            fieldKey: 'pendingInstitution',
            message: '○○기관의 금융 조회 결과가 아직 처리 중입니다.',
            suggestedAction: '해당 기관의 조회 완료 여부를 먼저 확인해 주세요.',
          },
        ],
      },
    ],
    batchIssues: [],
    crossDocumentIssues: [],
    requiresUserConfirmation: true,
    explanation:
      '서류 3개의 종류와 중요 정보를 정리했어요. 사망일과 자산·채무 금액은 원문을 보며 확인해 주세요.',
  })

/**
 * 추출된 중요 값을 사용자가 확인한 뒤의 대표 사건 상태입니다.
 * Agent의 위험 안내, 최소 질문, 다음 행동 응답을 조정할 때 사용합니다.
 */
export const createRepresentativeAgentCaseState = (): CaseState => {
  const initial = createInitialCaseState()

  return caseStateSchema.parse({
    ...initial,
    stage: 'CHECKING_MISSING_INFO',
    user: {
      relationToDeceased: '자녀',
      region: { city: '부산광역시', district: '금정구' },
    },
    deceased: {
      name: null,
      deathDate: '2026-07-07',
      inheritanceAwarenessDate: null,
    },
    documents: [
      {
        id: 'demo-death-certificate',
        type: 'DEATH_CERTIFICATE',
        fileName: '사망진단서.pdf',
        status: 'VERIFIED',
        extractedFields: [
          {
            key: 'deathDate',
            value: '2026-07-07',
            sourcePage: 1,
            verificationStatus: 'VERIFIED',
            verifiedByUser: true,
          },
        ],
      },
      {
        id: 'demo-family-certificate',
        type: 'FAMILY_RELATION_CERTIFICATE',
        fileName: '가족관계증명서.pdf',
        status: 'VERIFIED',
        extractedFields: [
          {
            key: 'relationToDeceased',
            value: '자녀',
            sourcePage: 1,
            verificationStatus: 'VERIFIED',
            verifiedByUser: true,
          },
        ],
      },
      {
        id: 'demo-financial-result',
        type: 'FINANCIAL_DEBT_DOCUMENT',
        fileName: '안심상속_금융거래조회결과.pdf',
        status: 'VERIFIED',
        extractedFields: [
          {
            key: 'totalAssets',
            value: 12_000_000,
            sourcePage: 1,
            verificationStatus: 'VERIFIED',
            verifiedByUser: true,
          },
          {
            key: 'totalDebts',
            value: 84_000_000,
            sourcePage: 2,
            verificationStatus: 'VERIFIED',
            verifiedByUser: true,
          },
          {
            key: 'pendingInstitution',
            value: '○○기관',
            sourcePage: 2,
            verificationStatus: 'VERIFIED',
            verifiedByUser: true,
          },
        ],
      },
    ],
    financials: {
      assets: [
        {
          id: 'demo-assets',
          category: 'ASSET',
          type: 'DEPOSIT',
          institution: null,
          amount: 12_000_000,
          amountStatus: 'VERIFIED',
          source: 'DOCUMENT',
          sourceDocumentId: 'demo-financial-result',
        },
      ],
      debts: [
        {
          id: 'demo-debts',
          category: 'DEBT',
          type: 'LOAN',
          institution: null,
          amount: 84_000_000,
          amountStatus: 'VERIFIED',
          source: 'DOCUMENT',
          sourceDocumentId: 'demo-financial-result',
        },
        {
          id: 'demo-pending-institution',
          category: 'DEBT',
          type: 'OTHER',
          institution: '○○기관',
          amount: null,
          amountStatus: 'UNKNOWN',
          source: 'DOCUMENT',
          sourceDocumentId: 'demo-financial-result',
        },
      ],
      totalAssets: 12_000_000,
      totalDebts: 84_000_000,
      difference: -72_000_000,
      hasUnverifiedItems: true,
    },
    missingFields: [
      {
        id: 'missing-awareness-date',
        field: 'deceased.inheritanceAwarenessDate',
        label: '상속 사실을 알게 된 날짜',
        resolved: false,
      },
      {
        id: 'pending-financial-result',
        field: 'financials.debts.demo-pending-institution.amount',
        label: '○○기관 채무 조회 완료 여부',
        resolved: false,
      },
    ],
    warnings: [
      {
        id: 'pending-institution-warning',
        type: 'MISSING_INFORMATION',
        severity: 'WARNING',
        message: '○○기관의 금융 조회 결과가 아직 처리 중입니다.',
      },
      {
        id: 'debt-exceeds-assets',
        type: 'FINANCIAL_RISK',
        severity: 'URGENT',
        message: '현재 확인된 채무가 확인된 자산보다 72,000,000원 많습니다.',
      },
    ],
    currentFocus: {
      type: 'VERIFY_PENDING_FINANCIAL_RESULT',
      id: 'pending-financial-result',
    },
    lastUpdatedAt: '2026-07-29T00:00:00.000Z',
  })
}
