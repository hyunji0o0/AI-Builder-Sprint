// 커뮤니티 글에 흔히 섞여 들어올 수 있는 개인정보(전화번호, 주민등록번호,
// 이메일, 계좌·카드번호)를 정규식으로 마스킹함. 형태소 분석기 없이 패턴
// 매칭만 하는 거라 완벽하진 않지만(예: 실명·구체적 주소는 못 잡음 — 그건
// prompts/community-recommend.json의 guardrails 지시로 보완), LLM한테 원문을 보여주기
// 전에 1차로 걸러내는 게 핵심. "프롬프트로 하지 말라고 하면 되지 않냐"보다
// 애초에 LLM이 그 문자열 자체를 못 보게 하는 게 훨씬 확실함.

function redactStructuredPii(text: string): string {
  return text
    .replace(/\d{6}\s?-\s?[1-4]\d{6}/g, '[주민등록번호 삭제]')
    .replace(/01[016789]\s?-?\s?\d{3,4}\s?-?\s?\d{4}/g, '[전화번호 삭제]')
    .replace(/0\d{1,2}\s?-?\s?\d{3,4}\s?-?\s?\d{4}/g, '[전화번호 삭제]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[이메일 삭제]')
}

// 위 패턴들이 먼저 지워지고 난 뒤, 남아있는 "숫자-숫자-숫자" 형태 중 합쳐서
// 10자리 이상인 것만 계좌·카드번호로 간주해 지움 — 날짜(2026-07-30, 8자리)
// 같은 건 안 걸리게 하려는 것.
function redactAccountLike(text: string): string {
  return text.replace(/\b\d{2,6}(?:-\d{2,6}){2,4}\b/g, (match) => {
    const digitCount = match.replace(/-/g, '').length
    return digitCount >= 10 ? '[계좌·카드번호 삭제]' : match
  })
}

export function redactPii(text: string): string {
  return redactAccountLike(redactStructuredPii(text))
}
