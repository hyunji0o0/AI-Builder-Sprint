import { AgentOutput } from '../schemas/agent-output'
import { privacyFilter } from './privacy-filter'
import {
  promisesUnsupportedCapability,
  unsupportedCapabilityFallback,
} from './service-capabilities'

const prohibited = [
  /상속포기(?:를)?\s*하세요/g,
  /단순승인으로\s*진행해도\s*됩니다/g,
  /무조건\s*한정승인/g,
]

const secretPatterns: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[보호된 API 키]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[보호된 JWT]'],
  [/((?:API_KEY|SECRET|TOKEN|PASSWORD|SERVICE_ROLE_KEY)\s*[=:]\s*)(?!\[보호된)[^\s`'\"]+/gi, '$1[보호된 값]'],
  [/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, '$1[보호된 자격 증명]@'],
]

export function guardOutput(output: AgentOutput): AgentOutput {
  let message = output.message
  for (const pattern of prohibited) {
    message = message.replace(pattern, '전문가와 신속히 검토해 주세요')
  }
  for (const [pattern, replacement] of secretPatterns) {
    message = message.replace(pattern, replacement)
  }
  message = privacyFilter.mask(message)
  if (promisesUnsupportedCapability(message)) {
    message = unsupportedCapabilityFallback
  }
  return { ...output, message }
}
