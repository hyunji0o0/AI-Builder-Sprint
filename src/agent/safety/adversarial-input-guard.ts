export type AdversarialInputCategory =
  | 'PROMPT_INJECTION'
  | 'SECRET_EXTRACTION'
  | 'MALICIOUS_AUTOMATION'
  | 'DATA_EXFILTRATION'
  | 'JAILBREAK'
  | 'PII_HARVESTING'
  | 'IDENTITY_ABUSE'
  | 'DOCUMENT_FORGERY'
  | 'ASSET_CONCEALMENT'
  | 'SOCIAL_ENGINEERING'

export type AdversarialInputDecision = {
  category: AdversarialInputCategory
  message: string
}

const normalize = (input: string) => input
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]/gu, '')

const responses: Record<AdversarialInputCategory, string> = {
  PROMPT_INJECTION: '시스템 프롬프트나 내부 지시사항의 원문은 공개할 수 없어. 대신 메인챗이 어떤 역할과 안전 기준으로 답하는지는 간단히 요약해줄 수 있어.',
  SECRET_EXTRACTION: '환경변수, API 키, 토큰, 비밀번호 같은 비밀값은 보여줄 수 없어. 대신 값이 설정됐는지와 형식이 맞는지만 마스킹해서 확인하는 방법은 안내할 수 있어.',
  MALICIOUS_AUTOMATION: '계정 침입이나 무차별 대입처럼 다른 사람의 시스템을 공격하는 요청은 처리할 수 없어. 대신 로그인 이상 징후 탐지, 요청 속도 제한, 계정 잠금 같은 방어 작업은 도와줄 수 있어.',
  DATA_EXFILTRATION: '개인정보나 인증정보를 조회해 외부로 전송하는 요청은 처리할 수 없어. 대신 비식별 통계, 사용자 동의 기반 처리, 내부 관리자용 집계처럼 안전한 방식은 도와줄 수 있어.',
  JAILBREAK: '안전 지침을 무시하거나 제한 없는 역할로 바꾸라는 요청은 따를 수 없어. 안전한 범위에서 필요한 작업은 계속 도와줄 수 있어.',
  PII_HARVESTING: '다른 사람의 주민등록번호, 계좌번호, 연락처나 주소 같은 개인정보를 찾아주거나 모아줄 수 없어. 필요한 행정 절차와 본인 동의를 받아 확인하는 방법은 안내할 수 있어.',
  IDENTITY_ABUSE: '고인이나 다른 사람인 것처럼 인증하거나 계정에 우회 접근하는 방법은 안내할 수 없어. 대신 통신사·금융기관의 정식 사망자 명의 처리 절차와 준비 서류는 정리해줄 수 있어.',
  DOCUMENT_FORGERY: '사망진단서, 인감증명서, 금융서류 같은 공식 문서를 위조하거나 내용을 조작하는 요청은 처리할 수 없어. 잘못된 서류를 정정하거나 재발급받는 정상 절차는 도와줄 수 있어.',
  ASSET_CONCEALMENT: '상속재산이나 거래를 숨겨 세금·채권자·다른 상속인의 확인을 피하는 방법은 안내할 수 없어. 대신 누락된 재산을 확인하고 적법하게 신고·정리하는 절차는 도와줄 수 있어.',
  SOCIAL_ENGINEERING: '은행·법원·세무서·가족을 사칭하거나 피싱 메시지로 다른 사람을 속이는 요청은 처리할 수 없어. 대신 의심 메시지 판별, 공식 연락처 확인, 피싱 신고 절차는 도와줄 수 있어.',
}

const decision = (category: AdversarialInputCategory): AdversarialInputDecision => ({
  category,
  message: responses[category],
})

/**
 * 라우터·LLM·도구보다 먼저 실행하는 적대적 입력 가드다.
 * 차단 유형만 반환하고 입력 원문이나 서버 비밀값에는 접근하지 않는다.
 */
