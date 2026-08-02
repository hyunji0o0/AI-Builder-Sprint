-- embedding 컬럼 차원 수정: vector(1536) → vector(4096).
-- 라이브 DB가 초기 스키마의 1536 그대로라서, Solar 임베딩(4096차원) 저장이
-- 전부 "expected 1536 dimensions" 에러로 조용히 실패하고 있었음(2026-07-30 확인).
-- 두 컬럼 모두 현재 전부 null이라 데이터 손실 없이 바로 바꿀 수 있음.
-- (match_community_posts 함수는 migration_multi_category.sql에서 이미 vector(4096)
-- 시그니처로 재정의돼 있어서 여기서 다시 만들 필요 없음.)
--
-- 실행 후: node scripts/backfill-embeddings.mjs 로 기존 글 65개 임베딩 채우기.

alter table community_posts alter column embedding type vector(4096);
alter table community_comments alter column embedding type vector(4096);
