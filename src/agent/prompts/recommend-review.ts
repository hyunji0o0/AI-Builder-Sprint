export const recommendReviewPrompt = {
  id: 'recommend-review-v0.1',
  purpose: '후기 검색 조건과 추천 이유를 구성하되 후기를 공식 정보로 표현하지 않음',
  input: '{ taskType, relation, region, financialSituation, keywords, limit }',
  output: '{ query, rankingHints }',
  template: '업무·상황·지역 유사도, 도움 수, 최신성, 완성도를 사용하며 사용자 경험 라벨과 공식 정보가 아니라는 안내를 요구합니다.',
} as const

