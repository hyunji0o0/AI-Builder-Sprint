export type LegalSource = {
  id: string
  topics: string[]
  lawName: string
  article: string
  effectiveDate: string
  checkedAt: string
  sourceUrl: string
  rule: string
  caution: string
}

/**
 * 서비스에서 자주 안내하는 조항만 공식 국가법령정보센터를 기준으로 정리한 로컬 스냅샷이다.
 * LLM의 기억이 아니라 아래 조항과 링크를 근거로 답한다. 법령 개정 여부는 checkedAt 이후
 * 달라질 수 있으므로 배포 전 정기적으로 공식 원문과 대조한다.
 */
export const legalSources: LegalSource[] = [
  {
    id: 'civil-act-1019-1',
    topics: ['상속 기한', '상속포기 기한', '한정승인 기한', '승인 포기 기간'],
    lawName: '민법',
    article: '제1019조 제1항',
    effectiveDate: '2026-03-17',
    checkedAt: '2026-08-03',
    sourceUrl: 'https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1032404547',
    rule: '상속인은 상속이 시작된 사실을 안 날부터 3개월 안에 단순승인, 한정승인 또는 상속포기를 선택할 수 있고, 이해관계인이나 검사의 청구가 있으면 가정법원이 그 기간을 연장할 수 있어.',
    caution: '3개월의 시작일은 단순한 사망일과 항상 같지 않아서, 실제로 상속인이 된 사실을 언제 알았는지 사건별 확인이 필요해.',
  },
  {
    id: 'civil-act-1019-2',
    topics: ['상속 재산 조사', '재산 채무 확인', '상속 기한'],
    lawName: '민법',
    article: '제1019조 제2항',
    effectiveDate: '2026-03-17',
    checkedAt: '2026-08-03',
    sourceUrl: 'https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1032404547',
    rule: '상속인은 승인이나 포기를 결정하기 전에 상속재산을 조사할 수 있어.',
    caution: '조사 중이라도 법정 기간이 자동으로 멈추는 것은 아니므로 기한을 별도로 확인해야 해.',
  },
  {
    id: 'civil-act-1019-3',
    topics: ['특별한정승인', '채무 초과', '빚을 뒤늦게 발견'],
    lawName: '민법',
    article: '제1019조 제3항',
    effectiveDate: '2026-03-17',
    checkedAt: '2026-08-03',
    sourceUrl: 'https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1032404547',
    rule: '중대한 과실 없이 상속채무가 상속재산보다 많다는 사실을 정해진 기간 안에 알지 못했다면, 그 사실을 안 날부터 3개월 안에 특별한정승인을 검토할 수 있어.',
    caution: '중대한 과실 여부와 알게 된 시점은 법률 판단이 필요한 부분이라 전문가 확인이 필요해.',
  },
  {
    id: 'family-registration-act-84',
    topics: ['사망 신고 기한', '사망신고 법', '사망신고 서류'],
    lawName: '가족관계의 등록 등에 관한 법률',
    article: '제84조',
    effectiveDate: '2024-12-27',
    checkedAt: '2026-08-03',
    sourceUrl: 'https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1026221289',
    rule: '사망신고는 신고의무자가 사망 사실을 안 날부터 1개월 안에 진단서나 검안서를 첨부해 해야 해. 해당 서류를 얻을 수 없으면 사망 사실을 증명할 다른 서면을 붙이고 그 사유를 신고서에 적도록 정하고 있어.',
    caution: '신고서 기재사항과 대체 증빙 인정 여부는 접수기관에 원본 기준으로 다시 확인해야 해.',
  },
  {
    id: 'family-registration-act-85',
    topics: ['사망 신고 의무자', '누가 사망신고', '사망신고 법'],
    lawName: '가족관계의 등록 등에 관한 법률',
    article: '제85조',
    effectiveDate: '2024-12-27',
    checkedAt: '2026-08-03',
    sourceUrl: 'https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024561453',
    rule: '사망신고 의무자는 사망자와 동거하는 친족이고, 친족·동거자 또는 사망 장소를 관리하는 사람 등도 신고할 수 있도록 정하고 있어.',
    caution: '실제 신고 가능 여부와 필요한 신분·관계 서류는 접수기관에 확인해야 해.',
  },
]
