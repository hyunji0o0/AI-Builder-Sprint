# AGENTS.md

이 파일은 Codex가 이 저장소를 열 때 자동으로 읽는 컨텍스트 파일입니다.
대회 예선 제출물 중 "AI 지침 파일"에 해당합니다.

프로젝트 전체 배경(제품 기획, 왜 이 서비스인지, 기능 명세, 일정)은
`docs/기획서.md`, 대회 규정(제출물·심사기준·적격성 게이트·특별상)은
`docs/대회_안내.md`를 먼저 읽을 것.

**제품 한 줄 요약**: "애도할 시간" — 가족을 잃은 사람이 사후 행정 절차를
혼자 헤매지 않도록, 문서를 읽어주고 다음 할 일을 정리해주고 같은 일을 겪은
사람들의 경험담을 붙여주는 AI 동행 서비스.

## Git 작업 규칙

이 저장소(`hyunji0o0/AI-Builder-Sprint`, 현재 `origin`)는 **포크**입니다.
원본은 `ApptiveDev/AI-Builder-Sprint`(대회 템플릿 레포). **PR, 이슈, 커밋은
전부 이 포크 레포에서만 진행**하고, 원본 레포로는 절대 올리지 않습니다.
특히 `gh pr create`는 포크 관계를 인식하면 기본적으로 원본(upstream) 쪽으로
PR을 만들려고 하는 경우가 있으니, PR 만들 때는 `--repo hyunji0o0/AI-Builder-Sprint`를
명시하거나 생성 후 대상 저장소를 꼭 확인할 것.

## 브랜치 구조 (2026-08-02 기준)

merge가 끝나서 **`main`이 통합본**입니다. 예전 AGENTS.md에 있던
"agent_and_ui와 합칠 때 체크리스트"는 전부 완료되어 삭제했습니다.

- `main` — 통합본. 앱·에이전트·문서 파이프라인·커뮤니티가 전부 여기 있음.
- `community` (주 작업 브랜치) — main을 fast-forward로 따라가며 커뮤니티와
  대화 Agent 작업을 올림. PR #3으로 main에 올리는 중.
- `agent_and_ui`, `community_ui` — main에 병합 완료. 남은 작업 없음.
- `document-parser` — 문서 파싱 실험. main 대비 실질 변경 거의 없음.
- `google_login` — 진행 중. Supabase Auth 구글 로그인(로그인 화면, `useAuth`,
  사이드바 사용자 정보). main보다 한참 뒤처져 있어 merge 전 최신화 필요.

### ⚠️ 유출된 API 키 (2026-08-02, 미해결)

`document-parser` 브랜치의 `.env.local.example`에 **실제 Upstage 키와 Supabase
service_role 키가 커밋된 채 공개 저장소에 올라가 있었음.** 현재 파일은
마스킹했지만(커밋 `e330031`), **git 히스토리에는 값이 그대로 남아 있고 키도
아직 유효함.** service_role은 RLS를 우회하는 관리자 권한이라 커뮤니티 DB
전체를 읽고 지울 수 있음.

**해야 할 일**: Supabase Settings → API에서 service_role 키 재발급, Upstage
콘솔에서 API 키 재발급. 재발급 전까지는 노출 상태가 유지됨.

## 앱 구조

Vite + React + TS 단일 프로젝트. 별도 백엔드 서버 없이 **Vite dev 서버에
미들웨어로 API를 붙이는 방식**을 씀(`vite.config.ts`의 `plugins` 배열).

- `src/app/App.tsx` — 앱 셸. 경로가 `/community`로 시작하면 커뮤니티,
  아니면 메인 챗 화면.
- `src/agent/` — 에이전트 하니스. 아래 §에이전트 구조 참고.
- `src/features/community/` — 커뮤니티 UI(목록·상세·글쓰기·댓글). 팀원이
  만들었고, 아래 서버/스키마는 이 브랜치 것을 그대로 씀.
