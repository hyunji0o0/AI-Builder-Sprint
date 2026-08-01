-- 이미 만들어져 있는 프로젝트(category가 단일 text 컬럼인 경우)에 적용하는
-- 마이그레이션. SQL Editor에서 한 번 실행하면 됨. 기존 category 값은 배열
-- 하나짜리로 그대로 옮겨지니 데이터 손실 없음.

alter table community_posts add column categories text[];
update community_posts set categories = array[category] where categories is null;
alter table community_posts alter column categories set not null;
alter table community_posts alter column categories set default '{}';

drop index if exists community_posts_category_idx;
alter table community_posts drop column category;
create index if not exists community_posts_categories_idx on community_posts using gin (categories);

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
