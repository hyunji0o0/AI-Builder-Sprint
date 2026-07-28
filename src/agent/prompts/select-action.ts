export const selectActionPrompt = {
  id: 'select-action-v0.1',
  purpose: '분류와 상태를 바탕으로 다음 핵심 행동 하나와 최대 3개의 보조 행동을 선택',
  input: '{ classification, caseState, availableTools }',
  output: '{ action, toolCalls(max 3), suggestedActions(max 3) }',
  template: '직접 요청, 긴급 위험, 진행 중 업무, 누락 정보, 선행 업무, 보조 정보, 일반 대화 순으로 선택합니다.',
} as const

