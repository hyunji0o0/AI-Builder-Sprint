import { CommunityCategory, CommunityPost, CreateCommunityPostInput, UpdateCommunityPostInput } from '../schemas/community'
import { supabase } from './supabase-client'
import { embedPassage } from './upstage-client'

// Supabase(Postgres)의 community_posts 테이블을 씀. 이전엔 파일 기반이었는데,
// 함수 시그니처는 그대로 유지해서 community-server-plugin.ts 쪽은 무변경.
type PostRow = {
  id: string
  nickname: string
  categories: string[]
  content: string
  created_at: string
  helpful_count: number
}

function fromRow(row: PostRow): CommunityPost {
  return {
    id: row.id,
    nickname: row.nickname,
    categories: row.categories as CommunityCategory[],
    content: row.content,
    createdAt: row.created_at,
    helpfulCount: row.helpful_count,
  }
}

export async function listCommunityPosts(
  category?: string,
  keyword?: string,
  sort: 'recent' | 'helpful' = 'recent',
): Promise<CommunityPost[]> {
  let query = supabase.from('community_posts').select('*')
  if (category && category !== 'ALL') query = query.contains('categories', [category])
  if (keyword && keyword.trim()) query = query.ilike('content', `%${keyword.trim()}%`)
  query =
    sort === 'helpful'
      ? query.order('helpful_count', { ascending: false }).order('created_at', { ascending: false })
      : query.order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) throw error
  return (data as PostRow[]).map(fromRow)
}

export async function createCommunityPost(input: CreateCommunityPostInput): Promise<CommunityPost> {
  const { data, error } = await supabase
    .from('community_posts')
    .insert({ nickname: input.nickname, categories: input.categories, content: input.content })
    .select()
    .single()
  if (error) throw error
  const post = fromRow(data as PostRow)

  // 임베딩은 백그라운드로 채움 — 글 등록 응답을 늦추거나 Upstage 장애로 실패하면 안 됨.
  embedPassage(input.content)
    .then(async (embedding) => {
      const { error } = await supabase
        .from('community_posts').update({ embedding }).eq('id', post.id)
      if (error) {throw error}
    })
    .catch((error) => {
      console.error('글 임베딩 생성 실패:', error)
    })
  return post
}

export async function getCommunityPost(id: string): Promise<CommunityPost | null> {
  const { data, error } = await supabase.from('community_posts').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? fromRow(data as PostRow) : null
}

export async function updateCommunityPost(id: string, input: UpdateCommunityPostInput): Promise<CommunityPost | null> {
  const { data, error } = await supabase
    .from('community_posts')
    .update({ categories: input.categories, content: input.content })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  // 내용이 바뀌었으니 임베딩도 다시 채움(안 그러면 수정 전 내용의 벡터로 검색됨).
  // 생성 때와 같은 이유로 백그라운드 처리 — 응답을 늦추거나 실패로 수정을 막지 않음.
  embedPassage(input.content)
    .then(async (embedding) => {
      const { error } = await supabase
        .from('community_posts').update({ embedding }).eq('id', id)
      if (error) {throw error}
    })
    .catch((error) => {console.error('글 임베딩 갱신 실패:', error)}
  )

  return fromRow(data as PostRow)
}

export type CommunityPostMatch = CommunityPost & { similarity: number }

// query_embedding으로 카테고리 필터(배열에 포함되는지) + 코사인 유사도 정렬해
// 상위 N개를 가져옴. supabase/schema.sql의 match_community_posts() 함수를 호출.
export async function searchCommunityPosts(
  queryEmbedding: number[],
  category?: string,
  limit = 5,
): Promise<CommunityPostMatch[]> {
  const { data, error } = await supabase.rpc('match_community_posts', {
    query_embedding: queryEmbedding,
    match_category: category && category !== 'ALL' ? category : null,
    match_count: limit,
  })
  if (error) throw error
  return (data as (PostRow & { similarity: number })[]).map((row) => ({ ...fromRow(row), similarity: row.similarity }))
}

export async function deleteCommunityPost(id: string): Promise<boolean> {
  // community_comments.post_id가 on delete cascade라 댓글도 같이 지워짐(schema.sql).
  const { error, count } = await supabase.from('community_posts').delete({ count: 'exact' }).eq('id', id)
  if (error) throw error
  return (count ?? 0) > 0
}

export async function setCommunityPostHelpful(id: string, liked: boolean): Promise<CommunityPost | null> {
  const { data: current, error: fetchError } = await supabase
    .from('community_posts')
    .select('helpful_count')
    .eq('id', id)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!current) return null

  const nextCount = Math.max(0, current.helpful_count + (liked ? 1 : -1))
  const { data, error } = await supabase
    .from('community_posts')
    .update({ helpful_count: nextCount })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data ? fromRow(data as PostRow) : null
}
