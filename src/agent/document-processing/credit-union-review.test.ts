import { describe, expect, it } from 'vitest'
import { buildReviewItems } from './run-document-pipeline'

const field = (key: string, label: string, value: string | number) => ({
  key,
  label,
  value,
  normalizedValue: value,
})

describe('신협중앙회 추출 결과 표시', () => {
  it('기관별 예금·출자금과 대출금, 만기일을 의미 있는 행으로 묶는다', () => {
    const items = buildReviewItems([
      field('recordCount', '조회 내역 수', 1),
      field('records.0.creditUnionName', '신협명', '부산중앙신협'),
      field('records.0.depositAndContributionAmount', '예금 및 출자금', 12_000_000),
      field('records.0.loanAmount', '대출 금액', 25_000_000),
      field('records.0.loanMaturityDate', '대출 만기일', '2027-06-15'),
    ], true)

    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '부산중앙신협 · 예금 및 출자금', formattedValue: '12,000,000원' }),
      expect.objectContaining({ label: '부산중앙신협 · 대출금', formattedValue: '25,000,000원 · 만기 2027-06-15' }),
    ]))
    expect(items.some((item) => item.formattedValue === '상세 내용 확인 필요')).toBe(false)
  })
})
