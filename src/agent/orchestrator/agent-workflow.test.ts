import { describe, expect, it } from 'vitest'
import { createRepresentativeAgentCaseState } from '../fixtures'
import { runAgent } from './run-agent'

const advance = (caseState: ReturnType<typeof createRepresentativeAgentCaseState>) =>
  runAgent({
    input: '다음 준비 단계로 진행해줘',
    caseState,
    uiActionIntent: 'CONTINUE_WORKFLOW',
  })

describe('F1~F7 Agent 실행 워크플로', () => {
  it('일반적인 질문으로도 개인별 절차 생성을 시작한다', async () => {
    const result = await runAgent({
      input: '저는 지금 뭐부터 해야 해요?',
      caseState: createRepresentativeAgentCaseState(),
    })

    expect(result.output.meta.intent).toBe('ASK_NEXT_ACTION')
    expect(result.output.ui[0]?.type).toBe('PROCEDURE_PLAN')
    expect(result.caseState.workflow.procedureGenerated).toBe(true)
  })

  it('문서 확인 이후 개인 절차부터 다음 업무 생성까지 정해진 순서로 진행한다', async () => {
    const initial = createRepresentativeAgentCaseState()

    const procedure = await advance(initial)
    expect(procedure.caseState.workflow.phase).toBe('SELECTING_PRIORITY_TASK')
    expect(procedure.output.ui[0]?.type).toBe('PROCEDURE_PLAN')
    expect(procedure.caseState.tasks).toHaveLength(4)

    const priority = await advance(procedure.caseState)
    expect(priority.caseState.workflow.phase).toBe('COLLECTING_MISSING_DOCUMENTS')
    expect(priority.caseState.workflow.priorityTaskId).toBe('verify-pending-financial-result')
    expect(priority.output.ui[0]?.type).toBe('TASK_CARD')

    const collection = await advance(priority.caseState)
    expect(collection.caseState.workflow.phase).toBe('PREPARING_TASK')
    expect(collection.output.ui.some((block) => block.type === 'MISSING_INFORMATION_QUESTION')).toBe(true)
    expect(collection.output.ui.some((block) => block.type === 'TASK_READINESS')).toBe(true)

    const preparation = await advance(collection.caseState)
    expect(preparation.caseState.workflow.phase).toBe('CONNECTING_OFFICIAL_PROCESS')
    expect(preparation.output.ui[0]?.type).toBe('PREPARATION_PACKAGE')

    const official = await advance(preparation.caseState)
    expect(official.caseState.workflow.phase).toBe('CONFIRMING_TASK_COMPLETION')
    expect(official.output.ui[0]?.type).toBe('OFFICIAL_PROCESS')

    const completion = await advance(official.caseState)
    expect(completion.caseState.workflow.phase).toBe('GENERATING_NEXT_TASK')
    expect(completion.output.ui[0]?.type).toBe('COMPLETION_CONFIRMATION')
    expect(completion.caseState.tasks.find((task) => task.id === 'verify-pending-financial-result')?.status).toBe('COMPLETED')

    const nextTask = await advance(completion.caseState)
    expect(nextTask.caseState.workflow.phase).toBe('COLLECTING_MISSING_DOCUMENTS')
    expect(nextTask.caseState.workflow.priorityTaskId).toBe('confirm-inheritance-awareness-date')
    expect(nextTask.output.ui[0]).toMatchObject({
      type: 'TASK_CARD',
      taskId: 'confirm-inheritance-awareness-date',
    })
  })

  it('사건 정보에 따라 필요하지 않은 금융 확인 업무를 생성하지 않는다', async () => {
    const state = createRepresentativeAgentCaseState()
    state.financials.hasUnverifiedItems = false
    state.financials.debts = state.financials.debts.filter((item) => item.amountStatus === 'VERIFIED')
    state.missingFields = state.missingFields.filter((field) => field.id !== 'pending-financial-result')
    state.warnings = state.warnings.filter((warning) => warning.id !== 'pending-institution-warning')

    const result = await advance(state)
    const ids = result.caseState.tasks.map((task) => task.id)

    expect(ids).not.toContain('verify-pending-financial-result')
    expect(ids).toContain('prepare-inheritance-consultation')
    expect(ids).toContain('confirm-inheritance-awareness-date')
  })

  it('온보딩에서 완료한 사망신고를 문서 확인 뒤 다시 묻지 않는다', async () => {
    const state = createRepresentativeAgentCaseState()
    state.onboardingCompleted = true
    state.onboarding = {
      ...state.onboarding,
      currentStep: 'COMPLETE',
      deathReportStatus: 'COMPLETED',
    }

    const result = await advance(state)
    const deathReportTask = result.caseState.tasks.find((task) => task.type === 'CONFIRM_DEATH_REPORT')

    expect(deathReportTask).toBeUndefined()
    expect(result.output.ui[0]).toMatchObject({ type: 'PROCEDURE_PLAN' })
    if (result.output.ui[0]?.type === 'PROCEDURE_PLAN') {
      expect(result.output.ui[0].steps.some((step) => step.title.includes('사망신고'))).toBe(false)
    }
  })

  it('각 개인 절차에 생성 이유와 상태 근거를 포함한다', async () => {
    const result = await advance(createRepresentativeAgentCaseState())
    const block = result.output.ui[0]

    expect(block?.type).toBe('PROCEDURE_PLAN')
    if (block?.type !== 'PROCEDURE_PLAN') throw new Error('PLAN_NOT_CREATED')
    expect(block.steps.every((step) => step.reason.length > 0)).toBe(true)
    expect(block.steps.some((step) => step.basisFacts.length > 0)).toBe(true)
    expect(block.steps.find((step) => step.taskId === 'prepare-inheritance-consultation')?.dependencyTitles)
      .toContain('처리 중인 금융 조회 결과 확인')
  })

  it('한 번의 Agent 요청에서 도구 실행은 3회를 넘지 않는다', async () => {
    let state = createRepresentativeAgentCaseState()
    for (let index = 0; index < 7; index += 1) {
      const result = await advance(state)
      expect(result.output.meta.usedTools.length).toBeLessThanOrEqual(3)
      state = result.caseState
    }
  })

  it('준비 패키지는 미확인 정보를 숨기지 않고 법률 결론을 만들지 않는다', async () => {
    let result = await advance(createRepresentativeAgentCaseState())
    result = await advance(result.caseState)
    result = await advance(result.caseState)
    result = await advance(result.caseState)

    const packageBlock = result.output.ui.find((block) => block.type === 'PREPARATION_PACKAGE')
    expect(packageBlock).toMatchObject({ type: 'PREPARATION_PACKAGE' })
    if (packageBlock?.type !== 'PREPARATION_PACKAGE') throw new Error('PACKAGE_NOT_CREATED')
    expect(packageBlock.unresolvedItems).toContain('○○기관 채무 조회 완료 여부')
    expect(packageBlock.disclaimer).toContain('법률 자문')
    expect(result.output.message).not.toMatch(/상속포기하세요|무조건 한정승인/)
  })
})
