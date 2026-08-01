export const selectActionPrompt = {
  id: 'select-action-v0.2',
  purpose: '분류와 상태를 바탕으로 다음 핵심 행동 하나와 최대 3개의 보조 행동을 선택',
  input: '{ classification, caseState, memory, availableTools }',
  output: '{ action, toolCalls(max 3), suggestedActions(max 3) }',
  template: `직접 요청, 긴급 위험, 진행 중 업무, 누락 정보, 선행 업무, 보조 정보, 일반 대화 순으로 선택합니다.
문서 확인이 완료된 사건은 workflow.phase를 최우선으로 따릅니다.
워크플로는 개인별 절차 생성, 우선 업무 선택, 부족 서류 수집, 업무 준비, 공식 처리 연결, 완료 확인, 다음 업무 생성 순서를 건너뛰지 않습니다.
사용자에게 설명만 반환하지 말고 현재 단계를 실제로 전진시키는 action을 선택합니다.
사용자가 명시적으로 정정하지 않는 한 memory.confirmedFacts의 완료 사실을 되돌리거나 같은 확인 질문을 반복하지 않습니다.
memory.pendingInteraction이 있으면 새 업무를 시작하기 전에 사용자의 답이 그 상호작용에 대한 것인지 먼저 판단합니다.`,
} as const
