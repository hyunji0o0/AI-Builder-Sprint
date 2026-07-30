-- 커뮤니티(경험 나눔) 기능용 스키마.
-- Supabase 프로젝트의 SQL Editor에서 이 파일 내용을 그대로 실행하면 됩니다.
-- 브라우저는 이 테이블에 직접 접근하지 않고, 항상 우리 서버(vite 플러그인)가
-- service role key로만 접근하므로 RLS 정책은 별도로 만들지 않습니다.

create extension if not exists vector;

create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  categories text[] not null, -- 글 하나에 카테고리 여러 개. enum이 아니라 text[]라 카테고리 추가 시 DB 변경 불필요
  content text not null,
  created_at timestamptz not null default now(),
  helpful_count int not null default 0,
  embedding vector(4096) -- Upstage solar-embedding-1-large 차원
);

create table if not exists community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references community_posts(id) on delete cascade,
  parent_id uuid references community_comments(id) on delete cascade,
  nickname text not null,
  content text not null,
  created_at timestamptz not null default now(),
  embedding vector(4096)
);

create index if not exists community_posts_categories_idx on community_posts using gin(categories);
create index if not exists community_comments_post_id_idx on community_comments(post_id);
create index if not exists community_comments_parent_id_idx on community_comments(parent_id);

-- 카테고리로 먼저 좁히고, 그 안에서 코사인 유사도로 정렬해 상위 N개를 돌려주는 함수.
-- 지금 규모(수십~수백 개)에서는 별도 ivfflat/hnsw 인덱스 없이 순차 스캔으로 충분히
-- 빠름 — 나중에 데이터가 수만 건 이상으로 커지면 그때 인덱스 추가 고려.
create or replace function match_community_posts(
  query_embedding vector(4096),
  match_category text default null,
  match_count int default 5
)
returns table (
  id uuid,
  nickname text,
  categories text[],
  content text,
  created_at timestamptz,
  helpful_count int,
  similarity float
)
language sql stable
as $$
  select
    id, nickname, categories, content, created_at, helpful_count,
    1 - (embedding <=> query_embedding) as similarity
  from community_posts
  where embedding is not null
    and (match_category is null or match_category = any(categories))
  order by embedding <=> query_embedding
  limit match_count;
$$;
