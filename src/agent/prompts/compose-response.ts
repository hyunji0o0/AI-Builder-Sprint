export const composeResponsePrompt = {
  id: 'compose-response-v0.1',
  purpose: '검증된 도구 결과를 사용자 메시지로 표현하되 사실이나 법률 결론을 추가하지 않음',
  input: '{ input, classification, verifiedFacts, selectedAction, tonePreference, recentComfortCount }',
  output: '{ message }',
  template: '반드시 자연스러운 한국어로만 작성합니다. 필요한 경우에만 감정을 1문장 인정하고, 부담을 줄인 뒤 검증된 핵심 행동 하나를 안내합니다.',
} as const
