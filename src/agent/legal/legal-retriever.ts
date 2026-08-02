import { legalSources, LegalSource } from './legal-sources'

const compact = (value: string) => value.replace(/\s+/g, '')

export const isLegalInformationQuestion = (input: string) => {
  const text = compact(input)
  return /법|법률|조항|법적|언제까지|기한|기간|몇개월|몇달/.test(text)
    && /상속|상속포기|한정승인|사망신고|사망 신고/.test(input)
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
  const primary = sources[0]
  const heading = /사망\s*신고/.test(input) ? '사망신고 관련 법 기준을 확인했어.' : '상속 관련 법정 기간을 확인했어.'
  return `${heading}\n\n${primary.lawName} ${primary.article} 기준으로 ${primary.rule}\n\n다만 ${primary.caution}\n\n아래 공식 법령 원문도 함께 확인해줘. 이 안내는 법률정보이고 개별 사건에 대한 법률 자문은 아니야.`
}

