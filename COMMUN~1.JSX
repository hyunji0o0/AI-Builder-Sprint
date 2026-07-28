import { useEffect, useState } from "react";
import CategoryTabs from "./CategoryTabs";
import PostCard from "./PostCard";
import ComposeBox from "./ComposeBox";
import { MOCK_POSTS } from "./communityMockData";
import { fetchCommunityPosts, createCommunityPost } from "./communityApi";

// 기존 앱 셸(사이드바·헤더)은 팀원이 만든 레이아웃 안에 이 컴포넌트를 끼워 넣는 걸 가정.
// 백엔드 API가 아직 없으면 MOCK_POSTS로 자동 폴백.
export default function CommunityPage() {
  const [category, setCategory] = useState("all");
  const [posts, setPosts] = useState(MOCK_POSTS);
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCommunityPosts({ category })
      .then((data) => {
        if (!cancelled) {
          setPosts(data);
          setUsingMock(false);
        }
      })
      .catch(() => {
        // API 없으면 mock 데이터로 필터링해서 보여줌
        if (!cancelled) {
          setUsingMock(true);
          setPosts(
            category === "all"
              ? MOCK_POSTS
              : MOCK_POSTS.filter((p) => p.category === category)
          );
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [category]);

  async function handleSubmit({ nickname, category: cat, content }) {
    const optimistic = {
      id: `local-${Date.now()}`,
      nickname,
      category: cat,
      content,
      createdAt: new Date().toISOString(),
      helpfulCount: 0,
      aiPicked: false,
    };

    if (usingMock) {
      setPosts((prev) => [optimistic, ...prev]);
      return;
    }

    try {
      const saved = await createCommunityPost({ nickname, category: cat, content });
      setPosts((prev) => [saved, ...prev]);
    } catch {
      setPosts((prev) => [optimistic, ...prev]);
    }
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4">
      <div className="bg-white/90 rounded-3xl p-6 shadow-sm border border-black/5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] tracking-[0.2em] text-gray-400 uppercase mb-1">
            경험 나눔 · COMMUNITY
          </p>
          <h1 className="text-2xl font-semibold text-gray-800">
            다른 가족들의 이야기를 나눠요
          </h1>
        </div>
      </div>

      <CategoryTabs active={category} onChange={setCategory} />

      <div className="flex flex-col gap-3">
        {loading && posts.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">불러오는 중이에요...</p>
        )}
        {!loading && posts.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            아직 이 카테고리에 글이 없어요. 첫 경험을 나눠주세요.
          </p>
        )}
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      <ComposeBox onSubmit={handleSubmit} />
      <p className="text-center text-[11px] text-gray-400">
        AI는 업무 정리를 돕는 안내자예요. 중요한 결정은 전문가와 확인해 주세요.
      </p>
    </div>
  );
}
