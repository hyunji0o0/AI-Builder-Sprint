import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CommunityReview } from '../model/community.types'
import { ReviewArticleContent } from './ReviewDetailPage'

const makeReview = (caution = ''): CommunityReview => ({
  id: 'review-detail-test',
  categories: ['그냥 이야기'],
  title: '상세 화면 테스트',
  authorName: '익명',
  isAnonymous: true,
  region: null,
  relation: null,
  taskType: '',
  situationTags: [],
  body: {
    situation: '직접 겪은 상황입니다.',
    difficulty: '',
    actionTaken: '확인한 내용을 정리했습니다.',
    preparedDocuments: [],
    usefulTip: '',
    caution,
  },
  createdAt: '2026-08-03T00:00:00.000Z',
  helpfulCount: 0,
  commentCount: 0,
  isNotice: false,
  isSynthetic: false,
})

describe('ReviewArticleContent', () => {
  it('주의사항이 비어 있으면 표시와 기호를 렌더링하지 않는다', () => {
    const html = renderToStaticMarkup(createElement(ReviewArticleContent, { review: makeReview() }))

    expect(html).not.toContain('cm-review-caution')
    expect(html).not.toContain('※')
  })

  it('주의사항이 있으면 기호와 함께 표시한다', () => {
    const html = renderToStaticMarkup(createElement(ReviewArticleContent, { review: makeReview('방문 전에 공식 기관에 확인하세요.') }))

    expect(html).toContain('cm-review-caution')
    expect(html).toContain('※ 방문 전에 공식 기관에 확인하세요.')
  })
})
