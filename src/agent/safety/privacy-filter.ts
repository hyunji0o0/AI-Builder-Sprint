export interface PrivacyFilter {
  mask(text: string): string
}

export const privacyFilter: PrivacyFilter = {
  mask(text) {
    return text
      .replace(/\b\d{6}-?[1-4]\d{6}\b/g, '[주민등록번호 마스킹]')
      .replace(/\b01[016789]-?\d{3,4}-?\d{4}\b/g, '[전화번호 마스킹]')
      .replace(/\b\d{2,6}-\d{2,6}-\d{2,8}\b/g, '[계좌·고객번호 마스킹]')
      .replace(/\b\d{2,4}[가-힣]?\d{2,6}\b(?=\s*(?:호|번지))/g, '[상세주소 마스킹]')
      .replace(/\b\d{4,}-?\d{2,}-?\d{2,}\b/g, '[사건번호 마스킹]')
  },
}

