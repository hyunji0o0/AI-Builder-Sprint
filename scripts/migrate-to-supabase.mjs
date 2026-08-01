// 1회성 마이그레이션 스크립트: 기존 파일 기반 시드 글 + docs/tips_tagged.md의
// 조사 자료를 "팀원 경험담" 톤으로 각색한 글을 Supabase에 넣는다.
// 실행: node scripts/migrate-to-supabase.mjs
//
// 주의: 한 번만 실행할 것. community_posts에 이미 데이터가 있으면 중복 방지를
// 위해 스스로 중단한다(재실행하려면 Supabase 테이블을 비우고 다시 돌릴 것).

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

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 없습니다. .env.local을 확인하세요.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// --- 1. 기존 시드 글 (팀원이 실제로 쓴 5개, data/community-posts.seed.json 그대로) ---
const seedPath = path.resolve(process.cwd(), 'data/community-posts.seed.json')
const originalPosts = JSON.parse(readFileSync(seedPath, 'utf8')).map((post) => ({
  nickname: post.nickname,
  categories: [post.category], // categories는 배열 컬럼(중복 카테고리 허용) — 원본은 1개씩만 있었음
  content: post.content,
  created_at: post.createdAt,
  helpful_count: post.helpfulCount,
}))

// --- 2. docs/tips_tagged.md 조사 자료를 1인칭 경험담 톤으로 각색한 글 ---
// 각 항목은 원본 문서의 bullet 하나에 대응. 원본 출처(블로그·유튜브 등)는
// 각색 과정에서 제거하고 개인 경험처럼 다시 씀 — 사용자가 이 방향으로 진행하기로
// 결정함(대회 심사에서 "실제 경험 맞냐" 질문이 나올 수 있다는 점은 미리 안내함).
const NICKNAMES = [
  '가을바람', '흐린하늘', '조용한숲', '새벽별', '잔잔한파도', '노을빛', '마른잎', '고요한밤',
  '첫눈', '봄비', '저녁노을', '잔물결', '하얀구름', '차가운달', '오랜나무', '작은등불',
  '여린바람', '깊은강', '이른아침', '낮은구름', '조각달', '강가마을', '겨울나무', '여름밤',
  '새벽이슬', '노란은행잎', '잔잔한호수', '흰눈송이', '늦은봄', '푸른하늘',
]

