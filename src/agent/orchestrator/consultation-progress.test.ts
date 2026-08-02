import { describe, expect, it } from 'vitest'
import { runDocumentPipeline } from '../document-processing/run-document-pipeline'
import { MockDocumentPipelineAdapter } from '../document-processing/document-pipeline'
import { runAgent } from './run-agent'
import { createInitialCaseState } from '../state/initial-case'
import { MemoryStateRepository } from '../state/state-repository'
import { CaseToolsService } from '../tools/case-tools'

const consultationTask = () => ({
  id: 'prepare-inheritance-consultation',
  type: 'PREPARE_INHERITANCE_CONSULTATION',
  title: '상속 방법 전문가 검토 준비',
  priority: 'NORMAL' as const,
  status: 'IN_PROGRESS' as const,
  deadline: null,
  daysRemaining: null,
  readiness: 0,
  requiredDocuments: [
    { type: 'DEATH_CERTIFICATE', label: '사망진단서', required: true, verified: false },
    { type: 'FAMILY_RELATION_CERTIFICATE', label: '가족관계증명서', required: true, verified: false },
    { type: 'FINANCIAL_DEBT_DOCUMENT', label: '금융기관별 조회 결과', required: true, verified: false },
    { type: 'BASIC_CERTIFICATE', label: '고인의 기본증명서', required: true, verified: false },
    { type: 'RESIDENT_REGISTRATION', label: '상속인의 주민등록등본', required: true, verified: false },
  ],
  officialSourceIds: [],
  category: 'CONSULTATION' as const,
  reason: '확인한 자료를 바탕으로 전문가 상담을 준비해야 해.',
  dependsOnTaskIds: [],
  basisFacts: [],
  applicability: 'REVIEW_REQUIRED' as const,
})

const verifiedDocument = (id: string, type: 'FINANCIAL_DOCUMENT' | 'DEATH_CERTIFICATE') => ({
  id,
  type,
  fileName: `${id}.png`,
  status: 'VERIFIED' as const,
  extractedFields: [],
})

