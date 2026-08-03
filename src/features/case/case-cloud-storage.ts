import { supabase } from '../../lib/supabase-client'
import { caseStateSchema, CaseState } from '../../agent/schemas/case-state'
import { AgentMessage } from './case.types'

type CloudSession = {
  state: CaseState
  messages: AgentMessage[]
}

/** 로그인한 유저의 사건 상태를 Supabase에서 불러온다. */
export const loadCaseStateFromCloud = async (userId: string): Promise<CloudSession | null> => {
  try {
    const { data, error } = await supabase
      .from('case_states')
      .select('state, messages')
      .eq('user_id', userId)
      .single()

    if (error || !data) return null

    const parsed = caseStateSchema.safeParse(data.state)
    if (!parsed.success) return null

    return {
      state: parsed.data,
      messages: Array.isArray(data.messages) ? (data.messages as AgentMessage[]) : [],
    }
  } catch {
    return null
  }
}

/** 로그인한 유저의 사건 상태를 Supabase에 저장(upsert)한다. */
export const saveCaseStateToCloud = async (
  userId: string,
  caseState: CaseState,
  messages: AgentMessage[],
): Promise<void> => {
  try {
    await supabase.from('case_states').upsert({
      user_id: userId,
      state: caseState,
      messages: messages.slice(-100).map((m) => ({ ...m, attachments: undefined })),
      updated_at: new Date().toISOString(),
    })
  } catch {
    // 저장 실패가 대화 진행 자체를 막지 않게 한다.
  }
}

/** 로그아웃 등으로 클라우드 데이터를 초기화할 때 사용한다. */
export const deleteCaseStateFromCloud = async (userId: string): Promise<void> => {
  try {
    await supabase.from('case_states').delete().eq('user_id', userId)
  } catch {
    // 삭제 실패는 무시
  }
}
