/**
 * createdAt(UTC ISO 문자열 또는 YYYY-MM-DD)을 한국 시간(KST) 기준 날짜 'YYYY-MM-DD'로 변환한다.
 *
 * DB(community_posts.created_at)는 timestamptz(UTC)로 저장되는데, ISO 문자열을 그대로
 * 잘라 쓰면 UTC 날짜가 나와 KST(UTC+9)와 하루 어긋난다. 예를 들어 한국시간 8/2 01:21에
 * 올린 글은 UTC로 8/1 16:21이라 '08-01'로 잘못 표기된다. 표시는 항상 KST로 변환한다.
 *
 * 시간 정보가 없는 날짜 문자열(YYYY-MM-DD, 시드 데이터)은 이미 날짜뿐이라 그대로 둔다.
 */
export const toKstDate = (createdAt: string): string =>
  createdAt.includes('T')
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(createdAt))
    : createdAt.slice(0, 10)