const TIPS = [
  { category: 'RENOUNCE', content: '1순위 상속인이 전부 포기하니까 상속권이 고인 형제자매랑 조카들한테 넘어가더라고요. 그분들도 각자 따로 포기 신청 안 하면 나중에 분쟁 생길 수 있으니 꼭 알려주세요.' },

  { category: 'TAX', content: '협의분할이 법정분할보다 우선이라길래, 가족들 재산 상황 보고 상속세 제일 적게 나오는 쪽으로 분할 비율을 다시 짰어요.' },
  { category: 'TAX', content: '계좌 잔액증명서 발급받고 사망일 기준 10년치 거래내역을 엑셀로 뽑아달라고 은행에 요청했어요. 상속세 신고할 때 꼭 필요하더라고요.' },
  { category: 'TAX', content: '상속세 신고서 쓸 때 순서가 있더라고요. 재산처분·채무내역 소명 → 상속재산 평가명세서 → 채무·장례비용 공제명세서 → 과세가액계산 → 과세표준 신고 순으로 진행했어요.' },
  { category: 'TAX', content: '장례식장 견적서랑 영수증 꼭 챙기세요. 장례비도 상속세 신고할 때 비용으로 인정돼서 세금 줄이는 데 도움 됐어요.' },
  { category: 'TAX', content: '신고 전에 고인 최근 10년 계좌 내역부터 확인하세요. 사용처 불분명한 이체 있으면 상속재산으로 보거나 미신고 증여로 잡혀서 세금 더 나올 수 있대요.' },
  { category: 'TAX', content: '사전 증여받은 재산은 10년 안이면 다 신고해야 해요. 저희 아는 분은 9년 11개월 전에 준 3억을 신고 안 했다가 나중에 가산세까지 붙어서 크게 추징당했다고 하더라고요.' },
  { category: 'TAX', content: '계좌 내역 확인할 때 배우자·자녀만 보면 안 되고 사위·며느리·손주 명의까지 다 봐야 한대요. 저희도 7년 전에 손주한테 준 돈 때문에 사용처 소명하느라 고생했어요.' },
  { category: 'TAX', content: '상속세·취득세 낼 현금은 미리 마련해두세요. 막상 신고할 때 되니까 현금이 없어서 급하게 마련하느라 힘들었어요.' },
  { category: 'TAX', content: '신고 기한 지나고 9개월 안에 세무조사 나올 수 있대요. 간병비 청구 내역까지 들여다보길래 소명 서류 미리 준비해두길 잘했다 싶었어요.' },
  { category: 'TAX', content: '상속세 신고·납부는 최대한 빨리 하는 게 낫더라고요. 미루다가 서류 준비할 시간만 더 촉박해졌어요.' },
  { category: 'TAX', content: '상속받은 부동산은 개시 후 6개월 안에 가격을 정해야 하는데, 아파트냐 단독주택이냐에 따라 감정평가 방식이 다르다는 걸 이번에 알았어요.' },
  { category: 'TAX', content: '2025년부터 부동산 감정평가가 대대적으로 늘어서 상속세 추가 추징 사례가 많아졌대요. 저희도 신고 후에 재평가 통보를 받았어요.' },
  { category: 'TAX', content: '부동산 감정평가 가격이 시가나 유사 매매사례, 신고 시기에 따라 달라지더라고요. 신고 전에 가격 변동까지 챙겨보시는 게 좋아요.' },
  { category: 'TAX', content: '고인이 임대소득이 있었으면 종합소득세도 상속 개시 이후에 따로 신고해야 하더라고요. 이거 놓칠 뻔했어요.' },

  { category: 'TRANSFER', content: '상속재산분할협의서는 꼭 서면으로 남기세요. 구두로만 합의했다가 나중에 재산 목록이 다르다고 해서 분쟁 날 뻔했어요.' },
  { category: 'TRANSFER', content: '이미 집 있는 자녀 대신 무주택인 배우자가 주택을 상속받으니까 취득세가 0.96%까지 줄더라고요. 1세대 1주택 요건 맞는지가 핵심이었어요.' },
  { category: 'TRANSFER', content: '상속인이 3명 이상이면 균등하게 나눠 받는 걸로 협의하는 게 취득세 면에서 훨씬 유리하다고 해서 그렇게 했어요.' },
  { category: 'TRANSFER', content: '상속재산 등기는 배우자 상속공제 고려해서 신고 기한 마지막 달에 하는 게 유리하다고 세무사님이 알려주셨어요.' },
  { category: 'TRANSFER', content: "생전에 이미 집이나 목돈을 받은 형제는 '초과수익자'로 분류돼서 상속분이 줄어들 수 있다는 거, 재산 나눌 때 쟁점이 됐어요." },
  { category: 'TRANSFER', content: '고인 명의 자동차는 상속 말소 신청을 안 하면 범칙금이 나올 수 있어요. 저는 몰라서 하마터면 낼 뻔했어요.' },

  { category: 'INSURANCE', content: '국민연금 유족연금이랑 별도로 장제비 500만원을 따로 신청해야 하는데, 저도 몰라서 놓칠 뻔했어요.' },
  { category: 'INSURANCE', content: '유족연금은 사망일로부터 5년 지나면 신청 자체가 아예 안 된대요(소멸시효). 다른 서류보다 이거부터 챙겼어요.' },
  { category: 'INSURANCE', content: '국민연금 가입 기간이 10년 안 됐으면 유족연금보다 반환일시금이 더 나을 수도 있대요. 공단에 두 옵션 비교해달라고 요청했어요.' },
  { category: 'INSURANCE', content: '유족연금 받다가 재혼하면 수급권이 바로 없어지는데, 신고 안 하면 부당수급으로 환수당한다고 해서 조심하고 있어요.' },
  { category: 'INSURANCE', content: '유족연금을 연 500만원 넘게 받으면 기타소득으로 잡혀서 종합소득세 신고 대상이 될 수 있다는 것도 이번에 알았어요.' },
  { category: 'INSURANCE', content: '고인이 직장가입자였는데 사망신고만으로는 부족하고, 회사에서 따로 건강보험 자격상실 신고서를 내야 하더라고요.' },
  { category: 'INSURANCE', content: '건강보험료는 사망일 기준으로 일할 계산돼서 환급이나 추가납부로 정리돼요. 대표자 계좌를 지정해두니 환급금 받기 편했어요.' },
  { category: 'INSURANCE', content: '건강보험 본인부담상한제 환급금은 사망 후 1년쯤 지나서 안내 오고 신청 기한이 3년이라, 나중에 잊어버리기 딱 좋더라고요.' },
  { category: 'INSURANCE', content: "'건강보험 25시' 앱에서 고인 앞으로 남은 환급금을 바로 조회할 수 있어요. 이것도 3년 지나면 없어진다니 미리 확인하세요." },
  { category: 'INSURANCE', content: '행정복지센터 갈 때 건강보험이랑 국민연금 같이 정리해달라고 한 번에 요청했더니 왔다갔다하는 수고를 덜었어요.' },

  { category: 'SUBSCRIPTION', content: '휴대폰이나 카드 해지하려면 남은 이용대금부터 정산해야 해요. 상조 상품 가입 여부도 따로 확인해야 해서 해지 전에 본인인증 거쳐서 미리 조회해봤어요.' },
  { category: 'SUBSCRIPTION', content: '사망 후 3개월 지나면 통신사에서 강제로 정지시킨다고 해서 그 전에 서둘러 처리했어요.' },
  { category: 'SUBSCRIPTION', content: '상속 절차 끝나기 전까지는 휴대폰 요금제 변경이나 번호 승계, 초기화는 하지 말라는 조언을 들었어요.' },
  { category: 'SUBSCRIPTION', content: '반대로 사망 후 1년 안에는 오히려 정지시키지 말라는 의견도 있더라고요. 본인인증 수단으로 계속 필요할 수 있어서 상황 봐가면서 판단했어요.' },
  { category: 'SUBSCRIPTION', content: '휴대폰 해지·정지 전에 사진 같은 자료부터 꼭 백업해두세요. 저는 다행히 미리 챙겨서 괜찮았어요.' },

  { category: 'ETC', content: '사망진단서는 여러 절차에서 원본이 필요해서 넉넉하게 10부 정도 미리 발급받아뒀어요.' },
  { category: 'ETC', content: '가족관계증명서, 기본증명서도 사망신고랑 상속 절차 곳곳에서 계속 요구되길래 여러 부 미리 떼놨더니 재발급 안 해도 돼서 편했어요.' },
  { category: 'ETC', content: '사망신고는 안 날부터 1개월 안에 해야 하는데, 늦어도 과태료 5만원 이하고 신고 자체는 유효하다고 해서 조금 늦었지만 문제없이 접수됐어요.' },
  { category: 'ETC', content: "사망신고서 쓸 때 사망시각을 24시간제로 적어야 해요(오후 10시→22시). '미상'이라고 적으면 접수가 거부된다고 해서 정확히 확인하고 갔어요." },
  { category: 'ETC', content: '주민센터 가기 전에 전화로 필요서류랑 신고 우선순위자가 누군지 먼저 물어봤더니 헛걸음 안 하고 한 번에 끝났어요.' },
  { category: 'ETC', content: '사망신고 장소는 본적지, 신고인 주소지, 사망지, 주민등록지 중 편한 데서 하면 되더라고요. 저는 집 근처 주민센터로 갔어요.' },
  { category: 'ETC', content: '사망신고는 온라인 접수가 안 되고 방문이나 우편만 가능해요. 갈 때 안심상속 원스톱서비스도 같이 신청하니까 이후 절차가 훨씬 수월했어요.' },
  { category: 'ETC', content: '사망신고 접수되는 순간 고인 인감이 효력을 잃는대요. 사망 사실 알면서 인감증명서 발급받으면 안 된다고 해서 조심했어요.' },
  { category: 'ETC', content: '안심상속 원스톱서비스 이용하니까 금융·부동산·자동차·세금 내역을 한 번에 조회할 수 있어서 진짜 편했어요.' },
  { category: 'ETC', content: '안심상속 원스톱서비스 신청하는 순간부터 고인 명의 금융자산 인출이 정지돼요. 계좌를 임의로 막으면 안 되니까 이 정식 절차로 하세요.' },
  { category: 'ETC', content: '행정 업무 익숙한 상속인이 신청하는 게 낫더라고요. 신청 후에 휴대폰으로 확인 연락 오는 거 놓치지 마세요.' },
  { category: 'ETC', content: '신청 전에 콜센터에 미리 전화해서 필요 서류부터 확인해봤어요. 덕분에 서류 빠뜨리지 않고 한 번에 처리했어요.' },
  { category: 'ETC', content: '사망신고랑 안심상속 신청하러 갈 때 인감증명서, 가족관계증명서, 주민등록등본 미리 발급받아서 챙겨갔어요.' },
  { category: 'ETC', content: '협의 없이 고인 계좌에서 큰 금액 인출하면 형사 문제 될 수 있대요. 실제로 장남이 몰래 2억 옮겼다가 형사처벌은 면했어도 형제들한테 부당이득반환청구는 그대로 인정된 사례를 들었어요.' },
  { category: 'ETC', content: '부모님 생전에 통장·도장을 맡아 관리했다고 해서 마음대로 써도 되는 게 아니더라고요. 나중에 다툼 생기면 이 구분이 쟁점이 된다길래 서면으로 권한 범위 남겨뒀어요.' },
  { category: 'ETC', content: '외국 국적이었던 고인이라 국제사법상 본국법이 적용될 수 있다고 해서, 국내 상속 절차랑 다르게 미국법 서류(유언 검증서 등)까지 준비해야 했어요.' },
  { category: 'ETC', content: '카카오톡 계정은 추모 프로필로 전환하거나 삭제 요청할 수 있는데, 신청서랑 사망진단서, 가족관계증명서를 카카오 쪽에 제출해야 해요.' },
  { category: 'ETC', content: '네이버 계정은 고객센터에 사망진단서, 가족관계증명서, 신분증 사본을 온라인으로 접수했더니 7~10일 안에 삭제 처리됐어요.' },
  { category: 'ETC', content: '페이스북이나 인스타그램은 기념 계정 전환이나 삭제가 가능한데, 해외 서비스라 영문 서류나 공증·번역이 필요해서 시간이 좀 걸렸어요.' },
  { category: 'ETC', content: '트위터(X)는 유족한테 넘겨주는 옵션이 없고, 사망증명서 내도 비활성화만 가능하다고 하더라고요.' },
  { category: 'ETC', content: "유튜브나 구글 계정은 생전에 '비활성 계정 관리자'를 지정해뒀으면 편한데, 안 해뒀으면 유족이 구글 공식 요청 페이지로 직접 신청해야 해요." },
  { category: 'ETC', content: '고인 SNS·계정 정리에서 제일 큰 장벽은 결국 스마트폰 잠금이랑 각 계정 비밀번호였어요. 평소에 힌트라도 아는 가족이 있는지부터 확인해보세요.' },
  { category: 'ETC', content: '카카오페이·네이버페이 잔액은 각 서비스마다 따로 상속 요청을 해야 하고, 암호화폐는 거래소면 일반 상속 절차대로지만 개인 지갑은 복구 문구 없으면 사실상 복구가 안 된다고 하더라고요.' },
  { category: 'ETC', content: '디지털 유산은 장례 직후엔 비밀번호·자산 파악부터 하고, 2~4주 안에 각 플랫폼 계정 처리, 한 달 안에 금융자산 상속까지 순서대로 하니까 안 헷갈렸어요.' },
]

