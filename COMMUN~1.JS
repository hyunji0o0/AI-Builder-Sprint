// 시드/개발용 목데이터. 실제 연동 전까지 CommunityPage에서 폴백으로 사용.
// 카테고리는 F2 할일 카테고리와 동일하게 맞춤 (메인챗이 필터링하기 쉽도록).

export const CATEGORIES = [
  { id: "all", label: "전체" },
  { id: "renounce", label: "상속포기·한정승인" },
  { id: "tax", label: "상속세" },
  { id: "transfer", label: "명의이전" },
  { id: "insurance", label: "보험청구" },
  { id: "subscription", label: "통신·구독해지" },
  { id: "etc", label: "기타" },
];

// 카테고리별 배지 색상 (Tailwind 기본 팔레트만 사용)
export const CATEGORY_STYLE = {
  renounce: "bg-rose-50 text-rose-600",
  tax: "bg-amber-50 text-amber-700",
  transfer: "bg-teal-50 text-teal-700",
  insurance: "bg-indigo-50 text-indigo-600",
  subscription: "bg-pink-50 text-pink-600",
  etc: "bg-gray-100 text-gray-500",
};

export const CATEGORY_LABEL = Object.fromEntries(
  CATEGORIES.filter((c) => c.id !== "all").map((c) => [c.id, c.label])
);

// 팀원 계정으로 미리 채워둘 시드 글 (데모 콜드스타트 방지용)
export const MOCK_POSTS = [
  {
    id: 1,
    nickname: "늦가을",
    category: "renounce",
    content:
      "안심상속 통지서에 캐피탈 대출이 찍혀서 놀랐는데, 지점 방문 없이 우편으로도 상속포기 서류 접수가 됐어요. 3개월 기한 꼭 확인하세요.",
    createdAt: "2026-07-27T09:00:00Z",
    helpfulCount: 12,
    aiPicked: true,
  },
  {
    id: 2,
    nickname: "해질무렵",
    category: "subscription",
    content:
      "아버지 명의 통신사 자동이체가 4개나 있었어요. 명의자 사망 시 위약금 면제되는 경우가 많으니 상담원한테 꼭 물어보세요.",
    createdAt: "2026-07-26T09:00:00Z",
    helpfulCount: 9,
    aiPicked: true,
  },
  {
    id: 3,
    nickname: "작은배",
    category: "insurance",
    content:
      "보험금 청구할 때 사망진단서 원본 대신 사본도 가능한 보험사가 있더라고요. 콜센터에 먼저 전화로 확인하고 방문했어요.",
    createdAt: "2026-07-24T09:00:00Z",
    helpfulCount: 6,
    aiPicked: false,
  },
  {
    id: 4,
    nickname: "느린오후",
    category: "tax",
    content:
      "상속세 신고 전에 세무사 무료 상담을 지역 세무서에서 해줘요. 예약하고 가면 기본적인 방향은 잡을 수 있어요.",
    createdAt: "2026-07-22T09:00:00Z",
    helpfulCount: 15,
    aiPicked: false,
  },
  {
    id: 5,
    nickname: "먼구름",
    category: "transfer",
    content:
      "자동차 명의이전, 생각보다 서류가 간단했어요. 상속인 전원 인감 대신 대표상속인 위임장으로도 처리 가능했습니다.",
    createdAt: "2026-07-21T09:00:00Z",
    helpfulCount: 4,
    aiPicked: false,
  },
];
