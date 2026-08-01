// 커뮤니티 팁 카드 프롬프트를 고쳐가며 결과를 눈으로 비교하는 스크립트.
//
//   node scripts/eval-recommend.mjs                          현재 프롬프트로 전체 질문 실행
//   node scripts/eval-recommend.mjs --step INHERITANCE_TAX   단계 하나만 실행
//   node scripts/eval-recommend.mjs --query "직접 입력"       자유 텍스트 하나만 실행
//   node scripts/eval-recommend.mjs --compare v2.json        두 프롬프트를 나란히 비교
//   node scripts/eval-recommend.mjs --save before.txt        결과를 파일로 저장(나중에 diff)
//
// prompts/community-recommend.json을 매번 새로 읽으므로 dev 서버를 재시작할 필요 없음.
// 프롬프트를 고치고 이 스크립트만 다시 돌리면 됨.
// 조립 순서와 임계값은 src/server/community-prompt.ts / community-recommend.ts와 맞춰둠.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim()
  }
}
loadEnvLocal()

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UPSTAGE_API_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !UPSTAGE_API_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / UPSTAGE_API_KEY가 없습니다. .env.local을 확인하세요.')
  process.exit(1)
}

const args = process.argv.slice(2)
const getFlag = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? null : args[i + 1]
}

const PROMPT_PATH = getFlag('--prompt') ?? 'prompts/community-recommend.json'
const COMPARE_PATH = getFlag('--compare')
const SAVE_PATH = getFlag('--save')
const SINGLE_QUERY = getFlag('--query')
const LIMIT = Number(getFlag('--limit') ?? 3)
const SIMILARITY_THRESHOLD = Number(getFlag('--threshold') ?? 0.3)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const CATEGORY_LABEL = {
  RENOUNCE: '상속포기·한정승인',
  TAX: '상속세',
  TRANSFER: '명의이전',
  INSURANCE: '보험청구',
  SUBSCRIPTION: '통신·구독해지',
  VENT: '그냥 이야기',
  ETC: '기타',
}

const readJson = (file) => JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf8'))
const readPrompt = readJson

// 서버(src/schemas/procedure-steps.ts)와 같은 파일을 읽음.
const PROCEDURE_STEPS = readJson('data/procedure-steps.json').steps

// src/server/community-recommend.ts의 buildSearchText()와 같은 규칙.
function buildSearchText(item) {
  const parts = []
  if (item.stepId) parts.push(PROCEDURE_STEPS[item.stepId].searchText)
  if (item.situation?.trim()) parts.push(item.situation.trim())
  if (item.context?.debtExceedsAssets) parts.push('채무가 자산보다 많은 상황.')
  if (item.context?.hasUnverifiedItems) parts.push('금융 조회 결과에 아직 확인되지 않은 항목이 있는 상황.')
  if (item.context?.missingDocuments?.length) {
    parts.push(`아직 준비하지 못한 서류: ${item.context.missingDocuments.join(', ')}.`)
  }
  return parts.join(' ')
}

// describeContext()와 같은 규칙.
function describeContext(context) {
  if (!context) return []
  const lines = []
  if (context.relationToDeceased) lines.push(`고인과의 관계: ${context.relationToDeceased}`)
  if (context.region) lines.push(`지역: ${context.region}`)
  if (context.debtExceedsAssets) lines.push('현재 확인된 채무가 자산보다 많음')
  if (context.hasUnverifiedItems) lines.push('금융 조회 결과에 아직 확인되지 않은 항목이 있음')
  if (typeof context.daysRemaining === 'number') lines.push(`이 단계 기한까지 ${context.daysRemaining}일 남음`)
  if (context.missingDocuments?.length) lines.push(`아직 없는 서류: ${context.missingDocuments.join(', ')}`)
  return lines
}

// src/server/community-prompt.ts의 buildSystemPrompt()와 같은 조립 순서.
const buildSystemPrompt = (config) =>
  [config.role, ...(config.task ?? []), ...(config.style ?? []), ...(config.guardrails ?? []), config.output_format]
    .map((line) => (line ?? '').trim())
    .filter(Boolean)
    .join('\n')

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = fenced ?? text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  return JSON.parse(candidate)
}

async function upstage(pathname, body) {
  const res = await fetch(`https://api.upstage.ai/v1${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${UPSTAGE_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Upstage ${res.status}: ${await res.text()}`)
  return res.json()
}

const embedQuery = async (text) =>
  (await upstage('/solar/embeddings', { model: 'solar-embedding-1-large-query', input: text })).data[0].embedding

const chat = async (system, user) =>
  (await upstage('/chat/completions', {
    model: 'solar-pro3',
    temperature: 0.2,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  })).choices[0].message.content

