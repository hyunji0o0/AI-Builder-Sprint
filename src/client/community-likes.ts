// 로그인 붙기 전까지, 이 브라우저에서 "도움이 됐어요"를 누른 글 id를
// localStorage에 기록해두고 중복 반응을 막는 용도로 씀. my-community-posts.ts와
// 동일한 패턴. 로그인 붙이면 서버 쪽 반응 기록으로 교체하고 이 파일은 지우면 됨.
const STORAGE_KEY = 'community-liked-post-ids'

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function rememberLikedPost(id: string): void {
  const ids = readIds()

  if (ids.includes(id)) return

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([id, ...ids]),
    )
  } catch (error) {
    console.error(
      '좋아요 정보를 저장하지 못했어요:',
      error,
    )
  }
}

export function forgetLikedPost(id: string): void {
  const ids = readIds().filter(
    (existing) => existing !== id,
  )

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(ids),
    )
  } catch (error) {
    console.error(
      '좋아요 정보를 삭제하지 못했어요:',
      error,
    )
  }
}

export function hasLikedPost(id: string): boolean {
  return readIds().includes(id)
}
