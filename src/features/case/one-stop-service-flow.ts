import { AgentUIBlock } from '../../agent/schemas/agent-output'

export const ONE_STOP_APPLICATION_URL = 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=17400000001&HighCtgCD=A01007&tp_seq=01'
export const ONE_STOP_GUIDE_URL = 'https://www.mois.go.kr/frt/bbs/type002/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000205&nttId=98999'

export const createOneStopApplicationGuide = (): AgentUIBlock => ({
  type: 'ONE_STOP_SERVICE_GUIDE',
  stage: 'APPLICATION',
  eyebrow: '안심상속 원스톱 서비스 신청',
  title: '한 번 신청해 재산·채무 조회를 시작해',
  description: '어떤 금융기관과 재산이 있는지 모두 알지 못해도 괜찮아. 정부24 또는 가까운 행정복지센터에서 신청하면 여러 기관의 조회를 한 번에 요청할 수 있어.',
  infoItems: [
    {
      id: 'when',
      title: '언제 신청해?',
      description: '사망신고와 함께 신청하거나, 사망일이 속한 달의 말일부터 1년 이내에 신청할 수 있어.',
    },
    {
      id: 'online',
      title: '온라인 신청',
      description: '정부24에서 신청할 수 있어. 상속 순위와 가족관계에 따라 온라인 신청 대상이 달라질 수 있어.',
    },
    {
      id: 'visit',
      title: '방문 신청',
      description: '가까운 시·구청 또는 읍·면·동 행정복지센터에서 신청할 수 있어.',
    },
  ],
  checklist: [
    { id: 'identification', label: '신청인의 신분증', note: '방문 신청 때 본인 확인에 필요해.' },
    { id: 'relationship', label: '상속관계를 확인할 수 있는 서류', note: '가족관계증명서 등 신청 자격을 확인할 자료가 필요할 수 있어.' },
    { id: 'detailed-family', label: '상세 가족관계증명서', note: '행정정보 공동이용에 동의하면 담당자가 확인할 수 있고, 확인이 어렵다면 제출이 필요할 수 있어.' },
  ],
  resources: [
    { id: 'government24-application', label: '정부24에서 신청하기', url: ONE_STOP_APPLICATION_URL, kind: 'APPLICATION' },
    { id: 'mois-guide', label: '행정안전부 안내 보기', url: ONE_STOP_GUIDE_URL, kind: 'GUIDE' },
  ],
  notice: '신청인의 상속 순위와 가족관계에 따라 신청 방법과 추가 서류가 달라질 수 있어. 신청 화면이나 방문 기관에서 최종 준비물을 한 번 더 확인해줘.',
  actions: [
    { id: 'onboarding_one_stop_application_completed', label: '신청을 마쳤어' },
    { id: 'later', label: '나중에 신청할게' },
  ],
})

export const createOneStopResultsGuide = (): AgentUIBlock => ({
  type: 'ONE_STOP_SERVICE_GUIDE',
  stage: 'RESULTS',
  eyebrow: '신청 후 결과 받기',
  title: '결과는 한 장이 아니라 기관별로 도착해',
  description: '신청이 끝나면 금융·세금·연금·토지·차량 같은 조회 결과가 기관별로 나뉘어 도착해. 문자로 안내받은 결과 화면이나 내려받은 파일을 모아 우리 서비스에 올리면 돼.',
  infoItems: [
    {
      id: 'financial-results',
      title: '금융·세금·연금 등',
      description: '금융재산·채무, 국세, 연금, 4대 사회보험 등의 결과는 기관 안내 문자에서 확인하게 돼. 보통 결과 확인까지 시간이 걸릴 수 있어.',
    },
    {
      id: 'property-results',
      title: '토지·지방세 결과',
      description: '토지와 지방세 등은 신청 뒤 순차적으로 결과가 제공돼. 기관별 처리 속도는 서로 달라.',
    },
    {
      id: 'immediate-results',
      title: '차량·건축물·어선 등',
      description: '일부 결과는 신청 과정에서 바로 확인될 수 있어. 화면에 결과가 보이면 파일로 저장하거나 캡처해도 돼.',
    },
  ],
  checklist: [
    { id: 'open-result', label: '기관에서 온 문자나 알림의 결과 화면 열기', note: '결과가 아직 오지 않았다면 기다렸다가 이어서 올려도 돼.' },
    { id: 'save-result', label: '결과 PDF를 내려받거나 화면을 캡처하기', note: '파일 이름이 숫자여도 괜찮아. 문서 내용으로 종류를 구분해.' },
    { id: 'upload-result', label: '기관별 결과 파일을 우리 서비스에 올리기', note: 'PDF, JPG, PNG, WEBP 형식으로 한 번에 최대 10개까지 올릴 수 있어.' },
  ],
  resources: [
    { id: 'government24-result-guide', label: '정부24 처리 안내 보기', url: ONE_STOP_APPLICATION_URL, kind: 'GUIDE' },
    { id: 'mois-result-types', label: '조회 결과 종류 확인하기', url: ONE_STOP_GUIDE_URL, kind: 'GUIDE' },
  ],
  notice: '결과가 전부 도착할 때까지 기다릴 필요는 없어. 먼저 받은 문서부터 올리고, 아직 받지 못한 결과는 미확인으로 남긴 채 진행할 수 있어.',
  actions: [
    { id: 'onboarding_one_stop_upload_results', label: '결과 문서 올리기' },
    { id: 'onboarding_one_stop_results_pending', label: '아직 결과를 기다리는 중' },
  ],
})
