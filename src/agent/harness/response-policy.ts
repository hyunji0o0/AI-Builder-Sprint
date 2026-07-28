import { Classification } from '../schemas/agent-output'
import { ActionSelection } from './action-selector'
import { ExecutionResult } from './tool-executor'

export type ResponsePolicy = {
  verifiedFacts: string[]
  requiredMeaningGroups: string[][]
  prohibitedExpressions: string[]
  style: string
}

export function buildResponsePolicy(
  classification: Classification,
  selection: ActionSelection,
  execution: ExecutionResult,
): ResponsePolicy {
  const requiredMeaningGroups: string[][] = []
  if (selection.action === 'UPLOAD') {
    requiredMeaningGroups.push(['10개', '열 개'], ['PDF'], ['JPG', 'JPEG', '이미지'])
  }
  if (selection.action === 'PAUSE') {
    requiredMeaningGroups.push(['저장', '보존'], ['다시', '이어'])
  }
  if (selection.action === 'LEGAL_BOUNDARY') {
    requiredMeaningGroups.push(['결정', '판단'], ['법률 자문', '전문가'])
  }
  if (selection.action === 'SHOW_INSTITUTION') {
    requiredMeaningGroups.push(['공식', '확인 필요', '추가 확인'])
  }
  if (selection.action === 'SHOW_COMMUNITY_REVIEW') {
    requiredMeaningGroups.push(['사용자 경험', '개인 경험'], ['공식', '기관 확인'])
  }

  return {
    verifiedFacts: execution.facts,
    requiredMeaningGroups,
    prohibitedExpressions: [
      '상속포기하세요',
      '단순승인으로 진행해도 됩니다',
      '무조건 한정승인',
      '힘내세요',
      '긍정적으로 생각하세요',
    ],
    style: classification.emotion.signal === 'DISTRESSED'
      ? '감정을 단정하지 말고 짧게 인정한 뒤, 부담을 줄이는 문장과 선택 가능한 행동 하나를 제시'
      : classification.emotion.signal === 'POSITIVE'
        ? '사용자의 반응을 자연스럽게 받아들이되 다음 업무를 강제로 시작하지 않음'
        : '짧고 따뜻하며 대화하듯 자연스럽게 답변',
  }
}

export function validateComposedResponse(message: string, policy: ResponsePolicy) {
  const koreanCount = (message.match(/[가-힣]/g) || []).length
  const latinCount = (message.match(/[A-Za-z]/g) || []).length
  if (koreanCount < 4 || latinCount > koreanCount) return false
  if (policy.prohibitedExpressions.some((expression) => message.includes(expression))) return false
  return policy.requiredMeaningGroups.every((alternatives) => alternatives.some((term) => message.includes(term)))
}

