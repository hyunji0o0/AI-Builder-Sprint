export const classifyIntentPrompt = {
  id: 'classify-intent-v0.1',
  purpose: '사용자 입력을 UserIntent와 정서 신호로 함께 분류',
  input: '{ input, currentStage, currentFocus, tonePreference }',
  output: '{ intent, emotion: { signal, intensity }, confidence }',
  template: '정의된 enum만 사용해 JSON으로 분류합니다. 확신이 낮으면 UNSUPPORTED/NEUTRAL/LOW를 사용합니다.',
} as const