const NOW = Date.now()
const tipPosts = TIPS.map((tip, i) => {
  const daysAgo = 9 + Math.floor(i * 0.85) // 기존 시드 글(최대 8일 전)보다 더 과거로 깔아서 자연스러운 히스토리를 만듦
  const hourJitter = (i * 5) % 24
  const createdAt = new Date(NOW - daysAgo * 86_400_000 - hourJitter * 3_600_000).toISOString()
  const helpfulCount = ((i * 7) % 23) + 1
  return {
    nickname: NICKNAMES[i % NICKNAMES.length],
    categories: [tip.category],
    content: tip.content,
    created_at: createdAt,
    helpful_count: helpfulCount,
  }
})

async function main() {
  const { count, error: countError } = await supabase
    .from('community_posts')
    .select('*', { count: 'exact', head: true })
  if (countError) throw countError
  if (count && count > 0) {
    console.error(`community_posts에 이미 ${count}개 행이 있습니다. 중복 방지를 위해 중단합니다.`)
    process.exit(1)
  }

  const allPosts = [...originalPosts, ...tipPosts]
  const { data, error } = await supabase.from('community_posts').insert(allPosts).select('id')
  if (error) throw error

  console.log(`총 ${data.length}개 글 삽입 완료 (기존 시드 ${originalPosts.length}개 + 팁 각색 ${tipPosts.length}개)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
