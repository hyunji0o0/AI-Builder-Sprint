import { CommunityComment, CommunityPost, CreateCommunityCommentInput, CreateCommunityPostInput, UpdateCommunityPostInput } from '../schemas/community'

export async function fetchCommunityPosts(
  category?: string,
  keyword?: string,
  sort?: 'recent' | 'helpful',
): Promise<CommunityPost[]> {
  const params = new URLSearchParams()
  if (category && category !== 'ALL') params.set('category', category)
  if (keyword && keyword.trim()) params.set('q', keyword.trim())
  if (sort) params.set('sort', sort)
  const query = params.toString() ? `?${params.toString()}` : ''
  const res = await fetch(`/api/community/posts${query}`)
  if (!res.ok) throw new Error('커뮤니티 글을 불러오지 못했어요.')
  return res.json()
}

export async function submitCommunityPost(input: CreateCommunityPostInput): Promise<CommunityPost> {
  const res = await fetch('/api/community/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? '글을 등록하지 못했어요.')
  return data as CommunityPost
}

export async function updateCommunityPost(id: string, input: UpdateCommunityPostInput): Promise<CommunityPost> {
  const res = await fetch(`/api/community/posts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? '글을 수정하지 못했어요.')
  return data as CommunityPost
}

export async function setCommunityPostHelpful(id: string, liked: boolean): Promise<CommunityPost> {
  const res = await fetch(`/api/community/posts/${id}/helpful`, { method: liked ? 'POST' : 'DELETE' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? '반응을 남기지 못했어요.')
  return data as CommunityPost
}

export async function fetchCommunityComments(postId: string): Promise<CommunityComment[]> {
  const res = await fetch(`/api/community/posts/${postId}/comments`)
  if (!res.ok) throw new Error('댓글을 불러오지 못했어요.')
  return res.json()
}

export async function submitCommunityComment(postId: string, input: CreateCommunityCommentInput): Promise<CommunityComment> {
  const res = await fetch(`/api/community/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? '댓글을 등록하지 못했어요.')
  return data as CommunityComment
}
