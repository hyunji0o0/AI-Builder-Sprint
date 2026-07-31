import { CommunityController } from '../hooks/useCommunity'
import { resolveCommunityRoute } from '../routing/community.routes'
import { CommunityPage } from './CommunityPage'
import { ReviewDetailPage } from './ReviewDetailPage'
import { ReviewWritePage } from './ReviewWritePage'

export function CommunityRouter({ path, controller }: { path: string; controller: CommunityController }) {
  const route = resolveCommunityRoute(path)
  if (route.type === 'write') return <ReviewWritePage/>
  if (route.type === 'detail') return <ReviewDetailPage id={route.reviewId}/>
  return <CommunityPage controller={controller}/>
}
