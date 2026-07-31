/** 공통 Agent 코어에서 사용하는 LLM adapter 경계입니다. */
export interface AgentLLM {
  complete(system: string, user: string): Promise<string>
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced || text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  return JSON.parse(candidate)
}
