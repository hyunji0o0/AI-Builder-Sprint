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

/**
 * 임베딩이 없거나 표현이 달라도 키워드 재정렬 후보에 들어갈 수 있도록 글을 가져온다.
 * 확장된 핵심 키워드 중 하나라도 본문에 있는 글만 후보로 가져오고, 실제 키워드 점수와
 * 관련성 컷은 community-search-ranking.ts의 순수 함수가 담당한다.
 */
export async function searchCommunityPostsByKeywords(
  keywords: string[],
  category?: string,
  limit = 50,
): Promise<CommunityPost[]> {
  const safeKeywords = keywords
    .map((keyword) => keyword.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((keyword) => keyword.length >= 2)
    .slice(0, 16)
  if (safeKeywords.length === 0) return []

  let query = supabase
    .from('community_posts')
    .select('*')
    .or(safeKeywords.map((keyword) => `content.ilike.%${keyword}%`).join(','))
    .order('helpful_count', { ascending: false })
    .limit(limit)
  if (category && category !== 'ALL') query = query.contains('categories', [category])
  const { data, error } = await query
  if (!error && data?.length) return (data as PostRow[]).map(fromRow)

  // PostgREST의 다중 OR 검색이 비어 있거나 일시적으로 실패해도, 각 핵심어를
  // 개별 조회해 후보를 복구한다. 임베딩 검색이 막힌 환경에서도 키워드만으로
  // 관련 경험담을 보여주기 위한 마지막 안전망이다.
  const fallbackRows = await Promise.all(safeKeywords.map(async (keyword) => {
    let fallback = supabase
      .from('community_posts')
      .select('*')
      .ilike('content', `%${keyword}%`)
      .order('helpful_count', { ascending: false })
      .limit(limit)
    if (category && category !== 'ALL') fallback = fallback.contains('categories', [category])
    const result = await fallback
    return result.data as PostRow[] | null
  }))
  const byId = new Map<string, CommunityPost>()
  fallbackRows.flatMap((rows) => rows ?? []).forEach((row) => byId.set(row.id, fromRow(row)))
  return [...byId.values()].slice(0, limit)
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
