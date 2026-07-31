const greetingMessages = [
  '안녕. 오늘은 어떤 도움이 필요한지 편하게 말해줘.',
  '반가워. 궁금한 점이나 정리하고 싶은 일이 있다면 편하게 이야기해줘.',
  '안녕. 서두르지 않아도 괜찮아. 편한 이야기부터 들려줘.',
  '안녕. 지금 마음에 걸리는 일이나 궁금한 내용을 편하게 말해줘.',
]

/**
 * 행정 업무를 진행하지 않는 일상대화와 짧은 일반 응답만 담당합니다.
 * 사건 상태 변경이나 도구 호출은 이 모듈에서 수행하지 않습니다.
 */
export function composeConversationMessage(input: string) {
  const text = input.replace(/\s/g, '')
  if (/굿굿|좋아/.test(text)) return '좋아. 필요할 때 여기서 이어서 확인해볼게.'
  if (/고마워|감사/.test(text)) return '천천히 진행해도 괜찮아.'
  if (/알겠/.test(text)) return '응, 지금 상태로 저장해둘게.'
  return greetingMessages[Math.floor(Math.random() * greetingMessages.length)]
}
