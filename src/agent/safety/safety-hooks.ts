import { UserIntent } from '../schemas/agent-output'

export type SafetyAssessment = {
  legalDecisionRequested: boolean
  severeDistress: boolean
  immediateRiskSuspected: boolean
}

export const assessSafety = (input: string, intent: UserIntent): SafetyAssessment => {
  const compact = input.replace(/\s/g, '')
  return {
    legalDecisionRequested: intent === 'ASK_LEGAL_DECISION',
    severeDistress: /너무힘들|정신없|막막|아무것도하기싫/.test(compact),
    immediateRiskSuspected: /죽고싶|살기싫|자해|목숨|끝내고싶/.test(compact),
  }
}

export const legalDisclaimer = '현재 확인된 정보를 정리한 안내이며 법률 자문이나 법적 결정이 아닙니다.'