describe('전문가 상담 준비 진행 상태', () => {
  it('금융 문서가 하나 이상 있고 일부 기관만 확인됐으면 일부 문서로 계산한다', async () => {
    const state = createInitialCaseState()
    state.tasks = [consultationTask()]
    state.documents = [verifiedDocument('financial-1', 'FINANCIAL_DOCUMENT')]
    state.financialCoverage = {
      status: 'PROCEED_WITH_AVAILABLE',
      receivedOrganizationKeys: ['financial_investment'],
      missingOrganizationKeys: ['banking_federation'],
    }
    const tools = new CaseToolsService(new MemoryStateRepository(state))

    const readiness = await tools.calculateTaskReadiness(state.caseId, 'prepare-inheritance-consultation')
    const financial = readiness.documents.find((document) => document.type === 'FINANCIAL_DEBT_DOCUMENT')

    expect(financial?.status).toBe('PARTIAL')
    expect(readiness.readiness).toBeGreaterThan(0)
  })

  it('상담 준비 중 보충 문서를 올려도 선택한 상담 업무와 단계를 유지한다', async () => {
    const state = createInitialCaseState()
    state.stage = 'PREPARING_CONSULTATION'
    state.tasks = [consultationTask()]
    state.workflow = {
      ...state.workflow,
      phase: 'PREPARING_TASK',
      procedureGenerated: true,
      priorityTaskId: 'prepare-inheritance-consultation',
    }

    const result = await runDocumentPipeline({
      batchId: 'supplemental-batch',
      files: [{
        fileId: 'financial-2',
        fileName: 'deposit-balance-demo.png',
        declaredMimeType: 'image/png',
        bytesBase64: btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1)),
      }],
    }, state, new MockDocumentPipelineAdapter())

    expect(result.caseState.workflow.priorityTaskId).toBe('prepare-inheritance-consultation')
    expect(result.caseState.workflow.phase).toBe('PREPARING_TASK')
    expect(result.caseState.workflow.procedureGenerated).toBe(true)
  })

  it('상담 중 현재 자료로 진행하면 절차 카드를 반복하지 않고 준비 패키지로 이동한다', async () => {
    const state = createInitialCaseState()
    state.stage = 'PREPARING_CONSULTATION'
    state.tasks = [consultationTask()]
    state.documents = [
      verifiedDocument('financial-1', 'FINANCIAL_DOCUMENT'),
      verifiedDocument('death-certificate', 'DEATH_CERTIFICATE'),
    ]
    state.financialCoverage = {
      status: 'PENDING',
      receivedOrganizationKeys: ['financial_investment'],
      missingOrganizationKeys: ['banking_federation'],
    }
    state.workflow = {
      ...state.workflow,
      phase: 'PREPARING_TASK',
      procedureGenerated: true,
      priorityTaskId: 'prepare-inheritance-consultation',
    }

    const result = await runAgent({
      input: '미확인으로 남기고 지금 자료로 진행해줘',
      uiActionIntent: 'PROCEED_WITH_AVAILABLE_DATA',
      caseState: state,
    })

    expect(result.caseState.financialCoverage.status).toBe('PROCEED_WITH_AVAILABLE')
    expect(result.caseState.workflow.phase).toBe('CONNECTING_OFFICIAL_PROCESS')
    expect(result.caseState.workflow.priorityTaskId).toBe('prepare-inheritance-consultation')
    expect(result.output.ui.some((block) => block.type === 'PREPARATION_PACKAGE')).toBe(true)
    expect(result.output.ui.some((block) => block.type === 'PROCEDURE_PLAN')).toBe(false)
    expect(result.output.message).toContain('공식 처리 단계 확인')
    expect(result.output.message).not.toMatch(/상담 일정|일정 잡기|상담 예약|원하는 날짜와 시간/)
  })

  it('상담 준비를 완료하면 다음 업무를 생성하지 않고 최종 완료 상태로 종료한다', async () => {
    const state = createInitialCaseState()
    state.stage = 'PREPARING_CONSULTATION'
    state.tasks = [consultationTask()]
    state.workflow = {
      ...state.workflow,
      phase: 'CONFIRMING_TASK_COMPLETION',
      procedureGenerated: true,
      priorityTaskId: 'prepare-inheritance-consultation',
      preparationPackageReady: true,
      officialConnectionReady: true,
      completionPending: true,
    }

    const result = await runAgent({
      input: '상담 준비를 모두 마쳤어',
      uiActionIntent: 'CONTINUE_WORKFLOW',
      caseState: state,
    })

    const completionBlock = result.output.ui.find((block) => block.type === 'COMPLETION_CONFIRMATION')
    expect(result.caseState.tasks[0]?.status).toBe('COMPLETED')
    expect(result.caseState.stage).toBe('COMPLETED')
    expect(result.caseState.workflow.phase).toBe('ALL_TASKS_COMPLETED')
    expect(completionBlock?.type === 'COMPLETION_CONFIRMATION' ? completionBlock.actions : undefined).toEqual([])
    expect(result.output.suggestedActions.some((action) => action.id === 'generate_next')).toBe(false)
    expect(result.output.message).toContain('전문가 상담 준비까지 모두 마쳤어')
    expect(result.output.message).not.toContain('다음 업무')

    const followUp = await runAgent({
      input: '이제 내가 제출하기만 하면 되는 거야?',
      caseState: result.caseState,
    })

    expect(followUp.output.message).toContain('전문가와 실제 상담')
    expect(followUp.output.message).toContain('현재 사건 상태와 자산·채무 요약 확인')
    expect(followUp.output.message).not.toContain('기관 찾기')
    expect(followUp.output.message).not.toContain('안심상속 원스톱')
    expect(followUp.output.message).not.toMatch(/문서.*(올려|업로드)/)
    expect(followUp.output.ui).toEqual([])

  })
})
