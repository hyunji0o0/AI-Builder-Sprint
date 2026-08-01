import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// vite.config.ts가 이 파일을 import하는 시점(설정 로드 단계)이 vite의 자체 env 로딩보다
// 먼저 실행돼서, 여기서 직접 .env.local을 읽어야 함. 서버(Node) 쪽에서만 쓰는 클라이언트 —
// service role key는 절대 브라우저 번들에 들어가면 안 됨.
config({ path: '.env.local' })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. .env.local을 확인하세요.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
