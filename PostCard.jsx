import { CATEGORY_STYLE, CATEGORY_LABEL } from "./communityMockData";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "오늘";
  if (days === 1) return "1일 전";
  if (days < 7) return `${days}일 전`;
  return `${Math.floor(days / 7)}주 전`;
}

export default function PostCard({ post }) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-black/5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-200 to-rose-200 flex items-center justify-center text-gray-600 text-xs font-medium shrink-0">
          {post.nickname?.[0] ?? "?"}
        </div>
        <p className="text-sm font-medium text-gray-700">{post.nickname}</p>
        <p className="text-xs text-gray-400">{timeAgo(post.createdAt)}</p>
        <span
          className={
            "ml-auto text-[11px] px-2.5 py-1 rounded-full font-medium " +
            (CATEGORY_STYLE[post.category] ?? CATEGORY_STYLE.etc)
          }
        >
          {CATEGORY_LABEL[post.category] ?? "기타"}
        </span>
      </div>

      <p className="text-sm text-gray-600 leading-relaxed">{post.content}</p>

      <div className="flex items-center gap-3 mt-3">
        <span className="text-xs text-gray-400">♥ 공감 {post.helpfulCount ?? 0}</span>
        {post.aiPicked && (
          <span className="text-[11px] text-orange-500 bg-orange-50 rounded-full px-2 py-1 inline-flex items-center gap-1">
            ✦ AI 추천 팁
          </span>
        )}
      </div>
    </div>
  );
}
