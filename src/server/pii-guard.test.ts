import { describe, expect, it } from 'vitest'
import { hasUnsafeLocalMeetingInformation } from './pii-guard'

describe('local meeting safety guard', () => {
  it('blocks direct contact details, exact addresses, and external contact links', () => {
    expect(hasUnsafeLocalMeetingInformation('010-1234-5678로 연락해 주세요')).toBe(true)
    expect(hasUnsafeLocalMeetingInformation('해운대로 123-4에서 만나요')).toBe(true)
    expect(hasUnsafeLocalMeetingInformation('https://open.kakao.com/o/example로 들어오세요')).toBe(true)
  })

  it('allows a broad region and a public meeting place', () => {
    expect(hasUnsafeLocalMeetingInformation('부산광역시 해운대구 주민센터에서 만나요')).toBe(false)
  })
})
