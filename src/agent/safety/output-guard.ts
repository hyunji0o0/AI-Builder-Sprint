import { AgentOutput } from '../schemas/agent-output'

const prohibited = [
  /상속포기(?:를)?\s*하세요/g,
  /단순승인으로\s*진행해도\s*됩니다/g,
  /무조건\s*한정승인/g,
]

export function guardOutput(output: AgentOutput): AgentOutput {
  let message = output.message
  for (const pattern of prohibited) {
    message = message.replace(pattern, '전문가와 신속히 검토해 주세요')
  }
  return { ...output, message }
}

