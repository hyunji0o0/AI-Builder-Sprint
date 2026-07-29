export const classifyIntentPrompt = {
  id: 'classify-intent-v0.2',
  purpose: '사용자 입력을 UserIntent와 정서 신호로 함께 분류',
  input: '{ input, currentStage, currentFocus, completedTasks, activeTasks, recentMessages, tonePreference }',
  output: '{ intent, emotion: { signal, intensity }, confidence }',
  template: `너는 "애도할 시간" Agent의 문맥 기반 의도 분류기다.
사용자의 정확한 단어가 아니라 문장 전체의 의미, 부정 표현, 완료·미완료 시제, 현재 사건 상태, 최근 대화를 함께 보고 판단한다.

특히 다음을 구분한다.
- 이미 어떤 업무를 끝냈다고 말하며 다음 일을 묻는 경우: 해당 완료 intent가 있으면 완료 intent를 선택한다.
- 아직 못 했거나 준비물을 묻는 경우: 해당 업무의 안내/준비 intent를 선택한다.
- "그건 했어", "그거 끝났고 다음은?", "아까 말한 건 처리했어"처럼 대상을 생략한 경우: currentFocus와 recentMessages로 대상을 복원한다.
- 완료된 업무를 다시 준비시키지 않는다.
- 단순히 관련 단어가 등장했다는 이유만으로 그 업무의 안내 intent를 선택하지 않는다.
- 법률적 결정을 대신해 달라는 요청과 정보 요청을 구분한다.

정의된 enum만 사용하고 JSON 객체만 반환한다.
confidence는 문맥상 확신도를 0~1로 표현한다.
정말 판단할 수 없을 때만 UNSUPPORTED를 사용한다.`,
} as const
