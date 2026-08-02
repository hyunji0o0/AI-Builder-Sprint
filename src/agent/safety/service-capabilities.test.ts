import { describe, expect, it } from 'vitest'
import {
  completedConsultationMessage,
  promisesUnsupportedCapability,
} from './service-capabilities'

describe('서비스 기능 경계', () => {
  it('상담 일정·신청·제출을 대신한다는 약속을 감지한다', () => {
    expect(promisesUnsupportedCapability('원한다면 상담 일정도 함께 잡아볼 수 있어.')).toBe(true)
    expect(promisesUnsupportedCapability('필요한 신청을 대신해줄게.')).toBe(true)
    expect(promisesUnsupportedCapability('서류 제출을 진행해줄게.')).toBe(true)
  })

  it('공식 홈페이지를 안내하거나 직접 진행해야 한다는 설명은 허용한다', () => {
    expect(promisesUnsupportedCapability('공식 홈페이지에서 직접 신청 방법을 확인할 수 있어.')).toBe(false)
    expect(promisesUnsupportedCapability('우리 서비스가 예약을 대신 진행하지는 않아.')).toBe(false)
  })

  it('상담 준비 완료 안내는 최종 상태와 실제 지원 기능을 분명히 말한다', () => {
    expect(completedConsultationMessage).toContain('전문가 상담 준비까지 모두 마쳤어')
    expect(completedConsultationMessage).toContain('대신 접수하지는 않아')
    expect(completedConsultationMessage).not.toContain('기관 찾기')
    expect(completedConsultationMessage).not.toContain('원스톱')
  })
})
