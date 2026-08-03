import type { AgentRoute } from './agent-router'

export type RoutingEvalGroup =
  | 'DEFINITION'
  | 'GENERAL_ADVICE'
  | 'EMOTIONAL'
  | 'CASUAL'
  | 'CASE_ACTION'
  | 'CASE_STATE'
  | 'HIGH_STAKES_DECISION'
  | 'MULTI_TURN'

export type RoutingEvalCase = {
  id: string
  expected: AgentRoute
  group: RoutingEvalGroup
  input: string
  recentMessages?: Array<{ role: 'agent' | 'user'; text: string }>
}

const conversationCases: Omit<RoutingEvalCase, 'id' | 'expected'>[] = [
  { group: 'DEFINITION', input: '상속포기가 뭐야?' },
  { group: 'DEFINITION', input: '한정승인이랑 단순승인은 무슨 차이야?' },
  { group: 'DEFINITION', input: '안심상속 원스톱 서비스가 뭔가요?' },
  { group: 'DEFINITION', input: '사망진단서와 사망증명서 차이를 설명해줘.' },
  { group: 'DEFINITION', input: '상속세 공제는 어떤 제도야?' },
  { group: 'DEFINITION', input: '유류분이라는 말의 뜻이 뭐예요?' },
  { group: 'DEFINITION', input: '상속재산분할협의가 무엇인가요?' },
  { group: 'DEFINITION', input: '조문 예절이 어떤 건지 설명해줘.' },
  { group: 'DEFINITION', input: '유족연금은 무슨 의미야?' },
  { group: 'DEFINITION', input: '보험금 수익자는 어떤 개념이야?' },

  { group: 'GENERAL_ADVICE', input: '고인 휴대폰 해지해도 됨?' },
  { group: 'GENERAL_ADVICE', input: '사망 후 휴대폰은 보통 언제 해지해도 돼?' },
  { group: 'GENERAL_ADVICE', input: '고인 명의 구독 서비스 해지 방법 알려줘.' },
  { group: 'GENERAL_ADVICE', input: '사망신고는 일반적으로 어디서 해?' },
  { group: 'GENERAL_ADVICE', input: '사망신고 준비 서류가 뭐야?' },
  { group: 'GENERAL_ADVICE', input: '은행 예금계좌 해지 절차를 알려줘.' },
  { group: 'GENERAL_ADVICE', input: '자동차 명의 이전은 어떤 순서로 해?' },
  { group: 'GENERAL_ADVICE', input: '상속세 신고 기한이 일반적으로 언제까지야?' },
  { group: 'GENERAL_ADVICE', input: '장례식장에서 조문객에게 어떻게 인사하면 돼?' },
  { group: 'GENERAL_ADVICE', input: '부의금 정리 팁 알려줘.' },
  { group: 'GENERAL_ADVICE', input: '고인 카드 자동이체를 정리하는 일반적인 순서 알려줘.' },
  { group: 'GENERAL_ADVICE', input: '사망자 보험금 청구에는 보통 무슨 서류가 필요해?' },
  { group: 'GENERAL_ADVICE', input: '법원에 서류를 제출하는 방법만 설명해줘.' },
  { group: 'GENERAL_ADVICE', input: '인감증명서를 재발급받는 절차 알려줘.' },
  { group: 'GENERAL_ADVICE', input: '위조 서류 신고 방법 알려줘.' },
  { group: 'GENERAL_ADVICE', input: '숨긴 상속재산을 발견하면 적법하게 신고하는 법 알려줘.' },
  { group: 'GENERAL_ADVICE', input: '상속 관련 상담은 어느 기관에서 받을 수 있어?' },
  { group: 'GENERAL_ADVICE', input: '장례 후 행정 절차를 대략적인 순서로 설명해줘.' },
  { group: 'GENERAL_ADVICE', input: '고인 인터넷 회선 해지할 때 주의할 점이 뭐야?' },
  { group: 'GENERAL_ADVICE', input: '가족관계증명서는 어디서 발급 가능해?' },
  { group: 'GENERAL_ADVICE', input: '상속 후기 세 개 추천해줘.' },
  { group: 'GENERAL_ADVICE', input: '장례 경험담을 읽어보고 싶어.' },
  { group: 'GENERAL_ADVICE', input: '세무서 사칭 문자를 구별하는 팁 알려줘.' },
  { group: 'GENERAL_ADVICE', input: '채무가 있는지 알아보는 제도를 설명해줘.' },
  { group: 'GENERAL_ADVICE', input: '고인 계정 무단접속을 막는 방법 알려줘.' },

  { group: 'EMOTIONAL', input: '상속 생각만 하면 너무 슬퍼.' },
  { group: 'EMOTIONAL', input: '장례를 치르고 나니 마음이 허전해.' },
  { group: 'EMOTIONAL', input: '아버지 통장을 보면 자꾸 눈물이 나.' },
  { group: 'EMOTIONAL', input: '사망신고라는 말조차 너무 힘들어.' },
  { group: 'EMOTIONAL', input: '유품을 보고 있으니 엄마가 너무 보고 싶어.' },
  { group: 'EMOTIONAL', input: '빚 이야기를 들으니 막막하고 무서워.' },
  { group: 'EMOTIONAL', input: '장례식 기억 때문에 마음이 먹먹해.' },
  { group: 'EMOTIONAL', input: '상속 문제로 가족과 다퉈서 속상해.' },
  { group: 'EMOTIONAL', input: '요즘 아무것도 하기 싫고 지쳐.' },
  { group: 'EMOTIONAL', input: '고인이 너무 그립고 외로워.' },

  { group: 'CASUAL', input: '안녕하세요!' },
  { group: 'CASUAL', input: '고마워.' },
  { group: 'CASUAL', input: '오늘은 그냥 이야기하고 싶어.' },
  { group: 'CASUAL', input: '네 설명이 이해됐어.' },
  { group: 'CASUAL', input: '잠깐 쉬었다가 다시 올게.' },
]

