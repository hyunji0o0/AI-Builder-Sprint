// 로그인 붙기 전까지, 이 브라우저에서 작성한 글 id를 localStorage에 기록해두고
// "내가 쓴 글"인지 판별하는 용도로 씀. 로그인 붙이면 서버 쪽 소유자 필드로
// 교체하고 이 파일은 지우면 됨.
const STORAGE_KEY = 'community-my-post-ids'

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function rememberMyPost(id: string): void {
  const ids = readIds()
  if (ids.includes(id)) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify([id, ...ids]))
}

export function isMyPost(id: string): boolean {
  return readIds().includes(id)
}

export function getMyPostIds(): string[] {
  return readIds()
}
