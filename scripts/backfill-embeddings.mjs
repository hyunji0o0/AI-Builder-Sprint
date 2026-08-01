// 이미 있는 글들 중 embedding이 비어있는 것만 채우는 스크립트.
// 실행: node scripts/backfill-embeddings.mjs
// 몇 번을 다시 돌려도 안전함(embedding이 null인 것만 골라서 처리하므로 중복 없음).

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UPSTAGE_API_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !UPSTAGE_API_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / UPSTAGE_API_KEY가 없습니다. .env.local을 확인하세요.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function embedPassage(text) {
  const res = await fetch('https://api.upstage.ai/v1/solar/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTAGE_API_KEY}` },
    body: JSON.stringify({ model: 'solar-embedding-1-large-passage', input: text }),
  })
  if (!res.ok) throw new Error(`임베딩 요청 실패 (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.data[0].embedding
}

async function backfillTable(table) {
  const { data: rows, error } = await supabase.from(table).select('id, content').is('embedding', null)
  if (error) throw error

  console.log(`${table}: 임베딩 필요한 행 ${rows.length}개`)
  for (const row of rows) {
    const embedding = await embedPassage(row.content)
    const { error: updateError } = await supabase.from(table).update({ embedding }).eq('id', row.id)
    if (updateError) throw updateError
    process.stdout.write('.')
  }
  console.log(`\n${table}: 완료`)
}

async function main() {
  await backfillTable('community_posts')
  await backfillTable('community_comments')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
