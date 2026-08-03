import { CATEGORY_LABEL } from '../../../schemas/community'

export const COMMUNITY_PAGE_SIZE = 7

export const COMMUNITY_CATEGORY_TABS = [
  '전체',
  ...Object.values(CATEGORY_LABEL),
] as const

export const COMMUNITY_MAX_VISIBLE_PAGES = 5

export const COMMUNITY_REGIONS = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
  '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', '경상남도',
  '제주특별자치도',
] as const

export const LOCAL_GATHERING_TYPES = [
  '이야기 모임', '행정 정보 나눔', '공공기관 동행',
] as const
