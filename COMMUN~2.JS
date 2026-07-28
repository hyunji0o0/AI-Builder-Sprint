// 메인챗(에이전트) 팀과 합의한 API 계약.
// GET  /api/community/posts?category=xxx&limit=n
// POST /api/community/posts  { nickname, category, content }
//
// 백엔드가 아직 없으면 이 파일의 함수만 mock으로 바꿔서 CommunityPage에 그대로 연결하면 됨.

export async function fetchCommunityPosts({ category = "all", limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (category && category !== "all") params.set("category", category);
  if (limit) params.set("limit", String(limit));

  const res = await fetch(`/api/community/posts?${params.toString()}`);
  if (!res.ok) throw new Error("커뮤니티 글을 불러오지 못했어요.");
  return res.json();
}

export async function createCommunityPost({ nickname, category, content }) {
  const res = await fetch("/api/community/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, category, content }),
  });
  if (!res.ok) throw new Error("글을 등록하지 못했어요.");
  return res.json();
}
