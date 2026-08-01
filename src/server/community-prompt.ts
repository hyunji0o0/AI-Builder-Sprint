import promptConfig from '../../prompts/community-recommend.json'

export type CommunityRecommendPrompt = {
  id: string
  guardrails: string[]
  role: string
  task: string[]
  style: string[]
  output_format: string
}

// prompts/community-recommend.json을 시스템 메시지 한 덩어리로 조립함.
// 프롬프트를 JSON으로 빼둔 이유: scripts/eval-recommend.mjs가 같은 파일을 읽어서
// dev 서버를 재시작하지 않고도 프롬프트 변경 결과를 바로 비교할 수 있게 하려는 것.
// 조립 순서를 바꾸면 eval 스크립트의 buildSystemPrompt()도 같이 맞춰야 함.
export function buildSystemPrompt(config: CommunityRecommendPrompt = promptConfig): string {
  return [
    config.role,
    ...config.task,
    ...config.style,
    ...config.guardrails,
    config.output_format,
  ]
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

export const communityRecommendPromptId = promptConfig.id
