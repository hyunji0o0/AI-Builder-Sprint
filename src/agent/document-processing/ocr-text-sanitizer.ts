const hangulCharacter = '[ㄱ-ㅎㅏ-ㅣ가-힣]'
const strayBraceBetweenHangul = new RegExp(`(${hangulCharacter})[{}](?=${hangulCharacter})`, 'g')

/**
 * OCR이 한글 단어 내부에 잘못 삽입한 중괄호만 제거한다.
 * JSON이나 일반 문장에서 의미 있게 사용된 중괄호는 유지한다.
 */
export const sanitizeOcrText = (value: string): string =>
  value.replace(strayBraceBetweenHangul, '$1')

export const sanitizeOcrPrimitive = (
  value: string | number | null,
): string | number | null => typeof value === 'string' ? sanitizeOcrText(value) : value