- `src/server/` — 커뮤니티 백엔드(Supabase 저장소, 추천 엔진, PII 가드).
- `src/schemas/community.ts` — 커뮤니티 zod 스키마 + `COMMUNITY_REVIEW`
  블록 어댑터.
- `src/client/community-api.ts` — 브라우저용 fetch 헬퍼. 새 UI가 이걸 씀.

### 서버 플러그인 두 개

- `src/agent/server/vite-agent-plugin.ts` — `/api/agent`, `/api/documents`.
  Solar 어댑터와 팁 제공자를 만들어 `runAgent`에 주입.
- `src/server/community-server-plugin.ts` — `/api/community/*`.
  `withErrorBoundary()`로 감싸져 있어서 Supabase 에러 하나에 dev 서버가
  죽지 않음(예전에 죽었음. Node 15+의 unhandled rejection 기본 동작).

### 정리해도 되는 고아 코드

`src/components/community/`(CommunityFeed·CommunityPostCard·CommunityComposer·
CommunityComments·AgentTestWidget·community.css)와 `src/client/community-agent-test-api.ts`는
merge 전 독립 실행용으로 만든 것. **지금은 아무 데서도 import하지 않음.**
새 UI(`src/features/community/`)가 대체했으므로 지워도 됨.

## 에이전트 구조

입력은 `src/agent/orchestrator/run-agent.ts` 하나로만 들어오고, 라우터가
**정확히 하나의 Agent만** 실행함. 두 Agent는 서로를 import하지 않으며,
이 경계는 `agent-boundaries.test.ts`가 소스를 텍스트로 읽어 강제함.

```
사용자 입력 → orchestrator(agent-router) ─┬─ conversation Agent
                                          └─ case-workflow Agent → tools
                                                                 → processDocuments
```

### 라우팅 (`orchestrator/agent-router.ts`)

판단축이 두 개라는 게 핵심. `shared/domain-vocabulary.ts`에 어휘를 모아뒀고
라우터와 대화 Agent가 같은 파일을 씀(따로 두면 한쪽만 고쳐져서 어긋남).

- **주제어**(`domainTermPattern`) — 상속·사망·보험·통장… 무엇에 관한 이야기인가
- **동작어**(`caseOperationPattern`) — 업로드·조회·기한·다음… 사건을 실제로 처리해야 하는가

우선순위: 인사 → 대화 / 감정만 있고 주제·동작 없음 → 대화 / **정의를 묻는
질문 → 대화** / 동작어나 주제어 있음 → 사건 / 애매하면 LLM(확신 0.6 미만이면
규칙 폴백).

"상속포기가 뭐야?"는 사건 데이터가 필요 없으니 대화 쪽에서 경험담과 함께
답하고, "상속포기해야 해?"는 본인 사건에 대한 판단이라 사건 Agent가 맡음.
**LLM 실패 시 폴백 방향도 주제어 유무로 가름** — 예전에는 무조건 대화로
떨어져서 LLM이 죽으면 행정 요청이 통째로 묻혔음.

### 대화 Agent (`agents/conversation/`)

응답이 두 갈래.
- 인사·감사·감정 → 짧은 응답만
- 도메인 정의 질문 → 커뮤니티 경험담 카드(`COMMUNITY_REVIEW`)를 함께

팁 조회는 `shared/tip-provider.ts`의 **인터페이스로만** 받음. 실제 구현
(Supabase+임베딩+Solar)은 `vite-agent-plugin.ts`의 `createTipProvider()`가
주입. 이렇게 한 이유는 두 가지 —
(1) 대화 Agent가 `community-recommend.ts`를 직접 import하면 `supabase-client.ts`가
딸려와서 **환경변수 없이는 테스트조차 못 함**,
(2) Agent 경계 테스트가 감시하는 구조가 무너짐.
덕분에 `conversation-agent.test.ts`는 `vi.fn()` 스텁으로 네트워크 없이
"조회를 했는가/안 했는가"까지 단언함.

