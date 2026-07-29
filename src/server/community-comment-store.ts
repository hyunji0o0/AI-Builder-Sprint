import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { CommunityComment, CreateCommunityCommentInput, communityCommentSchema } from '../schemas/community'

const SEED_PATH = path.resolve(process.cwd(), 'data/community-comments.seed.json')
const RUNTIME_PATH = path.resolve(process.cwd(), 'data/community-comments.runtime.json')

// community-store.ts와 동일한 파일 기반 저장 패턴.
async function loadComments(): Promise<CommunityComment[]> {
  try {
    const raw = await readFile(RUNTIME_PATH, 'utf8')
    return communityCommentSchema.array().parse(JSON.parse(raw))
  } catch {
    const seedRaw = await readFile(SEED_PATH, 'utf8')
    const seed = communityCommentSchema.array().parse(JSON.parse(seedRaw))
    await mkdir(path.dirname(RUNTIME_PATH), { recursive: true })
    await writeFile(RUNTIME_PATH, JSON.stringify(seed, null, 2), 'utf8')
    return seed
  }
}

async function saveComments(comments: CommunityComment[]): Promise<void> {
  await mkdir(path.dirname(RUNTIME_PATH), { recursive: true })
  await writeFile(RUNTIME_PATH, JSON.stringify(comments, null, 2), 'utf8')
}

export async function listCommunityComments(postId: string): Promise<CommunityComment[]> {
  const comments = await loadComments()
  return comments.filter((comment) => comment.postId === postId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function createCommunityComment(postId: string, input: CreateCommunityCommentInput): Promise<CommunityComment> {
  const comments = await loadComments()
  const comment: CommunityComment = {
    id: randomUUID(),
    postId,
    createdAt: new Date().toISOString(),
    ...input,
  }
  await saveComments([...comments, comment])
  return comment
}
