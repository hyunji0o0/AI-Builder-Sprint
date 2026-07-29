import { CommunityCategory, CommunityPost, CreateCommunityPostInput, UpdateCommunityPostInput } from '../schemas/community'
import { supabase } from './supabase-client'

// Supabase(Postgres)의 community_posts 테이블을 씀. 이전엔 파일 기반이었는데,
// 함수 시그니처는 그대로 유지해서 community-server-plugin.ts 쪽은 무변경.
type PostRow = {
  id: string
  nickname: string
  category: string
  content: string
  created_at: string
  helpful_count: number
}

function fromRow(row: PostRow): CommunityPost {
  return {
    id: row.id,
    nickname: row.nickname,
    category: row.category as CommunityCategory,
    content: row.content,
    createdAt: row.created_at,
    helpfulCount: row.helpful_count,
  }
}

export async function listCommunityPosts(category?: string): Promise<CommunityPost[]> {
  let query = supabase.from('community_posts').select('*').order('created_at', { ascending: false })
  if (category && category !== 'ALL') query = query.eq('category', category)
  const { data, error } = await query
  if (error) throw error
  return (data as PostRow[]).map(fromRow)
}

export async function createCommunityPost(input: CreateCommunityPostInput): Promise<CommunityPost> {
  const { data, error } = await supabase
    .from('community_posts')
    .insert({ nickname: input.nickname, category: input.category, content: input.content })
    .select()
    .single()
  if (error) throw error
  return fromRow(data as PostRow)
}

export async function updateCommunityPost(id: string, input: UpdateCommunityPostInput): Promise<CommunityPost | null> {
  const { data, error } = await supabase
    .from('community_posts')
    .update({ category: input.category, content: input.content })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  return data ? fromRow(data as PostRow) : null
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