실패 처리가 세 갈래로 나뉨:

| 무엇이 죽었나 | 결과 |
|---|---|
| provider 미주입 | 카드 없이 평소 대화 |
| 팁 조회 실패 | `lookupTips`가 `[]`, 대화는 정상 진행 |
| 메시지 생성 LLM 실패 | 로컬 폴백 문장, **카드는 그대로 표시** |

마지막이 의도한 설계 — 카드와 본문은 다른 호출에서 나오므로 본문 생성이
죽어도 이미 받은 카드는 살아있음. 이때 로컬 폴백은 `hasTips` 플래그를 받아
카드를 가리키는 문장을 냄.

위기 신호(`assessSafety`의 `immediateRiskSuspected`)가 잡히면 **팁 조회와 LLM
생성을 모두 건너뛰고** 안전 안내를 먼저 반환. 지연되면 안 되고, 그 순간에
경험담 카드를 띄우는 것도 맞지 않아서.

말투 주의: 경험담 원문이 존댓말이라 답변까지 해요체로 끌려갔음. 앱 전체는
반말이라 프롬프트에서 어미를 예시까지 들어 명시해야 교정됨.

### 메모리 (`agent/memory/agent-memory.ts`)

`refreshAgentMemory()`가 매 턴 대화 요약·확인된 사실·대기 중 상호작용을 갱신하고,
`recordAgentMemoryEvent()`가 이벤트와 `lastIntent`를 기록.

**일상 대화 턴도 기록함**(`CONVERSATION_TURN`). 예전에는 대화 Agent가 메모리를
전혀 안 건드려서 `lastIntent`가 직전 사건 업무에 멈춰 있었음. 이에 맞춰 경계
테스트를 `caseState` 전체 비교에서 **"memory를 제외한 사건 데이터 비교"**로
정밀화함 — 지켜야 할 경계는 사건 데이터(문서·금융·업무·기한)를 안 건드리는
것이지 메모리가 아니기 때문. 팀원이 만든 테스트를 수정한 부분이라 공유 필요.

## 커뮤니티 팁 추천 엔진

`src/server/community-recommend.ts`(`recommendCommunityTips()`) +
`community-prompt.ts`(`buildSystemPrompt()`) + `prompts/community-recommend.json`
(프롬프트 본체) + `src/schemas/procedure-steps.ts`·`data/procedure-steps.json`
(기획서 §12 절차 8단계) + `scripts/eval-recommend.mjs`(dev 서버 재시작 없이
프롬프트 튜닝 결과를 비교하는 평가 스크립트).

동작: `stepId` 또는 자유 텍스트 `situation` + `context`(관계·지역·채무초과
여부 등, 전부 선택)를 받아 임베딩 검색 → **유사도 0.3 미만은 버림**
(`SIMILARITY_THRESHOLD`) → 남은 후보를 Solar Pro에 주고 `sourceIndex`(후보
목록 번호)로 근거를 지목하게 해서 `title`/`summary`/`reason`/`quote`만 쓰게 함.
**id·날짜·좋아요 수 같은 사실 값은 전부 코드가 채우므로 메타데이터 환각이
구조적으로 불가능.** LLM 호출/파싱이 실패해도 원문 기반 카드로 폴백
(`toFallbackTip()`).

`{ format: 'block' }`로 호출하면 `toCommunityReviewBlock()`이 `COMMUNITY_REVIEW`
블록 모양으로 바꿔줌. `GET /api/community/steps`로 단계 목록 조회 가능.

## 가드레일

팀원이 `role`/`task`/`style`(프롬프트 튜닝), 제가 `guardrails` 배열(안전)을
나눠 맡음. `prompts/community-recommend.json`에 `_guardrails_note`로 분담이
명시돼 있음.