async function runOne(system, item) {
  const embedding = await embedQuery(buildSearchText(item))
  const { data: matches, error } = await supabase.rpc('match_community_posts', {
    query_embedding: embedding,
    match_category: null,
    match_count: LIMIT * 2,
  })
  if (error) throw error

  const candidates = matches.filter((m) => m.similarity >= SIMILARITY_THRESHOLD).slice(0, LIMIT)
  if (candidates.length === 0) {
    return { tips: [], candidates: [], topSimilarity: matches[0]?.similarity ?? 0, ms: 0, raw: null }
  }

  const postList = candidates
    .map((m, i) => `${i + 1}. [${m.categories.map((c) => CATEGORY_LABEL[c] ?? c).join(' · ')}] ${m.content}`)
    .join('\n')

  const step = item.stepId ? PROCEDURE_STEPS[item.stepId] : null
  const stepLine = step ? `${step.label} (기한 ${step.deadline}, 기준 ${step.baseDate})` : (item.situation ?? '단계 미지정')
  const contextLines = describeContext(item.context)
  const userMessage = [
    `사용자가 지금 밟고 있는 단계: ${stepLine}`,
    contextLines.length ? `사용자 상황:\n${contextLines.map((l) => `- ${l}`).join('\n')}` : '',
    `관련 경험담 목록:\n${postList}`,
  ].filter(Boolean).join('\n\n')

  const started = Date.now()
  const raw = await chat(system, userMessage)
  const ms = Date.now() - started

  let tips = []
  let parseError = null
  try {
    const parsed = extractJson(raw)
    tips = (parsed.tips ?? []).map((t) => ({ ...t, source: candidates[t.sourceIndex - 1] }))
  } catch (error) {
    parseError = error.message
  }
  return { tips, candidates, topSimilarity: matches[0]?.similarity ?? 0, ms, raw, parseError }
}

function render(result, indent = '') {
  const lines = []
  if (result.candidates.length === 0) {
    lines.push(`${indent}팁 없음 — 임계값(${SIMILARITY_THRESHOLD}) 미달. 최고 유사도 ${result.topSimilarity.toFixed(3)}`)
    return lines.join('\n')
  }
  if (result.parseError) {
    lines.push(`${indent}JSON 파싱 실패: ${result.parseError}`)
    lines.push(`${indent}원문: ${(result.raw ?? '').slice(0, 200)}`)
    return lines.join('\n')
  }
  lines.push(`${indent}팁 ${result.tips.length}개 (후보 ${result.candidates.length}개, ${result.ms}ms)`)
  result.tips.forEach((tip, i) => {
    const sim = tip.source ? tip.source.similarity.toFixed(3) : '근거없음!'
    lines.push(`${indent}  ${i + 1}. [${tip.title}] (유사도 ${sim})`)
    lines.push(`${indent}     요약: ${tip.summary}`)
    lines.push(`${indent}     이유: ${tip.reason}`)
    lines.push(`${indent}     인용: "${tip.quote}"`)
    if (tip.source && !tip.source.content.includes(tip.quote.slice(0, 12))) {
      lines.push(`${indent}     ⚠ 인용문이 원문에 없음 — 지어냈을 가능성`)
    }
  })
  return lines.join('\n')
}

async function main() {
  const promptA = readPrompt(PROMPT_PATH)
  const systemA = buildSystemPrompt(promptA)
  const promptB = COMPARE_PATH ? readPrompt(COMPARE_PATH) : null
  const systemB = promptB ? buildSystemPrompt(promptB) : null

  const STEP_ID = getFlag('--step')
  const items = STEP_ID
    ? [{ label: PROCEDURE_STEPS[STEP_ID]?.label ?? STEP_ID, stepId: STEP_ID }]
    : SINGLE_QUERY
      ? [{ label: '직접입력', situation: SINGLE_QUERY }]
      : readJson('prompts/eval-queries.json')

  const out = []
  const log = (line = '') => {
    console.log(line)
    out.push(line)
  }

  log(`프롬프트 A: ${PROMPT_PATH} (${promptA.id})`)
  if (promptB) log(`프롬프트 B: ${COMPARE_PATH} (${promptB.id})`)
  log(`질문 ${items.length}개 · 팁 최대 ${LIMIT}개 · 유사도 컷 ${SIMILARITY_THRESHOLD}`)
  log('='.repeat(78))

  for (const item of items) {
    log('')
    log(`[${item.label}] ${item.stepId ?? item.situation ?? ''}`)
    log('-'.repeat(78))
    log(render(await runOne(systemA, item), promptB ? 'A ' : ''))
    if (systemB) {
      log('')
      log(render(await runOne(systemB, item), 'B '))
    }
  }

  log('')
  log('='.repeat(78))
  log('확인 포인트: 인용문이 원문에 있는지(⚠ 표시) / 무관한 질문에 팁이 안 나오는지 /')
  log('이유가 "지금 이 단계에 왜 맞는지"를 말하는지 / 제목과 길이가 일정한지')

  if (SAVE_PATH) {
    writeFileSync(path.resolve(process.cwd(), SAVE_PATH), out.join('\n'), 'utf8')
    console.log(`\n저장됨: ${SAVE_PATH}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
