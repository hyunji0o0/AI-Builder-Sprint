import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createInitialCaseState } from '../state/initial-case'
import { runAgent } from './run-agent'

const readTypeScriptFiles = (directory: string) =>
  readdirSync(directory)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => readFileSync(join(directory, name), 'utf8'))
    .join('\n')

describe('독립 Agent 경계', () => {
  it('conversation-agent가 case-workflow 코드를 import하지 않는다', () => {
    const source = readTypeScriptFiles(join(process.cwd(), 'src/agent/agents/conversation'))
    expect(source).not.toContain('case-workflow')
    expect(source).not.toContain('document-processing')
    expect(source).not.toContain('case-tools')
  })

  it('case-workflow-agent가 conversation-agent 코드를 import하지 않는다', () => {
    const source = readTypeScriptFiles(join(process.cwd(), 'src/agent/agents/case-workflow'))
    expect(source).not.toContain('agents/conversation')
    expect(source).not.toContain('conversation-responder')
    expect(source).not.toContain('document-processing/')
  })

  it('일상대화는 사건 데이터 변경과 Tool Call 없이 conversation-agent에서 끝난다', async () => {
    const state = createInitialCaseState()
    // memory는 대화 기록용이라 매 턴 갱신된다. 지켜야 하는 경계는 "사건 데이터를
    // 건드리지 않는 것"이므로 memory를 뺀 나머지를 비교한다.
    const withoutMemory = ({ memory, ...rest }: ReturnType<typeof createInitialCaseState>) => rest
    const snapshot = JSON.stringify(withoutMemory(state))
    const result = await runAgent({ input: '안녕', caseState: state })

    expect(result.output.meta.intent).toBe('CASUAL_CHAT')
    expect(result.output.meta.usedTools).toEqual([])
    expect(result.output.ui).toEqual([])
    expect(JSON.stringify(withoutMemory(result.caseState))).toBe(snapshot)
  })

  it('일상대화 턴도 memory에는 남는다', async () => {
    const result = await runAgent({ input: '안녕', caseState: createInitialCaseState() })

    expect(result.caseState.memory.lastIntent).toBe('CASUAL_CHAT')
    expect(result.caseState.memory.recentEvents[result.caseState.memory.recentEvents.length - 1]?.type).toBe('CONVERSATION_TURN')
  })

  it('사후 행정 질문은 case-workflow-agent로 전달된다', async () => {
    const result = await runAgent({
      input: '지금 다음 업무가 뭐야?',
      caseState: createInitialCaseState(),
    })
    expect(result.output.meta.intent).toBe('ASK_NEXT_ACTION')
  })
})
