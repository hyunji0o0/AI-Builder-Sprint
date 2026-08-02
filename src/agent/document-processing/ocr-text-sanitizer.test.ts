import { describe, expect, it } from 'vitest'
import { sanitizeOcrText } from './ocr-text-sanitizer'

describe('sanitizeOcrText', () => {
  it('한글 단어 사이에 잘못 들어온 OCR 중괄호를 제거한다', () => {
    expect(sanitizeOcrText('조회하신 피상속{인의 산림조합 거래내역이 있습니다.'))
      .toBe('조회하신 피상속인의 산림조합 거래내역이 있습니다.')
    expect(sanitizeOcrText('피상속}인의 거래내역')).toBe('피상속인의 거래내역')
  })

  it('의미 있게 사용된 중괄호는 유지한다', () => {
    expect(sanitizeOcrText('JSON { "result": true }')).toBe('JSON { "result": true }')
  })
})
