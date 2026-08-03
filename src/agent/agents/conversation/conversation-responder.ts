import { hasEmotionalSignal, isDomainQuestion } from '../../shared/domain-vocabulary'

const greetingMessages = [
  '안녕. 오늘은 어떤 도움이 필요한지 편하게 말해줘.',
  '반가워. 궁금한 점이나 정리하고 싶은 일이 있다면 편하게 이야기해줘.',
  '안녕. 서두르지 않아도 괜찮아. 편한 이야기부터 들려줘.',
  '안녕. 지금 마음에 걸리는 일이나 궁금한 내용을 편하게 말해줘.',
]

const comfortMessages = [
  '그런 마음이 드는 게 당연해. 지금은 무리해서 뭘 하지 않아도 괜찮아.',
  '많이 지쳤겠다. 급한 일이 아니면 오늘은 잠시 미뤄둬도 돼.',
  '혼자 감당하기 버거운 시기야. 하고 싶은 이야기가 있으면 편하게 꺼내줘.',
]

const pick = (messages: string[]) => messages[Math.floor(Math.random() * messages.length)]

/**
 * 행정 업무를 진행하지 않는 일상대화와 짧은 일반 응답만 담당합니다.
 * 사건 상태 변경이나 도구 호출은 이 모듈에서 수행하지 않습니다.
 *
 * 여기 있는 문장은 전부 LLM이 없거나 실패했을 때 쓰는 폴백이다. Upstage가 느리거나
 * 끊겨도 대화가 "안녕" 한 줄로 무너지지 않게, 입력 종류별 결은 맞춰 둔다.
 */
export function composeConversationMessage(input: string, hasTips = false) {
  const text = input.replace(/\s/g, '')

  if (/굿굿|좋아/.test(text)) return '좋아. 필요할 때 여기서 이어서 확인해볼게.'
  if (/고마워|고맙|감사/.test(text)) return '천천히 진행해도 괜찮아.'
  if (/알겠/.test(text)) return '응, 지금 상태로 저장해둘게.'
  if (hasEmotionalSignal(text)) return pick(comfortMessages)

  // 팁 카드가 함께 나갈 때는 본문이 카드를 가리키기만 하면 된다.
  if (hasTips) return '비슷한 상황을 겪은 사람들의 경험을 아래에 모아봤어. 참고만 해줘.'
  if (/(?:팁|후기|경험담).{0,12}(?:추천|찾아|보여|알려)?/.test(text)) {
    return '지금 질문과 직접 관련된 경험담은 찾지 못했어. 다른 표현이나 상황으로 다시 찾아볼 수 있어.'
  }
  if (isDomainQuestion(text)) return '지금은 자세히 설명해주기 어려운 상태야. 잠시 뒤에 다시 물어봐 줄래?'

  return pick(greetingMessages)
}
