import { config } from 'dotenv'

// supabase-client.ts와 동일한 이유로 여기서 직접 .env.local을 읽음
// (vite.config.ts가 이 파일을 import하는 시점이 vite 자체 env 로딩보다 빠름).
config({ path: '.env.local' })

const UPSTAGE_API_KEY = process.env.UPSTAGE_API_KEY
const UPSTAGE_BASE_URL = 'https://api.upstage.ai/v1'

if (!UPSTAGE_API_KEY) {
  throw new Error('UPSTAGE_API_KEY가 설정되지 않았습니다. .env.local을 확인하세요.')
}

async function upstageFetch(path: string, body: unknown) {
  const res = await fetch(`${UPSTAGE_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${UPSTAGE_API_KEY}`,
    },
    body: JSON.stringify(body),
    // 타임아웃이 없으면 Upstage가 느릴 때 요청이 무한정 매달림(데모 중 위험).
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Upstage API 요청 실패 (${res.status}): ${text}`)
  }
  return res.json()
}

// 문서(저장할 글) 임베딩 — solar-embedding-1-large-passage
export async function embedPassage(text: string): Promise<number[]> {
  const data = await upstageFetch('/solar/embeddings', {
    model: 'solar-embedding-1-large-passage',
    input: text,
  })
  return data.data[0].embedding
}

// 검색어(사용자 질문) 임베딩 — solar-embedding-1-large-query
export async function embedQuery(text: string): Promise<number[]> {
  const data = await upstageFetch('/solar/embeddings', {
    model: 'solar-embedding-1-large-query',
    input: text,
  })
  return data.data[0].embedding
}

// 검색된 글을 종합해서 답변을 만드는 재작성 단계 — solar-pro3.
// 근거 기반 요약이라 temperature는 낮게 두는 게 기본(지어내기와 실행 간 편차를 줄임).
export async function generateSolarChat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  temperature = 0.2,
): Promise<string> {
  const data = await upstageFetch('/chat/completions', {
    model: 'solar-pro3',
    messages,
    temperature,
  })
  return data.choices[0].message.content
}
