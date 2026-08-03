const fieldLabels: Record<string, string> = {
  reportDate: '사망신고일',
  deceasedName: '사망자 이름',
  deceasedHanjaName: '사망자 한자 이름',
  deceasedGender: '사망자 성별',
  deceasedResidentNumber: '사망자 주민등록번호',
  deceasedBirthDate: '사망자 생년월일',
  deceasedRegisteredDomicile: '사망자 등록기준지',
  deceasedAddress: '사망자 주소',
  deathDateTime: '사망 일시',
  deathPlaceCategory: '사망 장소 구분',
  deathPlaceAddress: '사망 장소 또는 기관명',
  remarks: '기타 사항',
  reporterName: '신고인 이름',
  reporterResidentNumber: '신고인 주민등록번호',
  reporterQualification: '신고인 자격',
  reporterRelationship: '사망자와 신고인의 관계',
  reporterAddress: '신고인 주소',
  reporterPhone: '신고인 전화번호',
  reporterEmail: '신고인 이메일',
  directCause: '직접 사망 원인',
  causeB: '직접 사망 원인의 원인이 된 질환 또는 상태',
  causeC: '선행 원인 또는 기초 질환',
  directCauseDuration: '직접 사망 원인의 경과 기간',
  causeBDuration: '원인 질환 또는 상태의 경과 기간',
  causeCDuration: '선행 원인 또는 기초 질환의 경과 기간',
  otherPhysicalCondition: '그 밖의 신체 상태',
  diagnoserName: '진단자 또는 확인자 이름',
  diagnoserLicenseNumber: '진단자 면허번호',
  deathType: '사망 종류',
  accidentType: '사고 종류',
  accidentDateTime: '사고 발생 일시',
  accidentAreaCategory: '사고 발생 지역 구분',
  accidentPlaceCategory: '사고 장소 구분',
  nationality: '국적',
  educationLevel: '최종 학력 또는 교육 수준',
  occupation: '사망 당시 직업',
  maritalStatus: '혼인 상태',
}

const valueLabels: Record<string, string> = {
  male: '남성',
  female: '여성',
  unknown: '확인 필요',
  home: '주택',
  residence: '주택',
  medical_institution: '의료기관',
  social_welfare_facility: '사회복지시설',
  public_facility: '공공시설',
  road: '도로',
  commercial_service_facility: '상업·서비스시설',
  industrial_site: '산업시설',
  farm: '농장',
  during_transport: '이송 중',
  other: '기타',
  cohabiting_relative: '동거 친족',
  non_cohabiting_relative: '비동거 친족',
  cohabitant: '동거인',
  disease: '병사',
  external_cause: '외인사',
  other_or_unknown: '기타 또는 불상',
  traffic_accident: '교통사고',
  poisoning: '중독',
  fall: '추락',
  intentional_self_harm: '고의적 자해',
  unintentional_accident: '비의도적 사고',
  other_accident: '기타 사고',
  fire: '화재',
  homicide: '타살',
  pending: '확인 중',
  not_applicable: '해당 없음',
  same_city_county_district: '같은 시·군·구',
  different_city_county_district: '다른 시·군·구',
  never_married: '미혼',
  spouse_present: '배우자 있음',
  divorced: '이혼',
  widowed: '사별',
  completed: '완료',
  matched: '확인됨',
  name_mismatch: '성명 불일치',
  no_records: '조회 내역 없음',
  normal: '정상',
}

const fieldSuffix = (key: string) => {
  const parts = key.split('.')
  return parts[parts.length - 1] ?? key
}

export const documentFieldLabel = (key: string, fallback: string): string =>
  fieldLabels[fieldSuffix(key)] ?? fallback

export const translateDocumentDisplayValue = (value: string): string =>
  valueLabels[value.trim().toLowerCase()] ?? value

export const translateDocumentPrimitive = (
  value: string | number | null,
): string | number | null => typeof value === 'string' ? translateDocumentDisplayValue(value) : value
