import { describe, expect, it } from 'vitest'
import { createInitialCaseState } from '../state/initial-case'
import { MemoryStateRepository } from '../state/state-repository'
import { MockCaseTools } from '../tools/case-tools'
import { classifyDeterministically, classifyIntent } from '../agents/case-workflow/intent-classifier'
import { runAgent } from './run-agent'
import { responseSimilarity } from '../agents/case-workflow/response-composer'

describe('Agent Harness', () => {
  it('이전 세션의 대부금융협회 항목을 금융조회 대상에서 제거한다', async () => {
    const state = createInitialCaseState()
    state.financialCoverage = {
      status: 'PENDING',
      receivedOrganizationKeys: [],
      missingOrganizationKeys: ['consumer_finance', 'credit_union'],
    }
    const result = await runAgent({ input: '현재 상태 알려줘', caseState: state })
    expect(result.caseState.financialCoverage.missingOrganizationKeys).toEqual(['credit_union'])
  })

  it('굿굿은 CASUAL_CHAT이며 분석 카드를 반복하지 않는다', async () => {
    const result = await runAgent({ input: '굿굿', caseState: createInitialCaseState() })
    expect(result.output.meta.intent).toBe('CASUAL_CHAT')
    expect(result.output.ui).toHaveLength(0)
    expect(result.output.message).toContain('좋아')
    expect(result.output.message).not.toMatch(/좋아요|습니다/)
  })

  it('정신없는 기한 질문을 ASK_DEADLINE + DISTRESSED로 분류한다', () => {
    const result = classifyDeterministically('너무 정신없는데 기한이 언제야?')
    expect(result.intent).toBe('ASK_DEADLINE')
    expect(result.emotion.signal).toBe('DISTRESSED')
    expect(result.emotion.intensity).toBe('HIGH')
  })

  it('금융 문서를 그만 확인하고 넘어가자는 요청은 현재 자료 진행으로 분류한다', async () => {
    const state = createInitialCaseState()
    state.financialCoverage = {
      status: 'HELP_REQUESTED',
      receivedOrganizationKeys: ['financial_investment'],
      missingOrganizationKeys: ['savings_bank', 'credit_union'],
    }

    const result = await runAgent({ input: '금융 조회는 이제 그만하고 다음 단계로 넘어가자', caseState: state })

    expect(result.output.meta.intent).toBe('PROCEED_WITH_AVAILABLE_DATA')
    expect(result.caseState.financialCoverage.status).toBe('PROCEED_WITH_AVAILABLE')
    expect(result.caseState.financials.hasUnverifiedItems).toBe(true)
    expect(result.caseState.workflow.procedureGenerated).toBe(true)
    expect(result.output.ui[0]?.type).toBe('PROCEDURE_PLAN')
    expect(result.caseState.tasks.map((task) => task.id)).not.toContain('verify-pending-financial-result')
    expect(result.output.message).toContain('같은 자료를 다시 요청하지 않고')
    expect(result.output.message).not.toContain('올려')

    const consultation = await runAgent({
      input: '2단계 과정 같이 알려줘',
      caseState: result.caseState,
    })
    expect(consultation.output.meta.intent).toBe('START_CONSULTATION_PREPARATION')
    expect(consultation.caseState.stage).toBe('PREPARING_CONSULTATION')
    expect(consultation.output.ui[0]).toMatchObject({ type: 'MISSING_INFORMATION_QUESTION' })
    expect(consultation.output.message).not.toContain('문서를 올려')

    const afterDate = consultation.caseState
    afterDate.deceased.inheritanceAwarenessDate = '2026-08-01'
    afterDate.missingFields = afterDate.missingFields.map((field) =>
      field.field === 'deceased.inheritanceAwarenessDate' ? { ...field, resolved: true } : field)
    afterDate.tasks = afterDate.tasks.map((task) => task.type === 'CONFIRM_INHERITANCE_AWARENESS_DATE'
      ? { ...task, status: 'COMPLETED' as const, readiness: 100 }
      : task)
    const continuedConsultation = await runAgent({
      input: '날짜 확인을 마쳤으니 전문가 상담 준비를 이어서 진행해줘',
      caseState: afterDate,
      uiActionIntent: 'START_CONSULTATION_PREPARATION',
    })
    expect(continuedConsultation.caseState.workflow.phase).toBe('PREPARING_TASK')
    expect(continuedConsultation.caseState.currentFocus.type).toBe('PREPARE_INHERITANCE_CONSULTATION')
    expect(continuedConsultation.output.ui[0]).toMatchObject({ type: 'TASK_READINESS' })

    const next = await runAgent({
      input: '가장 먼저 할 일 알려줘',
      caseState: result.caseState,
      uiActionIntent: 'CONTINUE_WORKFLOW',
    })
    expect(next.caseState.workflow.priorityTaskId).not.toBe('verify-pending-financial-result')
    expect(next.output.ui[0]).toMatchObject({ type: 'TASK_CARD' })
  })

  it.each([
    '지금 있는 문서들로만 진행해줘',
    '현재 서류만으로 다음 단계로 넘어가자',
    '업로드한 문서로만 계속 진행해줘',
  ])('현재 가진 문서만으로 진행하라는 자연스러운 표현을 처리한다: %s', async (input) => {
    const state = createInitialCaseState()
    state.financialCoverage = {
      status: 'PENDING',
      receivedOrganizationKeys: ['financial_investment'],
      missingOrganizationKeys: ['savings_bank', 'credit_union'],
    }

    const result = await runAgent({ input, caseState: state })

    expect(result.output.meta.intent).toBe('PROCEED_WITH_AVAILABLE_DATA')
    expect(result.caseState.financialCoverage.status).toBe('PROCEED_WITH_AVAILABLE')
    expect(result.caseState.workflow.procedureGenerated).toBe(true)
    expect(result.output.ui[0]?.type).toBe('PROCEDURE_PLAN')
  })

  it('부채가 자산보다 많으면 URGENT_REVIEW를 만든다', async () => {
    const state = createInitialCaseState()
    state.financials = {
      assets: [{ id: 'test-asset', category: 'ASSET', type: 'DEPOSIT', institution: null, amount: 17_000_000, amountStatus: 'VERIFIED', source: 'USER_INPUT', sourceDocumentId: null }],
      debts: [{ id: 'test-debt', category: 'DEBT', type: 'LOAN', institution: null, amount: 87_000_000, amountStatus: 'VERIFIED', source: 'USER_INPUT', sourceDocumentId: null }],
      totalAssets: 17_000_000,
      totalDebts: 87_000_000,
      difference: -70_000_000,
      hasUnverifiedItems: false,
    }
    const result = await runAgent({ input: '부채가 더 많으면 어떡해?', caseState: state })
    expect(result.caseState.stage).toBe('URGENT_REVIEW')
    expect(result.output.ui[0]).toMatchObject({ type: 'RISK_ALERT', level: 'URGENT_REVIEW' })
  })

  it('미확인 금융 항목이 있어도 확정적인 법률 결론을 만들지 않는다', async () => {
    const state = createInitialCaseState()
    state.financials = {
      ...state.financials,
      debts: [{ id: 'unknown-debt', category: 'DEBT', type: 'LOAN', institution: null, amount: null, amountStatus: 'UNKNOWN', source: 'USER_INPUT', sourceDocumentId: null }],
      hasUnverifiedItems: true,
    }
    const result = await runAgent({ input: '부채가 더 많으면 어떡해?', caseState: state })
    expect(result.caseState.financials.hasUnverifiedItems).toBe(true)
    expect(result.output.message).not.toMatch(/상속포기하세요|무조건 한정승인|단순승인으로 진행/)
    expect(result.output.meta.requiresDisclaimer).toBe(true)
  })

  it('상속포기 결정 요청을 ASK_LEGAL_DECISION으로 분류하고 경계를 안내한다', async () => {
    const result = await runAgent({ input: '상속포기해야 해?', caseState: createInitialCaseState() })
    expect(result.output.meta.intent).toBe('ASK_LEGAL_DECISION')
    expect(result.output.message).toContain('결정')
    expect(result.output.meta.requiresDisclaimer).toBe(true)
  })

  it('팁 요청에 COMMUNITY_REVIEW UI Block을 반환한다', async () => {
    const result = await runAgent({ input: '팁 추천해줘', caseState: createInitialCaseState() })
    expect(result.output.meta.intent).toBe('ASK_COMMUNITY_TIP')
    expect(result.output.ui[0]?.type).toBe('COMMUNITY_REVIEW')
  })

  it('사망신고 질문에는 금융 조회가 아닌 실행 가능한 준비 패키지를 반환한다', async () => {
    const result = await runAgent({
      input: '사망신고를 도와줘',
      caseState: createInitialCaseState(),
    })

    expect(result.output.meta.intent).toBe('ASK_DEATH_REPORT')
    expect(result.output.ui[0]).toMatchObject({
      type: 'DEATH_REPORT_PREPARATION',
      taskId: 'confirm-death-report',
      title: '사망신고 방문·우편 접수 준비',
    })
    const preparation = result.output.ui[0]
    expect(preparation.type === 'DEATH_REPORT_PREPARATION' && preparation.checklist).toHaveLength(4)
    expect(preparation.type === 'DEATH_REPORT_PREPARATION' && preparation.resources.some((resource) => resource.kind === 'FORM')).toBe(true)
    expect(result.output.message).toContain('사망신고')
    expect(result.output.message).not.toContain('금융 조회')
  })

  it('사망신고 맥락에서 준비 요청을 후속 업무로 이해한다', async () => {
    const state = createInitialCaseState()
    state.currentFocus = { type: 'CONFIRM_DEATH_REPORT', id: 'confirm-death-report' }
    const result = await runAgent({
      input: '내가 제출해야 할 것들을 준비해줘',
      caseState: state,
    })

    expect(result.output.meta.intent).toBe('ASK_DEATH_REPORT')
    expect(result.output.ui[0]?.type).toBe('DEATH_REPORT_PREPARATION')
  })

  it('사망신고를 마쳤다는 문장은 준비 요청과 구분하고 다음 업무를 반환한다', async () => {
    const result = await runAgent({
      input: '사망신고까지 다 했고, 이제 뭐 해야 해?',
      caseState: createInitialCaseState(),
    })

    expect(result.output.meta.intent).toBe('DEATH_REPORT_COMPLETED')
    expect(result.output.ui.some((block) => block.type === 'DEATH_REPORT_PREPARATION')).toBe(false)
    expect(result.output.ui[0]).toMatchObject({
      type: 'COMPLETION_CONFIRMATION',
      title: '사망신고 완료',
    })
    expect(result.caseState.tasks.find((task) => task.type === 'CONFIRM_DEATH_REPORT')?.status).toBe('COMPLETED')
    expect(result.output.message).toContain('\n\n')
  })

  it('사망신고까지는 했는데라는 완료 표현도 준비 요청으로 오분류하지 않는다', async () => {
    const result = await runAgent({
      input: '사망신고까지는 했는데, 나 이제 뭐해',
      caseState: createInitialCaseState(),
    })

    expect(result.output.meta.intent).toBe('DEATH_REPORT_COMPLETED')
    expect(result.output.ui.some((block) => block.type === 'DEATH_REPORT_PREPARATION')).toBe(false)
    expect(result.output.ui.some((block) => block.type === 'TASK_CARD')).toBe(true)
  })

  it('완료한 원스톱 서비스는 다음 업무에서 다시 묻지 않는다', async () => {
    const state = createInitialCaseState()
    state.onboardingCompleted = true
    state.onboarding = {
      currentStep: 'COMPLETE',
      deathReportStatus: 'COMPLETED',
      financialInquiryStatus: 'NOT_COMPLETED',
      oneStopServiceStatus: 'COMPLETED',
    }
    const result = await runAgent({
      input: '다음은 뭐 해야 해?',
      caseState: state,
    }, {
      llm: { complete: async () => '안심상속 원스톱 서비스를 신청했는지 다시 확인해볼게.' },
    })

    expect(result.output.meta.intent).toBe('ASK_NEXT_ACTION')
    expect(result.output.message).toContain('금융조회 준비')
    expect(result.output.message).not.toContain('원스톱 서비스가 아직')
    expect(result.output.ui[0]).toMatchObject({
      type: 'TASK_CARD',
      title: '금융재산·채무 조회 준비',
    })
  })

  it('아직 사망신고를 못했다는 문장은 완료로 처리하지 않는다', async () => {
    const result = await runAgent({
      input: '아직 사망신고를 못했는데 뭘 준비해야 해?',
      caseState: createInitialCaseState(),
    })

    expect(result.output.meta.intent).toBe('ASK_DEATH_REPORT')
    expect(result.output.ui[0]?.type).toBe('DEATH_REPORT_PREPARATION')
  })

  it('키워드와 달라도 Solar가 문장 의미를 보고 사망신고 완료를 판단한다', async () => {
    const llm = {
      complete: async () =>
        '{"intent":"DEATH_REPORT_COMPLETED","emotion":{"signal":"NEUTRAL","intensity":"LOW"},"confidence":0.94}',
    }
    const result = await classifyIntent(
      '신고 건은 정리 끝났어. 이제 그 뒤 순서가 궁금해',
      createInitialCaseState(),
      llm,
    )

    expect(result.intent).toBe('DEATH_REPORT_COMPLETED')
  })

  it('단어가 포함되어도 Solar의 문맥 판단을 정규식으로 덮어쓰지 않는다', async () => {
    const llm = {
      complete: async () =>
        '{"intent":"DEATH_REPORT_COMPLETED","emotion":{"signal":"NEUTRAL","intensity":"LOW"},"confidence":0.91}',
    }
    const result = await classifyIntent(
      '사망신고 얘기는 끝났고, 다음 순서로 넘어가자',
      createInitialCaseState(),
      llm,
    )

    expect(classifyDeterministically('사망신고 얘기는 끝났고, 다음 순서로 넘어가자').intent).toBe('ASK_DEATH_REPORT')
    expect(result.intent).toBe('DEATH_REPORT_COMPLETED')
  })

  it('생략된 표현을 이해하도록 최근 대화와 사건 상태를 Solar 분류에 전달한다', async () => {
    let classifierPayload = ''
    const llm = {
      complete: async (_system: string, user: string) => {
        classifierPayload = user
        return '{"intent":"DEATH_REPORT_COMPLETED","emotion":{"signal":"NEUTRAL","intensity":"LOW"},"confidence":0.89}'
      },
    }
    const recentMessages = [
      { role: 'agent' as const, text: '사망신고 처리 여부를 먼저 확인해보자.' },
      { role: 'user' as const, text: '확인해볼게.' },
    ]
    const result = await classifyIntent(
      '그건 어제 처리해뒀어. 다음 거 알려줘',
      createInitialCaseState(),
      llm,
      recentMessages,
    )

    expect(result.intent).toBe('DEATH_REPORT_COMPLETED')
    expect(classifierPayload).toContain('사망신고 처리 여부')
    expect(classifierPayload).toContain('activeTasks')
  })

  it('나중에 할게는 상태를 보존하고 일시정지를 기록한다', async () => {
    const state = createInitialCaseState()
    const snapshot = JSON.stringify({ financials: state.financials, tasks: state.tasks })
    const result = await runAgent({ input: '나중에 할게', caseState: state })
    expect(result.output.meta.intent).toBe('REQUEST_PAUSE')
    expect(result.caseState.emotionalContext.userRequestedPause).toBe(true)
    expect(JSON.stringify({ financials: result.caseState.financials, tasks: result.caseState.tasks })).toBe(snapshot)
  })

  it('도구 실패 시 직접 입력 또는 나중에 진행 폴백을 반환한다', async () => {
    const state = createInitialCaseState()
    state.workflow = {
      ...state.workflow,
      phase: 'SELECTING_PRIORITY_TASK',
      procedureGenerated: true,
    }
    const tools = new MockCaseTools(new MemoryStateRepository(state))
    tools.getPrioritizedTasks = async () => { throw new Error('TEST_FAILURE') }
    const result = await runAgent({ input: '다음에 뭐 해야 해?', caseState: state }, { tools })
    expect(result.output.suggestedActions.map((action) => action.id)).toEqual(['manual_input', 'later'])
  })

  it('비슷한 위로 문장을 매 응답마다 반복하지 않는다', async () => {
    const first = await runAgent({ input: '너무 막막한데 기한이 언제야?', caseState: createInitialCaseState() })
    const second = await runAgent({ input: '아직 정신없어. 기한 알려줘', caseState: first.caseState })
    expect(first.output.message).toContain('오늘은 한 가지만')
    expect(second.output.message).not.toContain('오늘은 한 가지만')
  })

  it('채팅 상태 변경과 stateSummary가 함께 갱신된다', async () => {
    const before = createInitialCaseState()
    before.tasks = [{
      id: 'test-task',
      type: 'TEST_TASK',
      title: '테스트 업무',
      priority: 'NORMAL',
      status: 'IN_PROGRESS',
      deadline: null,
      daysRemaining: null,
      readiness: 60,
      requiredDocuments: [],
      officialSourceIds: [],
    }]
    const result = await runAgent({ input: '다 했어', caseState: before })
    expect(result.caseState.tasks.some((task) => task.status === 'COMPLETED')).toBe(true)
    expect(result.output.stateSummary.progress).toBe(100)
    expect(result.output.stateSummary.todayTaskCount).toBe(0)
  })

  it('LLM이 영어를 반환해도 최종 사용자 응답은 한국어로 폴백한다', async () => {
    const llm = { complete: async () => 'I am sorry you are feeling this way. How can I help?' }
    const result = await runAgent({ input: '나 지금 너무 슬퍼', caseState: createInitialCaseState() }, { llm })
    expect(result.output.message).toMatch(/[가-힣]/)
    expect(result.output.message).not.toContain('I am sorry')
  })

  it('안녕에는 업무 분석 카드 없이 자연스러운 인사로 답한다', async () => {
    const result = await runAgent({ input: '안녕', caseState: createInitialCaseState() })
    expect(result.output.meta.intent).toBe('CASUAL_CHAT')
    expect(result.output.ui).toHaveLength(0)
    expect(result.output.message).toMatch(/안녕|반가워/)
  })

  it('가지고 있는 서류를 다 올려도 되는지 묻는 표현을 업로드 요청으로 처리한다', async () => {
    const result = await runAgent({
      input: '내가 지금 가지고 있는 서류들이 있는데, 이걸 너한테 그냥 다 올리면 될까?',
      caseState: createInitialCaseState(),
    })
    expect(result.output.meta.intent).toBe('UPLOAD_DOCUMENT')
    expect(result.output.message).toContain('최대 10개')
    expect(result.output.ui[0]?.type).toBe('DOCUMENT_UPLOAD')
  })

  it('검증된 사실을 포함한 LLM의 자연스러운 표현을 최종 답변으로 사용한다', async () => {
    const llm = {
      complete: async (system: string) => {
        if (system.includes('출력 형식')) return '{"intent":"UPLOAD_DOCUMENT","emotion":{"signal":"NEUTRAL","intensity":"LOW"},"confidence":0.96}'
        if (system.includes('허용 action')) return '{"action":"UPLOAD","tools":[]}'
        return '물론이야. 문서 종류를 미리 고르지 않아도 돼. 이미지와 PDF 파일을 한 번에 10개까지 올려주면, 확인할 내용만 차례로 정리해줄게.'
      },
    }
    const result = await runAgent({
      input: '가지고 있는 서류를 전부 올려도 될까?',
      caseState: createInitialCaseState(),
    }, { llm })
    expect(result.output.message).toContain('물론이야')
    expect(result.output.message).toContain('10개')
    expect(result.output.message).not.toMatch(/습니다|주세요|해요/)
  })

  it('LLM 답변이 필수 사실을 빠뜨리면 안전한 한국어 폴백을 사용한다', async () => {
    const llm = {
      complete: async (system: string) => {
        if (system.includes('출력 형식')) return '{"intent":"UPLOAD_DOCUMENT","emotion":{"signal":"NEUTRAL","intensity":"LOW"},"confidence":0.96}'
        if (system.includes('허용 action')) return '{"action":"UPLOAD","tools":[]}'
        return '네, 편하게 올려주세요.'
      },
    }
    const result = await runAgent({
      input: '서류를 다 올려도 돼?',
      caseState: createInitialCaseState(),
    }, { llm })
    expect(result.output.message).toContain('최대 10개')
    expect(result.output.message).toContain('PDF')
  })

  it('최근 답변과 비슷한 LLM 문장을 거절하고 다른 표현으로 재작성한다', async () => {
    let composeCount = 0
    const repeated = '정신이 많이 없을 수 있어. 잠시 숨을 고르고, 지금 가장 먼저 확인하고 싶은 서류 하나만 알려주면 함께 정리해볼게.'
    const llm = {
      complete: async (system: string) => {
        if (system.includes('출력 형식')) return '{"intent":"UNSUPPORTED","emotion":{"signal":"DISTRESSED","intensity":"HIGH"},"confidence":0.91}'
        if (system.includes('허용 action')) return '{"action":"FALLBACK","tools":[]}'
        composeCount += 1
        return composeCount === 1
          ? repeated
          : '빚 이야기까지 겹쳐서 더 막막할 수 있어. 지금은 정리를 멈추고 잠시 쉬어도 되고, 원할 때 확인된 내용 하나만 살펴봐도 괜찮아.'
      },
    }
    const result = await runAgent({
      input: '빚까지 있다고 하니까 너무 막막해. 나 진짜 너무 힘들어',
      caseState: createInitialCaseState(),
      recentMessages: [
        { role: 'user', text: '정신이 없어서 뭘 해야 할지 모르겠어' },
        { role: 'agent', text: repeated },
      ],
    }, { llm })
    expect(composeCount).toBe(2)
    expect(result.output.message).toContain('빚 이야기')
    expect(responseSimilarity(result.output.message, repeated)).toBeLessThan(0.62)
  })
})