const caseWorkflowCases: Omit<RoutingEvalCase, 'id' | 'expected'>[] = [
  { group: 'CASE_ACTION', input: '내 사건에서 지금 휴대폰 해지 업무 완료 처리해줘.' },
  { group: 'CASE_ACTION', input: '내가 올린 사망진단서 확인해줘.' },
  { group: 'CASE_ACTION', input: '이 문서를 내 사건에 등록해줘.' },
  { group: 'CASE_ACTION', input: '상속재산 목록에 이 계좌를 추가해줘.' },
  { group: 'CASE_ACTION', input: '내 채무 자료를 조회해서 정리해줘.' },
  { group: 'CASE_ACTION', input: '사망신고 업무를 시작할게.' },
  { group: 'CASE_ACTION', input: '보험금 청구 서류를 업로드할게.' },
  { group: 'CASE_ACTION', input: '내 사건의 상속세 기한을 계산해줘.' },
  { group: 'CASE_ACTION', input: '이 통장을 정리 완료로 바꿔줘.' },
  { group: 'CASE_ACTION', input: '가족관계증명서를 제출했어.' },
  { group: 'CASE_ACTION', input: '고인 휴대폰 해지한 걸 완료 처리해줘.' },
  { group: 'CASE_ACTION', input: '내 자산 목록에서 자동차를 수정해줘.' },
  { group: 'CASE_ACTION', input: '상속 업무 다음 단계로 진행해줘.' },
  { group: 'CASE_ACTION', input: '이 서류에서 계좌번호를 추출해줘.' },
  { group: 'CASE_ACTION', input: '법원 접수한 내용을 저장해줘.' },
  { group: 'CASE_ACTION', input: '내 사건에 빠진 문서가 있는지 확인해줘.' },
  { group: 'CASE_ACTION', input: '장례비 영수증을 첨부할게.' },
  { group: 'CASE_ACTION', input: '내 상속재산 조회를 진행해줘.' },
  { group: 'CASE_ACTION', input: '사망신고는 끝냈으니 체크해줘.' },
  { group: 'CASE_ACTION', input: '오늘 할 상속 업무를 목록으로 만들어줘.' },

  { group: 'CASE_STATE', input: '내 사건은 지금 어디까지 진행됐어?' },
  { group: 'CASE_STATE', input: '오늘 내 할 일이 몇 개 남았어?' },
  { group: 'CASE_STATE', input: '아직 확인 안 한 문서가 있어?' },
  { group: 'CASE_STATE', input: '내 상속 업무 현황 보여줘.' },
  { group: 'CASE_STATE', input: '마감이 얼마 안 남은 내 업무가 뭐야?' },
  { group: 'CASE_STATE', input: '내가 완료한 단계 다음에는 뭘 해야 해?' },
  { group: 'CASE_STATE', input: '업로드한 문서 처리 상태 알려줘.' },
  { group: 'CASE_STATE', input: '내 재산과 빚 중 아직 미확인인 게 뭐야?' },
  { group: 'CASE_STATE', input: '내 사건 기준으로 가장 급한 일부터 알려줘.' },
  { group: 'CASE_STATE', input: '며칠 안에 처리해야 하는 업무가 있어?' },

  { group: 'HIGH_STAKES_DECISION', input: '상속포기해도 됨?' },
  { group: 'HIGH_STAKES_DECISION', input: '나는 한정승인을 해야 할까?' },
  { group: 'HIGH_STAKES_DECISION', input: '우리 집은 단순승인으로 가도 돼?' },
  { group: 'HIGH_STAKES_DECISION', input: '이 빚 규모면 상속포기가 나을까?' },
  { group: 'HIGH_STAKES_DECISION', input: '내 상황에서 유산분할 합의해도 괜찮아?' },
  { group: 'HIGH_STAKES_DECISION', input: '상속재산분할을 지금 시작해야 하나?' },
  { group: 'HIGH_STAKES_DECISION', input: '기한이 얼마 안 남았는데 한정승인 가능해?' },
  { group: 'HIGH_STAKES_DECISION', input: '내 사건은 상속포기랑 한정승인 중 뭐가 맞아?' },
  { group: 'HIGH_STAKES_DECISION', input: '채무가 더 많으면 단순승인하면 안 돼?' },
  { group: 'HIGH_STAKES_DECISION', input: '가족끼리 유산분할을 이렇게 해도 될까?' },

  { group: 'MULTI_TURN', recentMessages: [{ role: 'agent', text: '사망신고 처리는 끝났나요?' }], input: '응, 어제 끝냈어.' },
  { group: 'MULTI_TURN', recentMessages: [{ role: 'agent', text: '다음으로 휴대폰 해지를 진행할까요?' }], input: '좋아, 그걸 시작해줘.' },
  { group: 'MULTI_TURN', recentMessages: [{ role: 'user', text: '보험금 청구 서류를 보고 있어.' }], input: '이거 업로드하면 확인해줄래?' },
  { group: 'MULTI_TURN', recentMessages: [{ role: 'agent', text: '누락된 계좌를 자산에 추가할까요?' }], input: '그래, 목록에 넣어줘.' },
  { group: 'MULTI_TURN', recentMessages: [{ role: 'agent', text: '상속세 신고 업무를 이어서 볼까요?' }], input: '응, 다음 단계로 넘어가자.' },
  { group: 'MULTI_TURN', recentMessages: [{ role: 'user', text: '법원에 서류를 냈어.' }], input: '접수 완료로 기록해줘.' },
  { group: 'MULTI_TURN', recentMessages: [{ role: 'agent', text: '확인하지 않은 문서가 두 개 있어요.' }], input: '뭐가 남았는지 보여줘.' },
  { group: 'MULTI_TURN', recentMessages: [{ role: 'user', text: '고인 통신비를 정리 중이야.' }], input: '휴대폰 해지는 다 했어.' },
  { group: 'MULTI_TURN', recentMessages: [{ role: 'agent', text: '재산 조회 결과를 사건에 반영할까요?' }], input: '네, 저장해줘.' },
  { group: 'MULTI_TURN', recentMessages: [{ role: 'agent', text: '오늘 처리할 업무를 정리해볼까요?' }], input: '지금 가장 급한 것부터 시작해줘.' },
]

const withMetadata = (
  cases: Omit<RoutingEvalCase, 'id' | 'expected'>[],
  expected: AgentRoute,
  prefix: string,
): RoutingEvalCase[] => cases.map((testCase, index) => ({
  ...testCase,
  id: `${prefix}-${String(index + 1).padStart(2, '0')}`,
  expected,
}))

export const routingEvalCases: RoutingEvalCase[] = [
  ...withMetadata(conversationCases, 'CONVERSATION', 'C'),
  ...caseWorkflowCases.map((testCase, index) => ({
    ...testCase,
    id: `W-${String(index + 1).padStart(2, '0')}`,
    expected: testCase.group === 'HIGH_STAKES_DECISION' ? 'CONVERSATION' as const : 'CASE_WORKFLOW' as const,
  })),
]
