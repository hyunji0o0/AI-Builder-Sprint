import { describe, expect, it } from 'vitest'
import {
  documentFieldLabel,
  translateDocumentDisplayValue,
} from './document-display-translations'

describe('document display translations', () => {
  it('사망신고서 필드명을 구체적인 한글 항목명으로 표시한다', () => {
    expect(documentFieldLabel('directCauseDuration', '추가 확인 정보')).toBe('직접 사망 원인의 경과 기간')
    expect(documentFieldLabel('diagnoserLicenseNumber', '추가 확인 정보')).toBe('진단자 면허번호')
    expect(documentFieldLabel('accidentPlaceCategory', '추가 확인 정보')).toBe('사고 장소 구분')
  })

  it('사망신고서 내부 영문 코드를 한글로 표시한다', () => {
    expect(translateDocumentDisplayValue('disease')).toBe('병사')
    expect(translateDocumentDisplayValue('not_applicable')).toBe('해당 없음')
    expect(translateDocumentDisplayValue('medical_institution')).toBe('의료기관')
  })
})
