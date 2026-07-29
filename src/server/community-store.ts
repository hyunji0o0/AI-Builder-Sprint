import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { CommunityPost, CreateCommunityPostInput, UpdateCommunityPostInput, communityPostSchema } from '../schemas/community'

const SEED_PATH = path.resolve(process.cwd(), 'data/community-posts.seed.json')
const RUNTIME_PATH = path.resolve(process.cwd(), 'data/community-posts.runtime.json')

// 데모용 파일 기반 저장소. 실서비스 전환 시 이 파일만 교체하면 됨(Supabase 등).
async function loadPosts(): Promise<CommunityPost[]> {
  try {
    const raw = await readFile(RUNTIME_PATH, 'utf8')
    return communityPostSchema.array().parse(JSON.parse(raw))
  } catch {
    const seedRaw = await readFile(SEED_PATH, 'utf8')
    const seed = communityPostSchema.array().parse(JSON.parse(seedRaw))
    await mkdir(path.dirname(RUNTIME_PATH), { recursive: true })
    await writeFile(RUNTIME_PATH, JSON.stringify(seed, null, 2), 'utf8')
    return seed
  }
}

async function savePosts(posts: CommunityPost[]): Promise<void> {
  await mkdir(path.dirname(RUNTIME_PATH), { recursive: true })
  await writeFile(RUNTIME_PATH, JSON.stringify(posts, null, 2), 'utf8')
}

export async function listCommunityPosts(category?: string): Promise<CommunityPost[]> {
  const posts = await loadPosts()
  const sorted = [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (!category || category === 'ALL') return sorted
  return sorted.filter((post) => post.category === category)
}

export async function createCommunityPost(input: CreateCommunityPostInput): Promise<CommunityPost> {
  const posts = await loadPosts()
  const post: CommunityPost = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    helpfulCount: 0,
    ...input,
  }
  await savePosts([post, ...posts])
  return post
}

export async function updateCommunityPost(id: string, input: UpdateCommunityPostInput): Promise<CommunityPost | null> {
  const posts = await loadPosts()
  const index = posts.findIndex((post) => post.id === id)
  if (index === -1) return null
  const updated: CommunityPost = { ...posts[index], ...input }
  const next = [...posts]
  next[index] = updated
  await savePosts(next)
  return updated
}

export async function setCommunityPostHelpful(id: string, liked: boolean): Promise<CommunityPost | null> {
  const posts = await loadPosts()
  const index = posts.findIndex((post) => post.id === id)
  if (index === -1) return null
  const delta = liked ? 1 : -1
  const updated: CommunityPost = { ...posts[index], helpfulCount: Math.max(0, posts[index].helpfulCount + delta) }
  const next = [...posts]
  next[index] = updated
  await savePosts(next)
  return updated
}
