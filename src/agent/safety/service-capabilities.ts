export const completedConsultationMessage = [
  '전문가 상담 준비까지 모두 마쳤어. 지금은 상담 준비가 완료된 상태야.',
  '지금부터는 정리한 자료를 가지고 전문가와 실제 상담을 진행하면 돼. 상담 결과에 따라 신청하거나 제출할 내용이 달라질 수 있어서, 이 서비스가 “이제 제출만 하면 된다”고 단정하거나 대신 접수하지는 않아.',
  '여기서는 현재 사건 상태와 자산·채무 요약 확인, 업로드한 서류 다시 보기, 비슷한 경험 후기 보기를 계속 이용할 수 있어.',
].join('\n\n')

export const unsupportedCapabilityFallback = [
  '이 서비스는 상담 예약이나 기관 신청, 서류 제출·접수를 대신 진행하지 않아.',
  '확인된 사건 정보 정리, 서류 검토, 자산·채무 요약, 사용자 후기 검색까지 도울 수 있어.',
].join('\n\n')

const unsupportedCapabilityPromises = [
  /(?:상담\s*)?일정(?:도|을)?[^.!?\n]{0,16}(?:잡아줄게|잡아드릴게|잡아볼 수 있어)/,
  /(?:상담\s*)?예약(?:도|을)?[^.!?\n]{0,16}(?:해줄게|해드릴게|진행해줄게|진행할게)/,
  /(?:신청|제출|접수)(?:도|을|를)?[^.!?\n]{0,16}(?:대신해줄게|대신해드릴게|진행해줄게|완료해줄게)/,
  /(?:대신|자동으로)[^.!?\n]{0,12}(?:신청|제출|접수)(?:해줄게|해드릴게|할게|진행할게)/,
]

export const promisesUnsupportedCapability = (message: string) => (
  unsupportedCapabilityPromises.some((pattern) => pattern.test(message))
)
