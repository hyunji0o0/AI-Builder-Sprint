/**
 * 라우터(orchestrator)와 대화 Agent가 같은 기준으로 입력을 판단하도록 어휘를 한곳에 모았다.
 * 양쪽에 따로 두면 한쪽만 고쳐졌을 때 "라우팅은 대화로 갔는데 대화 Agent는 도메인 질문으로
 * 안 보는" 어긋남이 생긴다.
 *
 * 축이 두 개라는 점이 중요하다.
 *  - 무엇에 대한 이야기인가(주제어)
 *  - 사용자의 사건을 실제로 처리해야 하는가(동작어)
 * 이 둘을 한 덩어리로 묶으면 "상속포기가 뭐야?" 같은 순수 질문까지 사건 처리로 끌려간다.
 */

/**
 * 사용자 사건을 실제로 읽거나 바꿔야 답할 수 있는 동작·상태 표현.
 * 주제어가 없어도 이 말이 있으면 사건 Agent로 보낸다.
 */
export const caseOperationPattern =
  /업로드|올려|올릴|올렸|올리면|첨부|스캔|추출|제출|접수|준비|진행|완료|다했|끝냈|시작|이어서|다음|뭐부터|무엇부터|단계|과정|상태|현황|어디까지|업무|할일|해야할|기한|남았|마감|며칠|조회|계산|확인|정리|저장|등록|수정|추가|넣어|반영|상담|전문가|나중에|미룰|미뤄/

/** 사용자의 자료·사건·진행 상태를 직접 가리키는 표현. */
export const personalCasePattern =
  /내사건|내업무|내할일|내자료|내문서|내가올린|내가낸|업로드한|내상황|우리집|우리가족|내기준|내재산|내자산|내채무|내빚|내통장|내계좌/

/** 설명이 아니라 사건 상태를 실제로 읽거나 바꾸라는 명시적인 동작. */
export const caseMutationPattern =
  /처리해|완료.{0,6}(?:처리|기록|체크|바꿔)|기록해|등록해|추가해|저장해|수정해|반영해|목록에.{0,4}넣어|시작해|진행해|넘어가|업로드할|업로드해|첨부할|첨부해|제출했|제출할게|접수했|끝냈|다했|해지했|추출해|조회해|계산해|확인해줘|정리해줘/

/**
 * 상속·장례 도메인 주제어. 무엇에 관한 이야기인지만 나타내고, 처리 여부는 판단하지 않는다.
 * 커뮤니티 경험담이 실제로 다루는 주제(카테고리 7종)와 맞췄다.
 */
export const domainTermPattern =
  /상속|증여|유산|유언|한정승인|단순승인|사망|장례|빈소|조문|부의|세금|상속세|취득세|공제|명의|등기|이전|연금|보험|보험금|채무|부채|빚|대출|카드|통장|계좌|예금|자산|재산|금융|해지|구독|통신|서류|문서|신고|증명서|제적|말소|기관|법원|세무|법무|안심상속|원스톱|팁|후기|경험담/

/**
 * 정의나 설명을 요구하는 질문 형태.
 * "해야 해?"(결정 요청)나 "어떡해?"(상황 호소)는 일부러 제외했다. 그건 사용자 사건에
 * 대한 판단이라 사건 Agent가 맥락을 보고 답해야 한다.
 */
export const definitionQuestionPattern =
  /뭐야|뭐예요|뭔가요|무엇인가|무슨뜻|무슨의미|뜻이|의미가|차이|개념|어떤건가|어떤거야|어떤제도|설명해|알려줄수/

/** 사건 자료를 보지 않아도 일반적인 순서나 주의점을 설명할 수 있는 질문 형태. */
export const generalAdviceQuestionPattern =
  /해도돼|해도됨|해도괜찮|하면돼|하면됨|해야돼|해야됨|해야하나|해야할까|가능해|가능한가/

/** 사건 자료 없이 답할 수 있는 일반 절차·준비물·기관·경험담 질문. */
export const generalKnowledgeQuestionPattern =
  /방법|절차|순서|주의할점|주의점|어디서|어디에|언제|언제까지|준비서류|필요서류|무슨서류|뭐가필요|무엇이필요|발급|재발급|신고하는법|신고방법|팁|후기|경험담|추천|구별|판별|어느기관|받을수/

/** 개인별 사실관계에 따라 결론이 크게 달라져 사건 Agent에서 다뤄야 하는 결정. */
export const highStakesDecisionPattern =
  /상속포기|한정승인|단순승인|유산분할|상속재산분할/

/** 고위험 선택을 바로 실행하라는 요청이 아니라, 해도 되는지 판단을 묻는 문장인가. */
export const isHighStakesDecisionQuestion = (input: string) => {
  const text = compact(input)
  return highStakesDecisionPattern.test(text)
    && /도돼|도됨|도괜찮|해야해|해야돼|해야됨|해야하나|해야할까|나을까|맞아|괜찮아|가능해|가능한가|안돼|될까/.test(text)
}