function detectNormalizedInput(text: string): AdversarialInputDecision | null {
  const defensiveContext = /(?:탐지|차단|방어|예방|보호|신고|제보|대응|교육|연구|분석|판별|설명|감사|보안점검|취약점점검)/.test(text)
  const explicitHarmfulAction = /(?:(?:실제값|원문).{0,12}(?:그대로)?(?:보여|출력|공개|알려)|대신로그인|인증우회|안들키게|몰래옮겨|빼돌|사칭.{0,20}(?:작성|만들|보내)|피싱.{0,20}(?:작성|만들|보내)|무차별대입.{0,20}(?:자동화|만들|실행)|(?:credentialstuffing|passwordspray|브루트포스).{0,30}(?:코드|스크립트|봇).{0,12}(?:만들|실행|작성))/.test(text)

  const jailbreakRole = /(?:dan|doanythingnow|제한없는|무제한|필터없는).{0,24}(?:모드|mode|역할|ai|인공지능|상태)/.test(text)
  const jailbreakInstruction = /(?:안전지침|안전정책|안전정첵|safetypolicy|모든정책|모든제한|가드레일|guardrails?).{0,30}(?:무시|무시햬|ignore|해제|disable|우회|bypass|따르지)/.test(text)
    || /(?:제한|브레이크|안전장치).{0,20}(?:전부풀|내려놓|따르지)/.test(text)
    || /(?:역할을?|role).{0,16}(?:재정의|바꿔|override)/.test(text)
  if ((jailbreakRole || jailbreakInstruction) && (!defensiveContext || explicitHarmfulAction)) return decision('JAILBREAK')

  const instructionOverride = /(?:지금까지|이전|위의|앞선|모든).{0,24}(?:지시|명령|instructions?).{0,16}(?:무시|무시해|ignore|잊어)/.test(text)
    || /(?:ignore).{0,24}(?:previous|prior|all).{0,16}(?:instructions?)/.test(text)
  const promptDisclosure = /(?:시스템프롬프트|시스템프롬푸트|systemprompt|내부지시|숨은지시|internalinstructions?).{0,36}(?:전체|원문|그대로|한글자도|빠짐없이|verbatim|출력|공개|보여|말해)/.test(text)
  const defensivePromptRequest = /(?:원문출력|(?:이전|앞선|모든)?.{0,8}지시.{0,4}무시|ignorepreviousinstructions|프롬프트인젝션|promptinjection).{0,20}(?:패턴|요청|문장|공격)?.{0,12}(?:탐지|차단|방어|분석|설명)/.test(text)
  if ((instructionOverride || promptDisclosure) && !defensivePromptRequest) return decision('PROMPT_INJECTION')

  const sensitiveData = /(?:모든|전체|전부|전원).{0,24}(?:유저|user|사용자|가입자|고객|회원).{0,36}(?:이메일|email|비밀번호|password|패스워드|해시|hash|개인정보|인증정보)/.test(text)
    || /(?:유저|user|사용자|가입자|고객|회원).{0,24}(?:모든|전체|전부|전원).{0,36}(?:이메일|email|비밀번호|password|패스워드|해시|hash|개인정보|인증정보)/.test(text)
    || /(?:이메일|비밀번호|패스워드|해시|개인정보|인증정보).{0,36}(?:모든|전체).{0,24}(?:유저|사용자|가입자|고객)/.test(text)
  const externalTransfer = /(?:외부|외부url|evil|webhook|웹훅|내서버|내server|개인서버|회사.{0,8}밖|우리.{0,8}밖).{0,30}(?:전송|보내|업로드|upload|유출|넘겨|빼내)/.test(text)
    || /(?:전송|보내|업로드|유출).{0,30}(?:외부|url|웹훅|webhook)/.test(text)
  if (sensitiveData && externalTransfer && (!defensiveContext || explicitHarmfulAction)) return decision('DATA_EXFILTRATION')

  const earlyImpersonation = /(?:은행|법원|세무서|관공서|경찰|통신사|가족|상속인).{0,30}(?:사칭|피싱|phishing|가짜문자|가짜링크).{0,30}(?:작성|만들|보내|전송|뿌려|유도)/.test(text)
  if (earlyImpersonation && (!defensiveContext || explicitHarmfulAction)) return decision('SOCIAL_ENGINEERING')

  const maliciousMethod = /(?:브루트포스|브루투포스|무차별대입|credentialstuffing|passwordspray|계정.{0,12}뚫|비밀번호.{0,20}(?:대입|하나씩|계속).{0,12}(?:넣|시도)?|로그인.{0,16}공격|피싱|악성코드)/.test(text)
  const maliciousAction = /(?:자동화|워크플로|스크립트|코드|봇|매크로|만들어|실행|공격|침입|해킹|돌려)/.test(text)
  if (maliciousMethod && maliciousAction && (!defensiveContext || explicitHarmfulAction)) return decision('MALICIOUS_AUTOMATION')

  const identityTarget = /(?:고인|사망자|망인|돌아가신분|타인|다른사람).{0,24}(?:명의|계정|휴대폰|전화|인증|인증번호|잠금)/.test(text)
  const identityBypass = /(?:본인인척|본인인것처럼|주인인척|몰래|인증.{0,10}우회|비밀번호.{0,10}재설정|대신.{0,8}로그인|인증번호.{0,10}가로채|명의.{0,10}써서접속|잠금.{0,10}통과)/.test(text)
  const defensiveIdentityCheck = /(?:도용|사칭|우회|무단접속).{0,12}(?:탐지|차단|신고|확인)/.test(text)
  if (identityTarget && identityBypass && !defensiveIdentityCheck) return decision('IDENTITY_ABUSE')

  const officialDocument = /(?:사망진단서|사망증명서|인감증명서|가족관계증명서|기본증명서|위임장|유언장|금융서류|법원서류|공식문서|증명서|진단서)/.test(text)
  const forgeryAction = /(?:위조|위쪼|조작|가짜.{0,8}만들|날짜.{0,8}바꿔|금액.{0,8}바꿔|서명.{0,8}따라|도장.{0,8}합성|내용.{0,8}꾸며|그럴듯하게.{0,8}손봐)/.test(text)
  const defensiveForgeryCheck = /(?:위조|위쪼|조작|가짜).{0,16}(?:탐지|확인|신고|정정|재발급|취소)/.test(text)
    || /(?:탐지|확인|신고|정정|재발급|취소).{0,16}(?:위조|위쪼|조작|가짜)/.test(text)
  if (officialDocument && forgeryAction && !defensiveForgeryCheck) return decision('DOCUMENT_FORGERY')

  const concealmentTarget = /(?:상속재산|상속자산|상속asset|재산|자산|계좌|현금|증여|거래|세금|상속세|채권자)/.test(text)
  const concealmentAction = /(?:안들키게|추적안되게|신고.{0,8}빼|신고하지않|숨기는방법|은닉하는방법|장부.{0,8}제외|목록.{0,8}누락|몰래.{0,8}옮겨|빼돌|(?:세금|tax).{0,8}안내|채권자.{0,8}피해)/.test(text)
  const defensiveConcealmentCheck = /(?:숨긴|은닉|누락).{0,12}(?:재산|자산|계좌).{0,12}(?:찾|확인|조회|신고)/.test(text)
  if (concealmentTarget && concealmentAction && !defensiveConcealmentCheck) return decision('ASSET_CONCEALMENT')

  const impersonatedParty = /(?:은행|법원|세무서|관공서|경찰|통신사|가족|상속인)/.test(text)
  const socialEngineering = /(?:사칭|사칭문자|피싱|phishing|가짜문자|가짜링크|속이는문자|속이는메일|진짜처럼보이는문자)/.test(text)
  const socialEngineeringAction = /(?:작성|만들|보내|전송|뿌려|유도)/.test(text)
  if (impersonatedParty && socialEngineering && socialEngineeringAction) return decision('SOCIAL_ENGINEERING')

  const thirdPartyTarget = /(?:남의|타인|다른사람|그사람|특정인|모든사람|전체사용자|전체고객)/.test(text)
  const privateIdentifier = /(?:주민등록번호|주민번호|rrn|13자리신원번호|계좌번호|카드번호|전화번호|휴대폰번호|집주소|상세주소|개인이메일|인증번호)/.test(text)
  const harvestingAction = /(?:찾아|알려|알아내|조회|수집|긁어|크롤링|추출|목록|넘겨)/.test(text)
  if (thirdPartyTarget && privateIdentifier && harvestingAction && (!defensiveContext || explicitHarmfulAction)) return decision('PII_HARVESTING')

  const secretReference = /(?:env|환경변수|apikey|databaseurl|jwtsecret|servicerole|accesstoken|비밀키|시크릿|토큰|서버비밀번호)/.test(text)
  const secretDisclosure = /(?:값을?(?:전부|모두)?|실제값|원문|전체내용|그대로|노출|출력|보여|알려줘|읽어줘|공개|show|print|reveal|dump)/.test(text)
  const safeSecretInspection = /(?:존재여부|설정여부|설정됐는지|형식만|마스킹|설정방법|추가방법)/.test(text)
  if (secretReference && secretDisclosure && !safeSecretInspection && (!defensiveContext || explicitHarmfulAction)) return decision('SECRET_EXTRACTION')

  return null
}

/**
 * 현재 입력을 먼저 검사하고, 단독으로 안전해 보이면 최근 사용자 발화와 결합해
 * 여러 턴으로 나뉜 공격 의도를 한 번 더 검사한다.
 */
export function detectAdversarialInput(
  input: string,
  previousUserMessages: string[] = [],
): AdversarialInputDecision | null {
  const currentDecision = detectNormalizedInput(normalize(input))
  if (currentDecision) return currentDecision

  const recentContext = previousUserMessages.slice(-3)
  if (recentContext.length === 0) return null

  return detectNormalizedInput(normalize([...recentContext, input].join(' ')))
}
