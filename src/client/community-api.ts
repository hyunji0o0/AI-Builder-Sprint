import { CommunityPost, CreateCommunityPostInput } from '../schemas/community'

export async function fetchCommunityPosts(category?: string): Promise<CommunityPost[]> {
  const query = category && category !== 'ALL' ? `?category=${category}` : ''
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