/** 인사·감사·짧은 반응. 문장 전체가 이 형태일 때만 매치된다. */
export const casualPattern =
  /^(안녕|안녕하세요|하이|반가워|반갑|고마워|고맙|감사|굿굿|좋아|알겠어|알겠|응|넵|네|ㅇㅋ|오케이|잘자|잘가)[!?.~ㅋㅎㅠ]*$/i

/** 감정 표현. 실제 사건 처리 동작이 함께 없으면 도메인 맥락이어도 대화가 먼저다. */
export const emotionPattern =
  /슬퍼|슬프|힘들|외로|보고싶|그립|눈물|허전|먹먹|무섭|두렵|막막|지치|우울|버티|아무것도|속상|괴로/

/** 감정 대화에서 사건 업무로 넘어갈지 사용자에게 확인 중임을 나타내는 메모리 타입. */
export const CASE_WORKFLOW_HANDOFF_INTERACTION = 'CASE_WORKFLOW_HANDOFF'

const compact = (input: string) => input.replace(/\s/g, '')

/** 사건 상태를 바꾸지 않고 설명만 해야 하는 생활 정리 질문. */
export const isGeneralLifeQuestion = (input: string) =>
  /핸드폰|휴대폰|휴대전화|통신사|요금제|약정|명의변경|서비스해지/.test(compact(input))

/** 사건을 실제로 처리해야 하는 요청인가. */
export const needsCaseData = (input: string) => caseOperationPattern.test(compact(input))

/** 상속·장례 주제를 언급하고 있는가. */
export const mentionsDomain = (input: string) => domainTermPattern.test(compact(input))

/** 사용자가 자신의 사건이나 자료를 직접 가리키고 있는가. */
export const mentionsPersonalCase = (input: string) => personalCasePattern.test(compact(input))

/** 사건 상태를 실제로 바꾸거나 읽으라는 명시적인 요청인가. */
export const requestsCaseMutation = (input: string) => caseMutationPattern.test(compact(input))

/** 인사나 짧은 반응 한 마디인가. */
export const isCasualGreeting = (input: string) => casualPattern.test(compact(input))

/** 감정 표현이 담겨 있는가. */
export const hasEmotionalSignal = (input: string) => emotionPattern.test(compact(input))

/**
 * 사건 데이터 없이 답할 수 있는 순수 지식 질문인가.
 * 예: "상속포기가 뭐야?", "한정승인이랑 차이가 뭐야?"
 * 커뮤니티 경험담을 붙여 대화 Agent가 답하는 경로다.
 */
export const isDomainQuestion = (input: string) => {
  const text = compact(input)
  if (!domainTermPattern.test(text)) return false

  const explicitlyPersonal = personalCasePattern.test(text)
  const changesCaseState = caseMutationPattern.test(text)
  const isDefinition = definitionQuestionPattern.test(text) && !explicitlyPersonal && !changesCaseState
  const isGeneralAdvice = generalAdviceQuestionPattern.test(text)
    && !highStakesDecisionPattern.test(text)
    && !explicitlyPersonal
    && !changesCaseState
  const isGeneralKnowledge = generalKnowledgeQuestionPattern.test(text)
    && !explicitlyPersonal
    && !changesCaseState
  return isDefinition || isGeneralAdvice || isGeneralKnowledge || isHighStakesDecisionQuestion(input)
}

/** 상속·사망 맥락의 감정 표현이지만 아직 실제 사건 처리 요청은 아닌가. */
export const shouldOfferCaseWorkflowHandoff = (input: string) =>
  isHighStakesDecisionQuestion(input)
  || (
    hasEmotionalSignal(input)
    && mentionsDomain(input)
    && !needsCaseData(input)
    && !isDomainQuestion(input)
  )

export const hasPendingCaseWorkflowHandoff = (memory?: {
  pendingInteraction?: { type: string } | null
}) => memory?.pendingInteraction?.type === CASE_WORKFLOW_HANDOFF_INTERACTION

/** 핸드오프 질문 직후의 명시적인 동의·실행 요청만 사건 업무 시작 신호로 인정한다. */
export const acceptsCaseWorkflowHandoff = (input: string) => {
  const text = compact(input).replace(/[^\p{L}\p{N}]/gu, '')
  if (/아니|싫|하지마|말고|아직|지금은|나중에|괜찮아|안해/.test(text)) return false
  if (/^(응|어|그래|좋아|좋지|네|넵|오케이|ㅇㅋ)$/.test(text)) return true
  return /^(?:응|그래|좋아)?(?:그렇게|같이|그럼)?(?:해줘|해줄래|해보자|정리해줘|시작해줘|진행해줘|도와줘)$/.test(text)
}

export const declinesCaseWorkflowHandoff = (input: string) =>
  /아니|싫|하지마|말고|아직|지금은|나중에|괜찮아|안해/.test(compact(input))