- `src/server/pii-guard.ts` — `redactPii()`. 전화번호·주민등록번호·이메일·
  계좌/카드번호를 정규식으로 마스킹. **LLM에 후보 글을 보여주기 전에** 먼저
  거르고(원문을 못 보게 하는 게 핵심 방어선), LLM 출력에도 한 번 더 적용하고,
  LLM 실패 시 원문을 쓰는 폴백 경로(`toFallbackTip()`)에도 적용함(안 그러면
  폴백으로 가드레일이 통째로 우회됨). 날짜나 "3개월" 같은 일반 숫자는 안
  건드리는 것, 실제 PII가 섞인 글로 파이프라인 전체를 돌려 최종 카드에 유출
  안 되는 것까지 검증함(2026-07-31).
  - 정규식 한계: 실명·구체적 주소는 못 잡음 → 프롬프트 `guardrails`로 보완.
  - 커뮤니티 피드 자체(글 목록, 원문 보기)는 마스킹 대상이 아님. 사용자가
    직접 쓴 자기 글을 그대로 보여주는 것뿐이라 의도적으로 건드리지 않음.
    가드레일은 **에이전트가 생성하는 요약/추천에만** 적용.
- `prompts/community-recommend.json`의 `guardrails` — 역할·범위, 프롬프트
  인젝션 방지(경험담 속 지시문 무시 + 시스템 프롬프트 유출 거부), 개인정보
  보호, 전문 자문 아님, 유해 콘텐츠 금지 순으로 섹션을 나눔.
- `src/agent/safety/` — 에이전트 쪽 별도 안전장치. `privacy-filter`(입력
  마스킹), `output-guard`("상속포기 하세요" 같은 단정 표현 치환),
  `safety-hooks`(위기·심각한 정서 신호 감지).
- **역할·범위는 프롬프트만으론 안 지켜져서 코드 레벨 기준선을 같이 씀.**
  "파이썬 정렬 알고리즘" 질문이 "디지털 유산 정리" 글과 "디지털"이라는 단어
  하나 겹쳐서 통과된 사례를 실제로 발견함(2026-07-30). 팀원도 독립적으로 같은
  문제("점심 메뉴" 질문에 카드가 생성됨)를 발견해 `SIMILARITY_THRESHOLD`를
  걸어뒀고, 병합 때 그 구현을 채택함.

## 데이터베이스 (Supabase)

- `supabase/schema.sql` — `community_posts`, `community_comments` + pgvector.
  `embedding vector(4096)`(Upstage solar-embedding-1-large 차원).
  RLS는 켜져 있지만 정책은 없음 — 브라우저가 Supabase에 직접 접근하지 않고
  항상 서버가 service role 키로만 접근하기 때문. `anon` 키가 노출돼도 아무것도
  못 읽는 효과가 있음.
- `categories`는 `text[]` — 글 하나에 카테고리 여러 개. enum이 아니라 배열
  이라 카테고리를 추가해도 DB 마이그레이션 없이 zod 스키마만 고치면 됨
  (`VENT` 추가할 때 실제로 이렇게 했음).
- 제목 컬럼이 없음. `content`의 **첫 줄이 제목, 빈 줄 뒤가 본문**이라는 규약을
  `community.remote-repository.ts`에서 조립/분리함. 스키마 변경 없이 제목을
  넣으려고 팀원이 택한 방식.
- **로컬 실행**: Supabase 프로젝트 생성 → SQL Editor에서 `supabase/schema.sql`
  실행 → Settings → API에서 URL과 service_role 키 확인 → `.env.local`에 채우기
  (`.env.local.example` 참고. `.env.local`은 gitignore됨).
- `src/server/supabase-client.ts` — 서버 전용. **`vite.config.ts`가 이 파일을
  import하는 시점이 vite 자체 env 로딩보다 먼저라서** `dotenv`로 직접
  `.env.local`을 읽음(vite `loadEnv`를 쓰면 순서 문제로 크래시. 실제 겪은 버그).
