import { AgentUIBlock, SuggestedAction } from '../../shared/types'
import { CaseState } from '../../schemas/case-state'
import { CaseTools, FinancialSummary } from '../../tools/case-tools'
import { ActionSelection } from './action-selector'

export type ExecutionResult = {
  state: CaseState
  ui: AgentUIBlock[]
  facts: string[]
  suggestedActions: SuggestedAction[]
  usedTools: string[]
  failed: boolean
  financialSummary?: FinancialSummary
}

const logTool = (caseId: string, tool: string, success: boolean, startedAt: number) => {
  console.info(JSON.stringify({ caseId, tool, success, durationMs: Date.now() - startedAt }))
}

export async function executeSelection(selection: ActionSelection, state: CaseState, tools: CaseTools): Promise<ExecutionResult> {
  const result: ExecutionResult = { state, ui: [], facts: [], suggestedActions: [], usedTools: [], failed: false }

  const run = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    if (result.usedTools.length >= 3) throw new Error('TOOL_LIMIT_REACHED')
    const startedAt = Date.now()
    try {
      const value = await operation()
      result.usedTools.push(name)
      logTool(state.caseId, name, true, startedAt)
      return value
    } catch (error) {
      logTool(state.caseId, name, false, startedAt)
      throw error
    }
  }

  try {
    switch (selection.action) {
      case 'ONBOARD':
        result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
          stage: 'COLLECTING_BASIC_INFO',
          onboarding: { ...state.onboarding, currentStep: 'DEATH_REPORT' },
        }))
        result.ui.push({
          type: 'CHOICE',
          prompt: '사망신고는 이미 마쳤어?',
          options: [
            { id: 'onboarding_death_completed', label: '이미 신고했어' },
            { id: 'onboarding_death_not_completed', label: '아직 하지 않았어' },
            { id: 'onboarding_pause', label: '나중에 확인할게' },
          ],
        })
        break
      case 'UPLOAD':
        result.ui.push({ type: 'DOCUMENT_UPLOAD', accept: ['.pdf', '.jpg', '.jpeg', '.png'], taskId: state.currentFocus.id })
        result.suggestedActions.push({ id: 'later', label: '나중에 올리기' })
        break
      case 'CONFIRM_EXTRACTION': {
        const document = state.documents.find((item) => item.status === 'NEEDS_CONFIRMATION')
        if (document) result.ui.push({ type: 'EXTRACTION_CONFIRMATION', documentId: document.id, fields: document.extractedFields.map((field) => ({ key: field.key, value: field.value, needsReview: field.verificationStatus === 'NEEDS_REVIEW' })) })
        else result.ui.push({ type: 'DOCUMENT_UPLOAD', accept: ['.pdf', '.jpg', '.jpeg', '.png'], taskId: state.currentFocus.id })
        break
      }
      case 'FINANCIAL_INPUT':
        result.ui.push({ type: 'FINANCIAL_INPUT', category: 'BOTH', itemId: null })
        break
      case 'SHOW_STATUS': {
        result.state = await run('getCaseState', () => tools.getCaseState(state.caseId))
        const completed = result.state.tasks.filter((task) => task.status === 'COMPLETED').length
        result.ui.push({ type: 'PROGRESS_SUMMARY', progress: calculateProgress(result.state), completedTasks: completed, totalTasks: result.state.tasks.length })
        break
      }
      case 'START_CONSULTATION': {
        const consultation = state.tasks.find((task) =>
          task.category === 'CONSULTATION'
          && task.status !== 'COMPLETED'
          && task.status !== 'NOT_APPLICABLE')
        if (!consultation) {
          result.facts = ['현재 사건 상태에서는 아직 전문가 상담 준비 업무가 만들어지지 않았어. 먼저 현재 절차를 정리할게.']
          result.suggestedActions.push({ id: 'start_personal_procedure', label: '현재 절차 정리하기' })
          break
        }
        const unfinishedDependency = (consultation.dependsOnTaskIds ?? [])
          .map((id) => state.tasks.find((task) => task.id === id))
          .find((task) => task && task.status !== 'COMPLETED' && task.status !== 'NOT_APPLICABLE')
        const target = unfinishedDependency ?? consultation

        if (target.type === 'CONFIRM_INHERITANCE_AWARENESS_DATE') {
          result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
            stage: 'PREPARING_CONSULTATION',
            currentFocus: { type: target.type, id: target.id },
            workflow: {
              ...state.workflow,
              phase: 'COLLECTING_MISSING_DOCUMENTS',
              priorityTaskId: target.id,
            },
          }))
          result.ui.push({
            type: 'MISSING_INFORMATION_QUESTION',
            fieldId: state.missingFields.find((field) => field.field === 'deceased.inheritanceAwarenessDate')?.id ?? 'inheritance-awareness-date',
            prompt: '고인의 사망 사실과 내가 상속인이 된 사실을 언제 알게 됐어?',
            inputType: 'DATE',
            options: [{ id: 'later', label: '날짜는 나중에 확인' }],
          })
          result.suggestedActions.push({ id: 'later', label: '날짜는 나중에 확인' })
          break
        }

        const readiness = await run('calculateTaskReadiness', () => tools.calculateTaskReadiness(state.caseId, consultation.id))
        result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
          stage: 'PREPARING_CONSULTATION',
          currentFocus: { type: consultation.type, id: consultation.id },
          workflow: {
            ...state.workflow,
            phase: 'PREPARING_TASK',
            priorityTaskId: consultation.id,
            missingDocumentTypes: readiness.documents.filter((item) => item.status === 'MISSING').map((item) => item.type),
          },
        }))
        result.ui.push({
          type: 'TASK_READINESS',
          taskId: consultation.id,
          title: consultation.title,
          readiness: readiness.readiness,
          documents: readiness.documents,
        })
        result.suggestedActions.push({ id: 'prepare_task', label: '현재 자료로 상담 준비하기' })
        break
      }
      case 'PROCEED_AVAILABLE': {
        const missingKeys = state.financialCoverage.missingOrganizationKeys
        const existingMissingIds = new Set(state.missingFields.map((field) => field.id))
        const coverageFields = missingKeys
          .filter((key) => !existingMissingIds.has(`missing-financial-${key}`))
          .map((key) => ({
            id: `missing-financial-${key}`,
            field: `financialCoverage.${key}`,
            label: `미확인 금융기관 조회 결과 (${key})`,
            resolved: false,
          }))
        result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
          stage: 'CHECKING_MISSING_INFO',
          financialCoverage: { ...state.financialCoverage, status: 'PROCEED_WITH_AVAILABLE' },
          financials: { ...state.financials, hasUnverifiedItems: missingKeys.length > 0 || state.financials.hasUnverifiedItems },
          missingFields: [...state.missingFields, ...coverageFields],
          currentFocus: { type: null, id: null },
        }))
        const tasks = await run('generatePersonalProcedure', () => tools.generatePersonalProcedure(state.caseId))
        result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
          workflow: {
            ...result.state.workflow,
            phase: 'SELECTING_PRIORITY_TASK',
            procedureGenerated: true,
          },
        }))
        const titleById = new Map(tasks.map((task) => [task.id, task.title]))
        result.ui.push({
          type: 'PROCEDURE_PLAN',
          steps: tasks.slice(0, 6).map((task) => ({
            taskId: task.id,
            title: task.title,
            priority: task.priority,
            status: task.status,
            reason: task.reason ?? '현재 사건 상태를 기준으로 확인이 필요한 업무야.',
            basisFacts: task.basisFacts ?? [],
            dependencyTitles: (task.dependsOnTaskIds ?? []).map((id) => titleById.get(id) ?? id),
            requiredDocuments: task.requiredDocuments.map((document) => ({
              label: document.label,
              status: document.verified ? 'HELD' as const : 'MISSING' as const,
            })),
            applicability: task.applicability ?? 'REVIEW_REQUIRED',
          })),
        })
        result.facts = [
          `${missingKeys.length}개 기관 결과는 미확인 상태로 보존했어.`,
          '현재 확인된 자료만 기준으로 다음 절차를 만들었어.',
        ]
        result.suggestedActions.push({ id: 'select_priority', label: '가장 먼저 할 일 확인' })
        break
      }
      case 'SHOW_NEXT_TASK': {
        const tasks = await run('getPrioritizedTasks', () => tools.getPrioritizedTasks(state.caseId))
        const task = tasks[0]
        if (task) {
          result.facts = [`다음 업무는 '${task.title}'이야.`]
          result.ui.push({ type: 'TASK_CARD', taskId: task.id, title: task.title, priority: task.priority, readiness: task.readiness, actions: [{ id: 'continue', label: '이어하기' }, { id: 'later', label: '나중에 확인' }] })
        } else if (state.onboarding.deathReportStatus !== 'COMPLETED') {
          result.facts = ['사망신고가 아직 완료 상태가 아니어서, 사망신고 준비가 다음 업무야.']
          result.ui.push({
            type: 'TASK_CARD',
            taskId: 'onboarding-death-report',
            title: '사망신고 준비',
            priority: 'HIGH',
            readiness: 0,
            actions: [{ id: 'show_death_report_steps', label: '준비 시작하기' }, { id: 'later', label: '나중에 확인' }],
          })
        } else if (state.onboarding.financialInquiryStatus !== 'COMPLETED') {
          result.facts = ['사망신고는 완료했고 금융재산·채무 조회가 아직이라, 금융조회 준비가 다음 업무야.']
          result.ui.push({
            type: 'TASK_CARD',
            taskId: 'onboarding-financial-inquiry',
            title: '금융재산·채무 조회 준비',
            priority: 'HIGH',
            readiness: 0,
            actions: [{ id: 'onboarding_start_financial', label: '금융조회 준비하기' }, { id: 'later', label: '나중에 확인' }],
          })
        } else if (state.onboarding.oneStopServiceStatus !== 'COMPLETED') {
          result.facts = ['사망신고와 금융조회는 완료했고 원스톱 서비스가 아직이라, 안심상속 원스톱 서비스 신청 준비가 다음 업무야.']
          result.ui.push({
            type: 'TASK_CARD',
            taskId: 'onboarding-one-stop-service',
            title: '안심상속 원스톱 서비스 신청 준비',
            priority: 'NORMAL',
            readiness: 0,
            actions: [{ id: 'onboarding_start_one_stop', label: '준비하기' }, { id: 'later', label: '나중에 확인' }],
          })
        } else {
          result.facts = ['사망신고, 금융조회, 안심상속 원스톱 서비스는 모두 완료 상태야. 다음 절차를 만들려면 현재 가진 문서를 확인하면 돼.']
          result.ui.push({ type: 'DOCUMENT_UPLOAD', accept: ['.pdf', '.jpg', '.jpeg', '.png'], taskId: null })
        }
        break
      }
      case 'SHOW_DOCUMENTS': {
        const tasks = await run('getPrioritizedTasks', () => tools.getPrioritizedTasks(state.caseId))
        const task = tasks[0]
        const items = task ? await run('matchRequiredDocuments', () => tools.matchRequiredDocuments(state.caseId, task.id)) : []
        result.ui.push({ type: 'DOCUMENT_CHECKLIST', taskId: task?.id ?? null, items: items.map((item) => ({ id: item.type, label: item.label, verified: item.verified })) })
        break
      }
      case 'SHOW_DEADLINE': {
        const deadlines = await run('calculateDeadlines', () => tools.calculateDeadlines(state.caseId))
        const known = deadlines.filter((item) => item.deadline !== null)
        result.facts = known.length ? known.map((item) => `${item.deadline} · ${item.daysRemaining}일 남음${item.verified ? '' : ' · 공식 출처 확인 필요'}`) : ['현재 검증된 기한 정보가 없어 확인이 필요합니다.']
        break
      }
      case 'CHECK_FINANCIAL_RISK':
      case 'LEGAL_BOUNDARY': {
        const summary = await run('calculateFinancialSummary', () => tools.calculateFinancialSummary(state.caseId))
        result.state = await run('getCaseState', () => tools.getCaseState(state.caseId))
        const deadlines = await run('calculateDeadlines', () => tools.calculateDeadlines(state.caseId))
        result.financialSummary = summary
        const deadlineFact = deadlines.find((item) => item.deadline)
        result.facts = [
          `현재 입력 기준 자산 ${summary.totalAssets.toLocaleString('ko-KR')}원`,
          `현재 입력 기준 채무 ${summary.totalDebts.toLocaleString('ko-KR')}원`,
          `차이 ${summary.difference.toLocaleString('ko-KR')}원`,
          summary.hasUnverifiedItems ? '미확인 또는 추정 항목이 있습니다.' : '모든 금액이 확인 상태입니다.',
          deadlineFact ? `관련 검토 기한 ${deadlineFact.deadline}${deadlineFact.verified ? '' : ' · 공식 출처 확인 필요'}` : '관련 검토 기한 확인 필요',
        ]
        result.ui.push({
          type: 'RISK_ALERT',
          level: summary.riskLevel === 'URGENT_REVIEW' ? 'URGENT_REVIEW' : summary.riskLevel === 'NEEDS_REVIEW' ? 'WARNING' : 'INFO',
          title: summary.riskLevel === 'URGENT_REVIEW' ? '부채 초과 가능성 긴급 검토' : '자산·채무 확인 결과',
          facts: result.facts,
          disclaimer: '현재 확인된 자료 기준이며 정보 제공일 뿐 법률 자문이 아닙니다.',
        })
        result.suggestedActions.push({ id: 'prepare_consultation', label: '전문가 상담 준비' }, { id: 'verify_amounts', label: '미확인 금액 확인' })
        break
      }
      case 'SHOW_INSTITUTION': {
        const results = await run('findLocalInstitutions', () => tools.findLocalInstitutions(state.user.region.district, state.currentFocus.type || 'GENERAL'))
        result.ui.push({ type: 'INSTITUTION', results })
        break
      }
      case 'SHOW_COMMUNITY_REVIEW': {
        const reviews = await run('searchCommunityReviews', () => tools.searchCommunityReviews({ taskType: state.currentFocus.type || undefined, relation: state.user.relationToDeceased, region: state.user.region.city, limit: 3 }))
        result.ui.push({ type: 'COMMUNITY_REVIEW', reviews, disclaimer: '개인의 경험이며 공식 안내나 법률 자문이 아닙니다. 필요한 서류는 공식 기관에도 확인해 주세요.' })
        break
      }
      case 'SHOW_DEATH_REPORT': {
        let current = state
        if (!state.workflow.procedureGenerated) {
          await run('generatePersonalProcedure', () => tools.generatePersonalProcedure(state.caseId))
          current = await run('getCaseState', () => tools.getCaseState(state.caseId))
        }
        const task = current.tasks.find((item) => item.type === 'CONFIRM_DEATH_REPORT')
        if (!task) throw new Error('DEATH_REPORT_TASK_NOT_FOUND')
        result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
          currentFocus: { type: task.type, id: task.id },
        }))
        const hasDeathCertificate = current.documents.some((document) =>
          document.type === 'DEATH_CERTIFICATE' && document.status === 'VERIFIED')
        result.facts = [
          '사망신고는 방문 또는 우편으로 접수할 수 있습니다.',
          '사망 사실을 안 날부터 1개월 이내에 신고해야 합니다.',
          '정부24 공식 안내와 제19호 사망신고서 양식을 바로 연결했습니다.',
        ]
        result.ui.push({
          type: 'DEATH_REPORT_PREPARATION',
          taskId: task.id,
          title: '사망신고 방문·우편 접수 준비',
          deadlineText: '사망 사실을 안 날부터 1개월 이내',
          submissionMethods: ['방문', '우편'],
          checklist: [
            {
              id: 'death-report-form',
              label: '제19호 사망신고서',
              status: 'CHECK_REQUIRED',
              note: '아래 공식 양식을 내려받아 작성할 수 있어요.',
            },
            {
              id: 'death-certificate',
              label: '진단서·검안서 등 사망 사실 증명서류',
              status: hasDeathCertificate ? 'HELD' : 'CHECK_REQUIRED',
              note: hasDeathCertificate ? '현재 사건에서 확인된 서류예요.' : '원본 등 제출 형태는 접수기관에 확인해 주세요.',
            },
            {
              id: 'reporter-id',
              label: '신고인 또는 제출인의 신분증명서',
              status: 'CHECK_REQUIRED',
              note: '우편 제출 시 신고인의 신분증명서 사본이 필요해요.',
            },
            {
              id: 'basic-certificate',
              label: '사망자의 기본증명서',
              status: 'OPTIONAL',
              note: '가족관계등록 관서에서 전산 확인이 가능하면 생략될 수 있어요.',
            },
          ],
          resources: [
            {
              id: 'official-form',
              label: '공식 사망신고서 내려받기 (HWP)',
              url: 'https://www.gov.kr/main?SaveFileNM=00000000000000026671.hwp&d=AA020InfoDownloadApp',
              kind: 'FORM',
            },
            {
              id: 'gov24-guide',
              label: '정부24 사망신고 안내 보기',
              url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12700000059',
              kind: 'GUIDE',
            },
            {
              id: 'court-guide',
              label: '법원 사망신고 안내 보기',
              url: 'https://efamily.scourt.go.kr/cs/CsBltnWrtGuide.do?bltnbordId=0000008&guideCd=0000008006&guideYn=Y',
              kind: 'GUIDE',
            },
          ],
          notice: '정부24 기준으로 온라인 제출이 아닌 방문·우편 민원입니다. 실제 접수 가능 기관과 서류 원본·사본 요건은 방문 전 해당 기관에 확인해 주세요.',
          actions: [
            { id: 'death_report_completed', label: '신고 완료로 기록' },
            { id: 'later', label: '나중에 이어하기' },
          ],
        })
        result.suggestedActions.push(
          { id: 'death_report_completed', label: '신고 완료로 기록' },
          { id: 'later', label: '나중에 이어하기' },
        )
        break
      }
      case 'COMPLETE_TASK': {
        const tasks = await run('getPrioritizedTasks', () => tools.getPrioritizedTasks(state.caseId))
        if (tasks[0]) result.state = await run('updateTaskStatus', () => tools.updateTaskStatus(state.caseId, tasks[0].id, 'COMPLETED'))
        break
      }
      case 'COMPLETE_DEATH_REPORT': {
        let deathTask = state.tasks.find((task) => task.type === 'CONFIRM_DEATH_REPORT')
        if (!deathTask) {
          const generated = await run('generatePersonalProcedure', () => tools.generatePersonalProcedure(state.caseId))
          deathTask = generated.find((task) => task.type === 'CONFIRM_DEATH_REPORT')
        }
        if (!deathTask) throw new Error('DEATH_REPORT_TASK_NOT_FOUND')

        result.state = await run('updateTaskStatus', () => tools.updateTaskStatus(state.caseId, deathTask.id, 'COMPLETED'))
        const prioritized = await run('getPrioritizedTasks', () => tools.getPrioritizedTasks(state.caseId))
        const nextTask = prioritized.find((task) => task.type !== 'CONFIRM_DEATH_REPORT')

        result.ui.push({
          type: 'COMPLETION_CONFIRMATION',
          taskId: deathTask.id,
          title: '사망신고 완료',
          actions: [],
        })
        if (nextTask) {
          result.facts = [nextTask.title]
          result.ui.push({
            type: 'TASK_CARD',
            taskId: nextTask.id,
            title: nextTask.title,
            priority: nextTask.priority,
            readiness: nextTask.readiness,
            actions: [{ id: 'continue', label: '이 업무 이어가기' }],
          })
          result.suggestedActions.push({ id: 'continue', label: '이 업무 이어가기' })
        } else {
          result.facts = ['현재 생성된 업무는 모두 완료 상태입니다.']
          result.ui.push({
            type: 'PROGRESS_SUMMARY',
            progress: calculateProgress(result.state),
            completedTasks: result.state.tasks.filter((task) => task.status === 'COMPLETED').length,
            totalTasks: result.state.tasks.length,
          })
        }
        break
      }
      case 'ADVANCE_WORKFLOW': {
        const workflow = state.workflow
        if (workflow.phase === 'DOCUMENT_REVIEW' || workflow.phase === 'GENERATING_PERSONAL_PROCEDURE') {
          const tasks = await run('generatePersonalProcedure', () => tools.generatePersonalProcedure(state.caseId))
          result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
            stage: 'CHECKING_MISSING_INFO',
            workflow: {
              ...workflow,
              phase: 'SELECTING_PRIORITY_TASK',
              procedureGenerated: true,
            },
          }))
          result.ui.push({
            type: 'PROCEDURE_PLAN',
            steps: tasks.slice(0, 6).map((task) => {
              const taskTitleById = new Map(tasks.map((item) => [item.id, item.title]))
              return {
                taskId: task.id,
                title: task.title,
                priority: task.priority,
                status: task.status,
                reason: task.reason ?? '현재 사건 상태를 기준으로 확인이 필요한 업무예요.',
                basisFacts: task.basisFacts ?? [],
                dependencyTitles: (task.dependsOnTaskIds ?? []).map((id) => taskTitleById.get(id) ?? id),
                requiredDocuments: task.requiredDocuments.map((document) => ({
                  label: document.label === '안심상속 조회 결과' ? '금융기관별 조회 결과' : document.label,
                  status: document.verified ? 'HELD' as const : 'MISSING' as const,
                })),
                applicability: task.applicability ?? 'REVIEW_REQUIRED',
              }
            }),
          })
          result.suggestedActions.push({ id: 'select_priority', label: '가장 먼저 할 일 확인' })
          break
        }
        if (workflow.phase === 'SELECTING_PRIORITY_TASK') {
          const task = await run('selectPriorityTask', () => tools.selectPriorityTask(state.caseId))
          if (!task) {
            result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
              stage: 'COMPLETED',
              workflow: { ...workflow, phase: 'ALL_TASKS_COMPLETED', priorityTaskId: null },
            }))
            break
          }
          result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
            currentFocus: { type: task.type, id: task.id },
            workflow: { ...workflow, phase: 'COLLECTING_MISSING_DOCUMENTS', priorityTaskId: task.id },
          }))
          result.ui.push({
            type: 'TASK_CARD',
            taskId: task.id,
            title: task.title,
            priority: task.priority,
            readiness: task.readiness,
            actions: [{ id: 'collect_documents', label: '필요 서류 확인' }],
          })
          result.suggestedActions.push({ id: 'collect_documents', label: '필요 서류 확인' })
          break
        }
        if (workflow.phase === 'COLLECTING_MISSING_DOCUMENTS') {
          const missing = await run('detectMissingInformation', () => tools.detectMissingInformation(state.caseId))
          const awarenessDate = missing.find((field) => field.field === 'deceased.inheritanceAwarenessDate')
          if (awarenessDate) {
            result.ui.push({
              type: 'MISSING_INFORMATION_QUESTION',
              fieldId: awarenessDate.id,
              prompt: '관련 기한을 확인하려면, 고인의 사망 사실과 본인이 상속인이 된 사실을 언제 알게 되었는지 알려주세요.',
              inputType: 'DATE',
              options: [{ id: 'later', label: '나중에 입력' }],
            })
          }
          const taskId = workflow.priorityTaskId
          if (!taskId) throw new Error('PRIORITY_TASK_NOT_SELECTED')
          const readiness = await run('calculateTaskReadiness', () => tools.calculateTaskReadiness(state.caseId, taskId))
          result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
            workflow: {
              ...workflow,
              phase: 'PREPARING_TASK',
              missingDocumentTypes: readiness.documents.filter((item) => item.status === 'MISSING').map((item) => item.type),
            },
          }))
          const task = state.tasks.find((item) => item.id === taskId)
          result.ui.push({
            type: 'TASK_READINESS',
            taskId,
            title: task?.title ?? '현재 업무',
            readiness: readiness.readiness,
            documents: readiness.documents,
          })
          result.suggestedActions.push({ id: 'prepare_task', label: '현재 자료로 준비하기' })
          break
        }
        if (workflow.phase === 'PREPARING_TASK') {
          const taskId = workflow.priorityTaskId
          if (!taskId) throw new Error('PRIORITY_TASK_NOT_SELECTED')
          const prepared = await run('buildPreparationPackage', () => tools.buildPreparationPackage(state.caseId, taskId))
          result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
            stage: 'PREPARING_CONSULTATION',
            workflow: { ...workflow, phase: 'CONNECTING_OFFICIAL_PROCESS', preparationPackageReady: true },
          }))
          result.ui.push({
            type: 'PREPARATION_PACKAGE',
            ...prepared,
            disclaimer: '현재 확인된 자료를 정리한 정보이며 법률 자문이나 제출 서류가 아닙니다.',
          })
          result.suggestedActions.push({ id: 'connect_official', label: '공식 처리 단계 확인' })
          break
        }
        if (workflow.phase === 'CONNECTING_OFFICIAL_PROCESS') {
          const taskId = workflow.priorityTaskId
          const task = state.tasks.find((item) => item.id === taskId)
          if (!taskId || !task) throw new Error('PRIORITY_TASK_NOT_SELECTED')
          const institutions = await run('findLocalInstitutions', () => tools.findLocalInstitutions(state.user.region.district, task.type))
          result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
            workflow: { ...workflow, phase: 'CONFIRMING_TASK_COMPLETION', officialConnectionReady: true, completionPending: true },
          }))
          result.ui.push({
            type: 'OFFICIAL_PROCESS',
            taskId,
            title: task.title,
            institutions,
            checklist: ['공식 기관에 필요 서류 재확인', '보유 서류와 미확인 항목 준비', '방문 또는 상담 후 처리 결과 기록'],
          })
          result.suggestedActions.push({ id: 'confirm_completion', label: '처리 완료 확인' })
          break
        }
        if (workflow.phase === 'CONFIRMING_TASK_COMPLETION') {
          const taskId = workflow.priorityTaskId
          const task = state.tasks.find((item) => item.id === taskId)
          if (!taskId || !task) throw new Error('PRIORITY_TASK_NOT_SELECTED')
          result.state = await run('confirmTaskCompletion', () => tools.confirmTaskCompletion(state.caseId, taskId))
          result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
            workflow: { ...workflow, phase: 'GENERATING_NEXT_TASK', completionPending: false },
          }))
          result.ui.push({
            type: 'COMPLETION_CONFIRMATION',
            taskId,
            title: task.title,
            actions: [{ id: 'generate_next', label: '다음 업무 생성' }],
          })
          result.suggestedActions.push({ id: 'generate_next', label: '다음 업무 생성' })
          break
        }
        if (workflow.phase === 'GENERATING_NEXT_TASK') {
          const next = await run('generateNextTask', () => tools.generateNextTask(state.caseId))
          if (!next) {
            result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
              stage: 'COMPLETED',
              currentFocus: { type: null, id: null },
              workflow: { ...workflow, phase: 'ALL_TASKS_COMPLETED', priorityTaskId: null },
            }))
          } else {
            result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
              stage: 'IN_PROGRESS',
              currentFocus: { type: next.type, id: next.id },
              workflow: { ...workflow, phase: 'COLLECTING_MISSING_DOCUMENTS', priorityTaskId: next.id },
            }))
            result.ui.push({
              type: 'TASK_CARD',
              taskId: next.id,
              title: next.title,
              priority: next.priority,
              readiness: next.readiness,
              actions: [{ id: 'continue', label: '다음 업무 이어하기' }],
            })
          }
          break
        }
        break
      }
      case 'PAUSE':
        result.state = await run('updateCaseState', () => tools.updateCaseState(state.caseId, {
          emotionalContext: { ...state.emotionalContext, userRequestedPause: true },
        }))
        result.suggestedActions.push({ id: 'resume_later', label: '나중에 이어하기' })
        break
      case 'CHAT':
      case 'FALLBACK':
        break
    }
  } catch {
    result.failed = true
    result.ui = [{ type: 'CHOICE', prompt: '지금은 자동 처리를 완료하지 못했어요. 어떤 방식으로 이어갈까요?', options: [{ id: 'manual_input', label: '직접 입력하기' }, { id: 'later', label: '나중에 진행' }] }]
    result.suggestedActions = [{ id: 'manual_input', label: '직접 입력하기' }, { id: 'later', label: '나중에 진행' }]
  }

  return result
}

export const calculateProgress = (state: CaseState) => {
  if (!state.tasks.length) return state.onboardingCompleted ? 100 : 0
  const total = state.tasks.reduce((sum, task) => sum + (task.status === 'COMPLETED' ? 100 : task.readiness), 0)
  return Math.round(total / state.tasks.length)
}
