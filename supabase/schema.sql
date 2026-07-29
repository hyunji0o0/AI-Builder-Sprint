-- 커뮤니티(경험 나눔) 기능용 스키마.
-- Supabase 프로젝트의 SQL Editor에서 이 파일 내용을 그대로 실행하면 됩니다.
-- 브라우저는 이 테이블에 직접 접근하지 않고, 항상 우리 서버(vite 플러그인)가
-- service role key로만 접근하므로 RLS 정책은 별도로 만들지 않습니다.

create extension if not exists vector;

create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  category text not null,
  content text not null,
  created_at timestamptz not null default now(),
  helpful_count int not null default 0,
  embedding vector(1536)
);

create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  parent_id uuid references community_comments(id) on delete cascade,
  nickname text not null,
  content text not null,
  created_at timestamptz not null default now(),
  embedding vector(1536)
);

create index if not exists community_posts_category_idx on community_posts(category);
create index if not exists community_comments_post_id_idx on community_comments(post_id);
create index if not exists community_comments_parent_id_idx on community_comments(parent_id);
