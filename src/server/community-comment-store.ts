import { CommunityComment, CreateCommunityCommentInput } from '../schemas/community'
import { supabase } from './supabase-client'

// community-store.ts와 동일한 패턴으로 Supabase의 community_comments 테이블을 씀.
type CommentRow = {
  id: string
  post_id: string
  parent_id: string | null
  nickname: string
  content: string
  created_at: string
}

function fromRow(row: CommentRow): CommunityComment {
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    nickname: row.nickname,
    content: row.content,
    createdAt: row.created_at,
  }
}

export async function listCommunityComments(postId: string): Promise<CommunityComment[]> {
  const { data, error } = await supabase
    .from('community_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as CommentRow[]).map(fromRow)
}

export async function createCommunityComment(postId: string, input: CreateCommunityCommentInput): Promise<CommunityComment> {
  const { data, error } = await supabase
    .from('community_comments')
    .insert({ post_id: postId, parent_id: input.parentId, nickname: input.nickname, content: input.content })
    .select()
    .single()
  if (error) throw error
  return fromRow(data as CommentRow)
}
