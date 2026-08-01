// 제목 없이 저장된 기존 글 content 맨 앞에 한 문장 제목을 붙여주는 스크립트.
// DB에 title 컬럼이 따로 없음 — community.remote-repository.ts의 관례대로
// content를 `{제목}\n\n{본문}` 형태로 만들어서, 화면에서 첫 줄을 제목으로 분리해 보여줌.
// 실행: node scripts/backfill-titles.mjs
// 이미 "제목\n\n본문" 형태(빈 줄 앞부분이 80자 이하 한 줄)인 글은 건너뛰므로 여러 번
// 실행해도 안전함(중복으로 제목이 덧붙지 않음).

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

const TITLE_MAX_LENGTH = 80

// community.remote-repository.ts의 parseContentToReview와 같은 판정 기준
// (빈 줄 앞부분이 비어있지 않고 80자 이하, 한 줄이면 이미 제목이 있는 것으로 봄).
function alreadyHasTitle(content) {
  const separatorIndex = content.indexOf('\n\n')
  if (separatorIndex <= 0) return false
  const candidate = content.slice(0, separatorIndex).trim()
  return candidate.length > 0 && candidate.length <= TITLE_MAX_LENGTH && !candidate.includes('\n')
}

const SYSTEM_PROMPT = [
  '너는 유족 커뮤니티 게시글의 제목을 지어주는 도우미야.',
  '주어진 글 내용을 읽고 핵심을 담은 한국어 제목을 한 문장으로 만들어.',
  '제목은 15~30자 내외로 간결하게 쓰고, 따옴표나 마침표는 붙이지 마.',
  '제목 외의 다른 설명은 절대 덧붙이지 말고 제목 텍스트만 출력해.',
].join(' ')

async function generateTitle(content, categories) {
  const res = await fetch('https://api.upstage.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTAGE_API_KEY}` },
    body: JSON.stringify({
      model: 'solar-pro3',
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `카테고리: ${categories.join(', ')}\n내용: ${content}` },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`제목 생성 요청 실패 (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.choices[0].message.content.trim().replace(/^["'“”]+|["'“”]+$/g, '').slice(0, TITLE_MAX_LENGTH)
}

async function backfillTitles() {
  const { data: rows, error } = await supabase.from('community_posts').select('id, content, categories')
  if (error) throw error

  const targets = rows.filter((row) => !alreadyHasTitle(row.content))
  console.log(`community_posts: 총 ${rows.length}개 중 제목 필요한 행 ${targets.length}개`)

  for (const row of targets) {
    const title = await generateTitle(row.content, row.categories)
    const newContent = `${title}\n\n${row.content}`
    const { error: updateError } = await supabase.from('community_posts').update({ content: newContent }).eq('id', row.id)
    if (updateError) throw updateError
    console.log(`- ${row.id}: ${title}`)
  }
  console.log('완료')
}

backfillTitles().catch((error) => {
  console.error(error)
  process.exit(1)
})
