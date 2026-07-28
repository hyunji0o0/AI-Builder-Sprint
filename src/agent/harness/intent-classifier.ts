import { classificationSchema, Classification, UserIntent } from '../schemas/agent-output'
import { CaseState } from '../schemas/case-state'
import { classifyIntentPrompt } from '../prompts/classify-intent'
import { AgentLLM, extractJson } from './llm-adapter'

const includesAny = (text: string, patterns: string[]) => patterns.some((pattern) => text.includes(pattern))

export function classifyDeterministically(input: string): Classification {
  const text = input.replace(/\s/g, '').toLowerCase()
  let intent: UserIntent = 'UNSUPPORTED'

  if (includesAny(text, ['나중에할게', '쉬고싶', '잠시쉴', '그만할게'])) intent = 'REQUEST_PAUSE'
  else if (includesAny(text, ['상속포기해야', '한정승인해야', '단순승인해야'])) intent = 'ASK_LEGAL_DECISION'
  else if (includesAny(text, ['안녕', '굿굿', '고마워', '알겠어', '감사'])) intent = 'CASUAL_CHAT'
  else if (includesAny(text, ['처음시작', '시작할게'])) intent = 'START_ONBOARDING'
  else if (
    includesAny(text, ['서류올릴', '서류를올릴', '다올리면', '전부올리', '한꺼번에올리', '한번에올리', '첨부할게', '첨부해도', '파일올릴', '업로드'])
    || (text.includes('서류') && includesAny(text, ['올리면', '올려도', '보내도', '넣어도']))
  ) intent = 'UPLOAD_DOCUMENT'
  else if (includesAny(text, ['맞아', '확인했어', '추출결과확인'])) intent = 'CONFIRM_EXTRACTED_DATA'
  else if (includesAny(text, ['수정할게', '잘못됐'])) intent = 'CORRECT_EXTRACTED_DATA'
  else if (/\d/.test(text) && includesAny(text, ['원', '만원', '억', '금액', '채무', '자산'])) intent = 'ADD_FINANCIAL_INFO'
  else if (includesAny(text, ['진행상황', '현재상태', '어디까지'])) intent = 'ASK_CURRENT_STATUS'
  else if (includesAny(text, ['뭐부터', '다음에뭐', '다음할일'])) intent = 'ASK_NEXT_ACTION'
  else if (includesAny(text, ['필요한서류', '준비서류', '부족한서류'])) intent = 'ASK_REQUIRED_DOCUMENTS'
  else if (includesAny(text, ['기한', '며칠남', '언제까지'])) intent = 'ASK_DEADLINE'
  else if (includesAny(text, ['부채가더많', '채무가더많', '금융위험'])) intent = 'ASK_FINANCIAL_RISK'
  else if (includesAny(text, ['부산에서어디', '기관', '어디로가'])) intent = 'ASK_INSTITUTION'
  else if (includesAny(text, ['팁', '후기', '비슷한사람'])) intent = 'ASK_COMMUNITY_TIP'
  else if (includesAny(text, ['완료', '다했어'])) intent = 'UPDATE_TASK_STATUS'

  const distressed = includesAny(text, ['너무힘들', '정신없', '모르겠', '막막', '아무것도하기싫'])
  const positive = includesAny(text, ['고마워', '감사', '굿굿', '다했어', '알겠다', '편해졌'])
  return {
    intent,
    emotion: {
      signal: distressed ? 'DISTRESSED' : positive ? 'POSITIVE' : 'NEUTRAL',
      intensity: distressed ? (includesAny(text, ['너무', '아무것도', '죽고싶', '살기싫']) ? 'HIGH' : 'MEDIUM') : 'LOW',
    },
    confidence: intent === 'UNSUPPORTED' ? 0.35 : 0.9,
  }
}

export async function classifyIntent(input: string, state: CaseState, llm?: AgentLLM): Promise<Classification> {
  const deterministic = classifyDeterministically(input)
  if (!llm) return deterministic
  try {
    const raw = await llm.complete(
      `${classifyIntentPrompt.template}\n출력 형식: ${classifyIntentPrompt.output}`,
      JSON.stringify({ input, currentStage: state.stage, currentFocus: state.currentFocus, tonePreference: state.emotionalContext.tonePreference }),
    )
    const classified = classificationSchema.parse(extractJson(raw))
    // 코드로 명확히 식별된 직접 요청은 LLM이 일반 대화로 잘못 돌리지 않도록 우선합니다.
    if (deterministic.intent !== 'UNSUPPORTED') return deterministic
    return classified
  } catch {
    return deterministic
  }
}
