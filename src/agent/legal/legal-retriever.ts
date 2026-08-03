import { legalSources, LegalSource } from './legal-sources'

const compact = (value: string) => value.replace(/\s+/g, '')

const inheritanceTopicPattern = /상속|상속포기|한정승인|단순승인/
const legalRuleQuestionPattern = /법|법률|조항|법적|언제까지|기한|기간|몇개월|몇달/
const inheritanceProcedureQuestionPattern = /절차|과정|순서|진행방법|신청방법|알아보|알려|설명|더보|더보내/

export const isInheritanceProcedureQuestion = (input: string) => {
  const text = compact(input)
  return inheritanceTopicPattern.test(text) && inheritanceProcedureQuestionPattern.test(text)
}

export const isLegalInformationQuestion = (input: string) => {
  const text = compact(input)
  const asksLegalRule = legalRuleQuestionPattern.test(text)
    && /상속|상속포기|한정승인|단순승인|사망신고/.test(text)
  return asksLegalRule || isInheritanceProcedureQuestion(input)
}

export const retrieveLegalSources = (input: string): LegalSource[] => {
  const text = compact(input)
  const ranked = legalSources
    .map((source) => ({
      source,
      score: source.topics.reduce((score, topic) => score + (text.includes(compact(topic)) ? 3 : 0), 0)
        + (/사망신고/.test(text) && source.id.startsWith('family-registration') ? 2 : 0)
        + (/상속|한정승인|상속포기/.test(text) && source.id.startsWith('civil-act') ? 2 : 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
  return ranked.slice(0, 3).map((item) => item.source)
}

export const composeGroundedLegalAnswer = (input: string, sources: LegalSource[]) => {
  if (!sources.length) return '이 질문에 맞는 확인된 법령 근거를 로컬 자료에서 찾지 못했어. 임의로 답하지 않고 공식 법령을 다시 확인해야 해.'

  if (isInheritanceProcedureQuestion(input)) {
    const deadlineSource = sources.find((source) => source.id === 'civil-act-1019-1') ?? sources[0]
    const investigationSource = sources.find((source) => source.id === 'civil-act-1019-2')
    const investigationStep = investigationSource
      ? `2. **재산과 채무 확인** — ${investigationSource.lawName} ${investigationSource.article}에 따라 승인이나 포기 전에 상속재산을 조사할 수 있어.`
      : '2. **재산과 채무 확인** — 확인된 자료와 아직 확인하지 못한 항목을 나눠 정리해.'

    return `상속 관련 절차를 공식 법령 근거에 맞춰 큰 순서로 정리할게.

1. **기준 날짜 확인** — 상속이 시작된 사실을 안 날을 확인해. 이 날짜가 법정 기간을 계산하는 기준이 될 수 있어.
${investigationStep}
3. **상속 방법 검토** — ${deadlineSource.lawName} ${deadlineSource.article}은 상속인이 기준일로부터 3개월 안에 단순승인, 한정승인 또는 상속포기를 선택할 수 있다고 정하고 있어.
4. **공식 절차 확인** — 실제 선택과 제출은 확인된 자료를 가지고 법원 또는 법률 전문가에게 사건별 요건을 확인한 뒤 진행해.

지금 확인된 자산·채무만으로 특정 방법을 권하지는 않을게. 특히 미확인 자료가 있거나 기준 날짜가 불분명하면 그 부분부터 확인하는 게 중요해.

아래 공식 법령 원문도 함께 확인해줘. 이 안내는 법률정보이며 개별 사건에 대한 법률 자문은 아니야.`
  }

  const primary = sources[0]
  const heading = /사망\s*신고/.test(input) ? '사망신고 관련 법 기준을 확인했어.' : '상속 관련 법정 기간을 확인했어.'
  return `${heading}\n\n${primary.lawName} ${primary.article} 기준으로 ${primary.rule}\n\n다만 ${primary.caution}\n\n아래 공식 법령 원문도 함께 확인해줘. 이 안내는 법률정보이고 개별 사건에 대한 법률 자문은 아니야.`
}
