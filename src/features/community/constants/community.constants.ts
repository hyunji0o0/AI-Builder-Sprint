import { CATEGORY_LABEL } from '../../../schemas/community'

export const COMMUNITY_PAGE_SIZE = 7

export const COMMUNITY_CATEGORY_TABS = [
  '전체',
  ...Object.values(CATEGORY_LABEL),
] as const

export const COMMUNITY_MAX_VISIBLE_PAGES = 5
