import { IconName } from '../../components/ui/Icon'

export type GuideStep = {
  eyebrow: string
  title: string
  description: string
  icon: IconName
  tone: 'peach' | 'blue' | 'sage' | 'amber' | 'lilac'
  points: Array<{ title: string; description: string }>
}

export const guideSteps: GuideStep[] = [
  {
    eyebrow: '처음 오셨다면',
    title: '복잡한 일을 한 번에 하나씩',
    description: '애도할 시간은 사후 행정 절차를 현재 상황에 맞춰 정리하고, 다음에 할 한 가지를 함께 진행하는 서비스야.',
    icon: 'sparkle', tone: 'peach',
    points: [
      { title: '처음에는 상태부터 확인', description: '사망신고·금융조회·원스톱 서비스 진행 여부를 차례로 물어봐.' },
      { title: '답변은 계속 기억', description: '확인한 상태를 기준으로 이미 끝낸 업무는 다시 묻지 않아.' },
    ],
  },
  {
    eyebrow: 'YOUR PROGRESS',
    title: '현재 위치를 먼저 확인해',
    description: '상단 진행 현황은 기본 정보, 서류, 재산·채무, 상담 준비 중 지금 어디까지 왔는지 보여줘.',
    icon: 'check', tone: 'sage',
    points: [
      { title: '진행 카드를 눌러도 돼', description: '관련 상태와 필요한 다음 행동을 곁이 채팅으로 설명해줘.' },
      { title: '대시보드는 자동 갱신', description: '문서를 확인하거나 업무를 끝내면 진행률과 오늘 할 일이 바뀌어.' },
    ],
  },
  {
    eyebrow: '곁과 대화하기',
    title: '평소 말하듯 편하게 물어봐',
    description: '정해진 명령어는 필요 없어. “이제 뭐 해?”, “이 서류 맞아?”, “지금 자료로 진행할래”처럼 말하면 돼.',
    icon: 'send', tone: 'blue',
    points: [
      { title: '한 번에 중요한 일 하나', description: '현재 상태와 기한을 보고 가장 먼저 필요한 행동을 제안해.' },
      { title: '잠시 멈춰도 괜찮아', description: '“나중에 할게”라고 말하면 지금까지의 상태를 저장해둬.' },
    ],
  },
  {
    eyebrow: '문서 확인',
    title: '문서는 종류를 고르지 않고 올려도 돼',
    description: '채팅의 문서 업로드 버튼이나 서류함에서 파일을 올리면, 내용을 읽어 문서 종류와 중요한 값부터 정리해줘.',
    icon: 'upload', tone: 'lilac',
    points: [
      { title: '추출값을 꼭 확인', description: 'AI가 읽은 값이 원본과 같은지 확인하고, 틀리면 자연어로 수정할 수 있어.' },
      { title: '원본은 다시 미리보기', description: '업로드한 파일명을 누르면 팝업에서 원본을 바로 확인할 수 있어.' },
    ],
  },
  {
    eyebrow: '다음 업무 진행',
    title: '준비에서 실제 처리까지 이어가',
    description: '필요 서류, 공식 기관 확인, 상담 준비, 업무 완료 기록까지 채팅 안의 카드와 버튼으로 차례로 진행해.',
    icon: 'building', tone: 'amber',
    points: [
      { title: '오른쪽에서 사건 요약 확인', description: '확인된 서류와 자산·채무, 아직 확인할 항목을 한눈에 볼 수 있어.' },
      { title: '중요한 결정은 전문가와', description: '곁은 자료와 위험 신호를 정리하지만 법률 결정을 대신하지 않아.' },
    ],
  },
]
