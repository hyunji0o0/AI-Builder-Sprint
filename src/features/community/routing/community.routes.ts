export type CommunityRoute =
  | { type: 'main' }
  | { type: 'write' }
  | { type: 'detail'; reviewId: string }

export const resolveCommunityRoute = (path: string): CommunityRoute => {
  if (path === '/community/write') return { type: 'write' }

  const detail = path.match(/^\/community\/([^/]+)$/)
  if (detail) return { type: 'detail', reviewId: decodeURIComponent(detail[1]) }

  return { type: 'main' }
}

export const navigateCommunity = (path: string) => {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