- 임베딩은 글 생성·수정 시 백그라운드로 채워짐. **초기 스키마가 `vector(1536)`
  이라 4096차원 저장이 전부 조용히 실패하던 버그가 있었음**(2026-07-30 발견,
  `migration_fix_embedding_dim.sql`로 수정 + 백필 완료).
- 현재 글 86개. 마이그레이션 스크립트(`scripts/migrate-to-supabase.mjs`)로
  65개를 넣었고 이후 추가됨.
  - `docs/tips_tagged.md`는 블로그·유튜브 등에서 조사한 2차 자료라 팀원 실제
    경험담이 아님. "실제 경험 맞냐"는 심사 질문에 애매해질 수 있다고 안내한
    뒤, 1인칭 경험담 톤으로 각색해 넣기로 **팀이 인지하고 결정**함(닉네임도
    새로 지어 구분).

## 왜 이런 구조인가 (결정 배경)

- **회원가입은 나중에.** 지금은 닉네임 직접 입력 스텁. "내 글"/"좋아요" 판별은
  localStorage. **주의: 수정/삭제 API(`PATCH`·`DELETE /api/community/posts/:id`)에
  소유자 검증이 전혀 없음** — 화면에선 내 글에만 버튼이 보이지만 API를 직접
  치면 누구 글이든 수정·삭제 가능. `google_login` 머지할 때 반드시 같이 막아야 함.
- **데이터 전달은 API 엔드포인트 방식.** DB 직접 조회 대신 라우트로 분리해서,
  다른 담당자가 인증·권한을 몰라도 fetch만 하면 되게 함.
- **DB는 파일 → Supabase로 전환.** 처음엔 보류했다가, 에이전트가 이 데이터로
  팁을 추천하는 기능을 만들기로 하면서 실제 DB로 옮김. pgvector 임베딩 컬럼을
  미리 준비해둔 것도 이 목적.

## 다음 할 일

1. **유출 키 재발급** — §브랜치 구조의 경고 참고. 계정 작업이라 사람이 해야 함.
2. **PR #3 머지** — `community` → `main`.
3. **`case-tools.ts`의 `searchCommunityReviews()`가 빈 배열 반환 중** —
   채팅 화면의 "맞춤 후기 추천" 버튼이 눌러도 아무것도 안 나옴. 대화 Agent에
   주입한 것과 같은 provider를 꽂으면 됨. 오른쪽은 사용자 상황(관계·지역·업무)
   까지 검색어에 넣을 수 있어 진짜 "맞춤"이 됨.
4. **`findLocalInstitutions()`도 빈 배열** — "부산 기관 찾기" 버튼도 동일 증상.
5. **`google_login` 머지** — main 대비 많이 뒤처져 있음. 머지 시 위 소유자
   검증도 같이.
6. **고아 코드 정리** — `src/components/community/`, `client/community-agent-test-api.ts`.
7. **`docs/tips_raw.md` 처리 방향** — 세무사 상담 요약. F7 팁 카드로 갈지,
   커뮤니티로 갈지, 출처 명시 별도 카드로 갈지 팀 논의 필요.
8. **커밋된 잡동사니 정리** — `__pycache__/*.pyc`, `tests/results`의 zip 등.

## 실행·검증 참고

- `npm install && npm run dev`, `npx tsc --noEmit`, `npx vitest run` 정상.
  테스트 84개 통과.
- `.Codex/launch.json` — Codex 프리뷰 도구로 dev 서버를 이름
  (`community-dev`)으로 띄우는 설정.
- **서버 쪽 코드(`vite.config.ts`, `src/server/*`, `src/agent/server/*`,
  Agent 코드)를 바꾼 뒤에는 dev 서버 프로세스를 재시작해야 반영됨.** Vite HMR이
  서버 미들웨어 모듈 캐시까지 갱신해주지 않음(반복해서 겪은 문제 — 프롬프트를
  고쳤는데 응답이 안 바뀌면 십중팔구 이것).
