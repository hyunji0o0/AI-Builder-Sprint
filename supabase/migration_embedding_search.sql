-- 이미 만들어져 있는 프로젝트(테이블이 이미 존재하고 embedding이 vector(1536)인 경우)에
-- 적용하는 마이그레이션. SQL Editor에서 한 번 실행하면 됨. 컬럼이 전부 null이라
-- 안전하게 차원을 바꿀 수 있음(데이터 손실 없음).

alter table community_posts alter column embedding type vector(4096);
alter table community_comments alter column embedding type vector(4096);

create or replace function match_community_posts(
  query_embedding vector(4096),
  match_category text default null,
  match_count int default 5
)
returns table (
  id uuid,
  nickname text,
  category text,
  content text,
  created_at timestamptz,
  helpful_count int,
  similarity float
)
language sql stable
as $$
  select
    id, nickname, category, content, created_at, helpful_count,
    1 - (embedding <=> query_embedding) as similarity
  from community_posts
  where embedding is not null
    and (match_category is null or category = match_category)
  order by embedding <=> query_embedding
  limit match_count;
$$;
