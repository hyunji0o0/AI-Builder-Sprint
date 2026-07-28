import { useState } from "react";
import { CATEGORIES } from "./communityMockData";

const POST_CATEGORIES = CATEGORIES.filter((c) => c.id !== "all");

// 인증 붙기 전까지는 닉네임을 직접 입력받음.
// 나중에 로그인 붙이면 nickname state를 로그인 유저 정보로 대체하면 됨 (스키마 변경 없음).
// 카테고리는 필수값 (메인챗이 F2 할일 카테고리와 매칭해서 관련 팁을 골라감).
export default function ComposeBox({ onSubmit, defaultNickname = "" }) {
  const [nickname, setNickname] = useState(defaultNickname);
  const [category, setCategory] = useState(POST_CATEGORIES[0].id);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim() || !nickname.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ nickname: nickname.trim(), category, content: content.trim() });
      setContent("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/90 rounded-3xl p-4 shadow-sm border border-black/5 flex flex-col gap-3"
    >
      <div className="flex gap-2 overflow-x-auto">
        {POST_CATEGORIES.map((cat) => {
          const isActive = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={
                "px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition " +
                (isActive
                  ? "font-medium bg-gradient-to-r from-orange-200 to-rose-200 text-orange-800 border-transparent"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300")
              }
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-200 to-rose-200 flex items-center justify-center text-orange-600 text-sm shrink-0">
          ✦
        </div>

        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임"
          className="w-20 bg-transparent text-sm outline-none placeholder:text-gray-400 shrink-0 border-r border-gray-100 pr-2"
        />

        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="오늘 겪은 일, 도움이 됐던 팁을 나눠주세요"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-9 h-9 rounded-full bg-gradient-to-r from-orange-400 to-rose-400 text-white flex items-center justify-center shrink-0 disabled:opacity-50"
          aria-label="글 등록"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
