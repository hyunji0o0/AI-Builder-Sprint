import type { CommunityCategory, CommunityPost } from '../schemas/community'

const post = (
  id: string,
  categories: CommunityCategory[],
  content: string,
  helpfulCount = 0,
): CommunityPost => ({
  id,
  nickname: `작성자-${id}`,
  categories,
  content,
  helpfulCount,
  createdAt: '2026-08-01T00:00:00.000Z',
})

export const communitySearchEvalPosts: CommunityPost[] = [
  post('phone-1', ['SUBSCRIPTION'], '휴대폰 해지 전에 사진과 연락처를 백업했어요. 통신사에 사망진단서와 가족관계증명서를 냈어요.', 18),
  post('phone-1-copy', ['SUBSCRIPTION'], '휴대폰 해지 전에 사진과 연락처를 백업했어요. 통신사에 사망진단서와 가족관계증명서를 냈어요. 꼭 먼저 백업하세요.', 4),
  post('phone-2', ['SUBSCRIPTION'], '통신사 회선을 바로 종료하지 않고 요금과 소액결제를 확인한 뒤 명의 정리를 했어요.', 9),
  post('renounce-1', ['RENOUNCE'], '상속포기 신청 전에 가정법원 기한을 확인하고 재산을 임의로 처분하지 않았어요.', 23),
  post('renounce-2', ['RENOUNCE'], '빚과 대출이 많아 한정승인과 상속포기를 비교한 뒤 전문가 상담을 받았어요.', 15),
  post('renounce-3', ['RENOUNCE'], '상속채무 조회가 늦어져 법원에 필요한 서류와 접수 방법을 먼저 확인했어요.', 7),
  post('tax-1', ['TAX'], '상속세 신고기한 전에 세무서에서 공제 항목과 필요한 자료를 확인했어요.', 14),
  post('tax-2', ['TAX'], '부동산과 예금의 상속세를 계산하려고 평가 자료를 모아 세금 신고를 준비했어요.', 8),
  post('insurance-1', ['INSURANCE'], '보험금 청구 전에 수익자와 필요한 사망 서류를 보험사에 확인했어요.', 12),
  post('insurance-2', ['INSURANCE'], '여러 보험사의 숨은 보험을 조회하고 각각 보험청구 서류를 제출했어요.', 6),
  post('funeral-1', ['ETC'], '장례식장 빈소에서 조문객을 맞을 때 가족끼리 역할을 나누니 덜 정신없었어요.', 21),
  post('funeral-2', ['ETC'], '장례 후 부의금과 장례비 영수증을 함께 정리해 두니 나중에 확인하기 편했어요.', 11),
  post('transfer-1', ['TRANSFER'], '자동차 명의이전 전에 상속인 서류와 차량등록사업소 준비물을 확인했어요.', 10),
  post('forgery-report-1', ['ETC'], '가짜 인감증명서가 의심돼 문서를 사용하지 않고 발급기관과 경찰에 신고했어요.', 3),
  post('debt-1', ['RENOUNCE'], '고인 계좌와 대출을 안심상속 금융조회로 확인해 재산과 채무 목록을 만들었어요.', 17),
  post('phishing-1', ['ETC'], '법원 사칭문자와 가짜 링크를 받아 클릭하지 않고 스미싱으로 신고했어요.', 13),
  post('irrelevant-lunch', ['ETC'], '점심 메뉴로 김치찌개를 먹고 근처 카페에 다녀왔어요.', 30),
]

export type CommunitySearchEvalCase = {
  id: string
  query: string
  expectedRelevantIds: string[]
  embeddingScores: Record<string, number>
}

export const communitySearchEvalCases: CommunitySearchEvalCase[] = [
  {
    id: 'phone-cancellation',
    query: '고인 휴대폰 바로 해지해도 돼?',
    expectedRelevantIds: ['phone-1', 'phone-2'],
    embeddingScores: { 'phone-1': 0.53, 'phone-1-copy': 0.51, 'phone-2': 0.49, 'irrelevant-lunch': 0.34 },
  },
  {
    id: 'inheritance-renunciation',
    query: '상속포기 전에 무엇을 확인해야 해?',
    expectedRelevantIds: ['renounce-1', 'renounce-2', 'renounce-3'],
    embeddingScores: { 'renounce-1': 0.56, 'renounce-2': 0.51, 'renounce-3': 0.47, 'tax-1': 0.31 },
  },
  {
    id: 'inheritance-tax',
    query: '상속세 신고 기한과 공제 준비 팁',
    expectedRelevantIds: ['tax-1', 'tax-2'],
    embeddingScores: { 'tax-1': 0.55, 'tax-2': 0.5, 'funeral-2': 0.33 },
  },
  {
    id: 'insurance-claim',
    query: '사망 보험금 청구 서류 알려줘',
    expectedRelevantIds: ['insurance-1', 'insurance-2'],
    embeddingScores: { 'insurance-1': 0.54, 'insurance-2': 0.48, 'transfer-1': 0.29 },
  },
  {
    id: 'funeral-visitors',
    query: '장례식장 조문객 맞는 팁',
    expectedRelevantIds: ['funeral-1', 'funeral-2'],
    embeddingScores: { 'funeral-1': 0.52, 'funeral-2': 0.44, 'phone-1': 0.28 },
  },
  {
    id: 'vehicle-transfer',
    query: '고인 자동차 명의 이전 준비물',
    expectedRelevantIds: ['transfer-1'],
    embeddingScores: { 'transfer-1': 0.55, 'phone-2': 0.33, 'irrelevant-lunch': 0.32 },
  },
  {
    id: 'forged-document-report',
    query: '위조 인감증명서 신고 방법',
    expectedRelevantIds: ['forgery-report-1'],
    embeddingScores: { 'forgery-report-1': 0.52, 'renounce-3': 0.33 },
  },
  {
    id: 'debt-discovery',
    query: '고인 빚과 대출 계좌 조회 경험담',
    expectedRelevantIds: ['debt-1', 'renounce-2'],
    embeddingScores: { 'debt-1': 0.57, 'renounce-2': 0.45, 'tax-2': 0.31 },
  },
  {
    id: 'phishing-report',
    query: '법원 사칭 피싱 문자 신고',
    expectedRelevantIds: ['phishing-1'],
    embeddingScores: { 'phishing-1': 0.58, 'forgery-report-1': 0.3 },
  },
  {
    id: 'unrelated-menu',
    query: '오늘 저녁 메뉴 추천해줘',
    expectedRelevantIds: [],
    embeddingScores: { 'irrelevant-lunch': 0.34, 'funeral-2': 0.18 },
  },
]

