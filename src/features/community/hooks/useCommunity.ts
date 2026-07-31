import { useCallback, useEffect, useMemo, useState } from 'react'
import { COMMUNITY_PAGE_SIZE } from '../constants/community.constants'
import { CommunityReview, CommunitySort, CommunityUserContext, SearchScope } from '../model/community.types'
import { calculateReviewSimilarity, communityRepository } from '../services/community.service'

export function useCommunity() {
  const communityUserContext: CommunityUserContext = {
    relation: null,
    region: null,
    currentTaskTypes: [],
    financialStatus: null,
    preparingConsultation: false,
  }
  const [reviews, setReviews] = useState<CommunityReview[]>([])
  const [searchText, setSearchText] = useState('')
  const [searchScope, setSearchScope] = useState<SearchScope>('ALL')
  const [category, setCategory] = useState('전체')
  const [sort, setSort] = useState<CommunitySort>('LATEST')
  const [similarOnly, setSimilarOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const next = await communityRepository.getReviews({
        text: searchText,
        scope: searchScope,
        category,
        region: null,
        sort,
        similarOnly,
        userContext: communityUserContext,
      })
      setReviews(next)
    } catch {
      setError('후기를 불러오는 중 문제가 생겼어요.')
    } finally {
      setLoading(false)
    }
  }, [category, searchScope, searchText, similarOnly, sort])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setPage(1) }, [category, searchText, similarOnly, sort])

  const totalPages = Math.max(1, Math.ceil(reviews.length / COMMUNITY_PAGE_SIZE))
  const pagedReviews = useMemo(
    () => reviews.slice((page - 1) * COMMUNITY_PAGE_SIZE, page * COMMUNITY_PAGE_SIZE),
    [page, reviews],
  )
  const helpfulRanking = useMemo(
    () => [...reviews].filter((review) => !review.isNotice).sort((a, b) => b.helpfulCount - a.helpfulCount).slice(0, 3),
    [reviews],
  )

  const reset = () => {
    setSearchText('')
    setSearchScope('ALL')
    setCategory('전체')
    setSort('LATEST')
    setSimilarOnly(false)
    setPage(1)
  }

  return {
    reviews, pagedReviews, searchText, searchScope, category, sort, similarOnly,
    page, totalPages, helpfulRanking, loading, error,
    userContext: communityUserContext,
    similarity: (review: CommunityReview) => calculateReviewSimilarity(review, communityUserContext),
    setSearchText, setSearchScope, setCategory, setSort, setSimilarOnly, setPage,
    reset, retry: load,
  }
}

export type CommunityController = ReturnType<typeof useCommunity>
