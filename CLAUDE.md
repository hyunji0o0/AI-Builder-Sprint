# CLAUDE.md — community 브랜치

이 파일은 Claude Code가 이 저장소를 열 때 자동으로 읽는 컨텍스트 파일입니다.
커뮤니티(경험 나눔) 기능 작업 배경과 결정 사항을 정리했습니다.

프로젝트 전체 배경(제품 기획, 왜 이 서비스인지, 기능 명세, 일정)은
`docs/기획서.md`, 대회 자체 규정(제출물·심사기준·적격성 게이트·특별상)은
`docs/대회_안내.md`를 먼저 읽어볼 것. 두 문서 모두 이 브랜치에서 처음
정리했고, 다른 브랜치(main/agent_and_ui/document-parser)에는 아직 없음 —
팀 전체가 보게 하려면 별도로 main에도 올리는 게 좋음.

## Git 작업 규칙

이 저장소(`hyunji0o0/AI-Builder-Sprint`, 현재 `origin`)는 **포크**입니다.
원본은 `ApptiveDev/AI-Builder-Sprint`(대회 템플릿 레포). **PR, 이슈, 커밋은
전부 이 포크 레포에서만 진행**하고, 원본 레포로는 절대 올리지 않습니다.
특히 `gh pr create`는 포크 관계를 인식하면 기본적으로 원본(upstream) 쪽으로
PR을 만들려고 하는 경우가 있으니, PR 만들 때는 `--repo hyunji0o0/AI-Builder-Sprint`를
명시하거나 생성 후 대상 저장소를 꼭 확인할 것.

## 브랜치 구조

- `main` — 대회 템플릿 README만 있음. 아직 아무것도 merge 안 됨.
- `agent_and_ui` — 실제 앱(Vite + React + TS). 사이드바·챗·대시보드 전부 여기 있음.
  앱 이름은 `time-to-grieve`. 백엔드가 따로 없고, Vite dev 서버에 미들웨어로
  API를 붙이는 방식(`src/agent/server/vite-agent-plugin.ts`)을 씀. DB 없이
  클라이언트가 매 요청마다 `caseState` 전체를 서버로 보내는 구조.
- `document-parser` — 문서 파싱 실험 코드, 별도.
- `community` (이 브랜치) — 경험 나눔(커뮤니티) 기능. `agent_and_ui`와 **아직
  merge 안 했고, 금요일에 합치기로 함**. 그래서 지금은 자체적으로 실행 가능한
  최소 Vite+React+TS 프로젝트로 구성돼 있음(package.json, vite.config.ts 등).
  단, `agent_and_ui`와 달리 이 브랜치는 **Supabase(Postgres) DB를 실제로 씀**
  (아래 "데이터베이스" 섹션 참고) — merge 때 이 차이를 고려해야 함.

## 이 브랜치에서 만든 것

풀스택 커뮤니티 기능. 저장소는 Supabase(Postgres)를 씀 — 처음엔 파일 기반으로
시작했다가, 나중에 에이전트가 이 데이터를 학습해서 팁을 추천하는 기능까지
염두에 두고 실제 DB로 전환함(아래 "데이터베이스" 섹션 참고).

- `src/schemas/community.ts` — zod 스키마. 카테고리 7종: `RENOUNCE`, `TAX`,
  `TRANSFER`, `INSURANCE`, `SUBSCRIPTION`, `VENT`, `ETC`. 앞의 5개(+ETC)는
  기획서 F2 할일 카테고리와 맞춰서, 메인 챗 에이전트가 "지금 이 할일과 관련된
  팁"을 필터링해서 가져오기 쉽게 한 것. `VENT`("그냥 이야기")만 예외 —
  특정 할일에 안 묶이는 하소연·감정 나눔용으로 나중에 추가함.
- `src/server/community-store.ts`, `src/server/community-comment-store.ts` —
  Supabase 쿼리 기반 저장소 (`src/server/supabase-client.ts`의 service role
  키 클라이언트를 씀). 글/댓글 각각 담당.
- `src/server/community-server-plugin.ts` — `/api/community/posts` 및 하위
  경로(`/:id`, `/:id/helpful`, `/:id/comments`) GET/POST/PATCH/DELETE.
  `agent_and_ui`의 `vite-agent-plugin.ts`와 완전히 같은 패턴(Connect 미들웨어).
- `src/components/community/` — `CommunityFeed`(카테고리 탭 + 검색 + 정렬 +
  목록 + 글쓰기 + "내가 쓴 글" 토글), `CommunityPostCard`(카테고리 여러 개
  배지, 좋아요/취소, 수정 버튼, 댓글 섹션), `CommunityComposer`(카테고리
  다중 선택, 글자 수 제한 없음), `CommunityComments`(댓글 + 대댓글, 각각
  1개 초과 시 "더보기").
- `src/components/community/AgentTestWidget.tsx` — merge 전에 실제 추천
  엔진(`/api/community/recommend`)을 직접 눌러보기 위한 임시 위젯. 화면
  우측 하단에 흔히 보이는 동그란 챗 버블 패턴으로, 클릭하면 작은 패널이 열려
  자유 텍스트로 상황을 입력하면 `/api/community/recommend`를 `format: 'block'`으로
  호출해 카드 최대 3개를 보여줌(메인챗이 실제로 쓰는 것과 같은 응답 모양).
  카드의 "더 자세히 보기"는 `GET /api/community/posts/:id`로 원글 전체를 펼침.
  **merge 후엔 실제 메인챗이 이 역할을 대신하니 이 컴포넌트와
  `src/client/community-agent-test-api.ts`는 지워도 됨** (라우트 자체는
  메인챗도 그대로 쓰므로 유지).
- `src/client/community-api.ts`, `my-community-posts.ts`, `community-likes.ts`
  — fetch 헬퍼 + localStorage 기반 "내 글"/"좋아요 누른 글" 판별 (로그인 전
  스텁, §"왜 이런 구조인가" 참고).
- **커뮤니티 팁 추천 엔진** — `src/server/community-recommend.ts`
  (`recommendCommunityTips()`), `src/server/community-prompt.ts`
  (`buildSystemPrompt()`), `prompts/community-recommend.json`(프롬프트
  본체), `src/schemas/procedure-steps.ts` + `data/procedure-steps.json`
  (기획서 §12 절차 단계 8개 정의), `scripts/eval-recommend.mjs`(프롬프트
  튜닝 결과를 dev 서버 재시작 없이 비교하는 평가 스크립트, `prompts/eval-queries.json`
  사용). **팀원 PR(`community-agent-prompt-tuning`, #2)과 제가 병렬로 만들던
  두 버전의 추천 기능을 2026-07-31에 합친 결과물** — 자세한 배경은
  §"팀원 PR 병합" 참고.
- `src/components/ui/Icon.tsx`, `GlassIcon.tsx` — **`agent_and_ui`의 동일 파일을
  그대로 복사**해온 것. merge할 때 이 두 파일은 지우고 `agent_and_ui` 쪽을
  쓰면 됨 (완전히 같은 내용이라 충돌 없이 dedupe 가능).
- `src/components/community/community.css` — 위쪽 `.da-*` 규칙은
  `agent_and_ui`의 `src/dashboard.css`에서 그대로 가져온 것(중복, merge 때
  지우면 됨) + `VENT` 카테고리용 `da-lavender`/`cm-lavender` 톤(**merge 때
  dashboard.css에도 이 톤을 추가해야 함**, 원본엔 없던 색). 아래쪽 나머지
  `.cm-*` 규칙은 이 브랜치에서 새로 추가한 것.

## 데이터베이스 (Supabase)

- `supabase/schema.sql` — 테이블 DDL. Supabase 프로젝트의 SQL Editor에서
  그대로 실행하면 됨. `community_posts`, `community_comments` 두 테이블 +
  pgvector 확장. 둘 다 `embedding vector(1536)` 컬럼을 nullable로 미리
  만들어둠 — 지금은 비어있고, 나중에 에이전트가 이 글들을 벡터로 변환해서
  채우면 카테고리 필터 + 의미 기반 유사도 검색까지 가능해지는 구조.
  RLS는 켜져 있지만 정책은 안 만듦 — 브라우저가 Supabase에 직접 접근하는 일이
  없고(항상 우리 서버가 service role 키로만 접근), service role은 RLS를
  항상 우회하기 때문에 문제 없음. 대신 `anon` 키가 어디선가 노출되더라도
  기본적으로 아무 것도 못 읽어가게 막는 효과가 있음.
- **로컬에서 돌리려면**: Supabase 프로젝트 생성 → SQL Editor에서
  `supabase/schema.sql` 실행 → Project Settings → API에서 Project URL과
  service_role(secret) 키 확인 → `.env.local`에 `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`로 채우기 (`.env.local.example` 참고,
  `.env.local`은 gitignore되어 있어서 각자 채워야 함).
- `src/server/supabase-client.ts` — 서버 전용 클라이언트. **`vite.config.ts`가
  이 파일을 import하는 시점이 vite 자체 env 로딩보다 먼저라서**, `dotenv`로
  직접 `.env.local`을 읽음(vite의 `loadEnv`를 쓰면 순서 문제로 크래시남 —
  실제로 겪은 버그, 이 방식으로 고침).
- `scripts/migrate-to-supabase.mjs` — 1회성 마이그레이션 스크립트. 기존 시드
  글 5개(`data/community-posts.seed.json`) + `docs/tips_tagged.md`의 조사
  자료를 1인칭 경험담 톤으로 각색한 글 60개, 총 65개를 넣음. **이미 실행
  완료** — 재실행하면 `community_posts`에 데이터가 있어서 스스로 중단하게
  안전장치를 넣어뒀음(중복 방지).
  - `docs/tips_tagged.md`는 네이버 블로그·법무법인 블로그·세무사 유튜브·로톡
    등에서 조사한 2차 자료라, 팀원 실제 경험담이 아님. 그대로 넣으면
    "실제 경험 맞냐"는 심사 질문에 애매해질 수 있다고 미리 안내했고, 그래도
    1인칭 경험담 톤으로 각색해서 넣기로 **팀 결정**함(닉네임도 새로 지어서
    구분).
- `data/community-posts.seed.json`, `data/community-comments.seed.json` —
  이제 앱이 직접 읽지는 않지만(Supabase로 넘어감), 마이그레이션 스크립트의
  소스로 여전히 씀. `data/*.runtime.json`은 예전 파일 기반 저장소 시절 흔적
  (gitignore됨, 지금은 안 씀 — 지워도 무방).

## 왜 이런 구조인가 (결정 배경)

- **회원가입은 나중에 구현.** 지금은 글쓰기 폼에서 닉네임을 직접 입력받는
  스텁. `CommunityPost.nickname`은 문자열이라, 나중에 로그인 붙이면 로그인
  유저 정보로 바꿔 끼우면 됨 (스키마 변경 없음). "내가 쓴 글"/"좋아요 누른
  글" 판별도 지금은 이 브라우저의 localStorage에 id를 기록해두는 방식(§내가
  만든 것)이라, 로그인 붙이면 서버 쪽 소유자 필드 체크로 교체하면 됨. **주의:
  지금 수정/삭제 API(`PATCH`, `DELETE /api/community/posts/:id`)엔 소유자
  검증이 전혀 없음** — 화면에선 내 글에만 버튼이 보이지만 API를 직접 치면
  누구 글이든 수정·삭제 가능. 로그인 붙일 때 반드시 같이 막아야 함(2026-07-30
  브랜치 점검 때 발견, 지금은 데모 규모라 의도적으로 미룸).
- **카테고리는 필수값.** 메인 챗 쪽 에이전트가 "지금 이 할일과 관련된 팁"을
  골라오려면 태그가 있어야 필터링이 쉬움. 카테고리 값 자체는 DB에서 `text`
  컬럼(enum 타입 아님)이라, 나중에 카테고리를 추가/변경해도 DB 마이그레이션
  없이 zod 스키마만 바꾸면 됨(`VENT` 추가할 때 실제로 이렇게 했음).
- **시드 데이터는 팀원이 실제로 쓴 글로 채움.** 데모 때 커뮤니티가 텅 비어
  보이는 콜드스타트 문제를 피하려는 것. 이 원칙은 `tips_tagged.md`를 커뮤니티
  글로 각색하기로 하면서 한 번 완화됨(§데이터베이스 참고) — 대회 심사
  대응은 팀이 인지하고 결정한 사항.
- **원본 글 vs 정제된 팁 카드 구분.** 메인 챗의 `AgentBlock.tsx`에는 이미
  `COMMUNITY_REVIEW`라는 블록 타입이 스키마와 렌더링까지 만들어져 있음
  (지금은 하드코딩된 후기 1개짜리 더미). `toCommunityReviewItem()` 함수가
  `CommunityPost`를 그 블록이 기대하는 `{ excerpt, reason, createdAt,
  helpfulCount, url, label }` 형태로 변환해줌 — merge 후 이 어댑터로 실제
  데이터를 흘려보내면 더미를 대체할 수 있음 (아직 안 함, 아래 "다음 할 일"
  참고).
- **데이터 전달은 API 엔드포인트 방식.** DB 직접 조회 대신 GET/POST/PATCH/
  DELETE 라우트로 분리해서, 메인 챗 담당자가 인증·권한 몰라도 fetch만 하면
  되게 함.
- **DB는 파일 → Supabase로 전환함.** 처음엔 "지금 당장 필요한 건 아니다"로
  보류했었는데, 나중에 에이전트가 이 데이터를 학습해서 팁을 추천하는 기능을
  만들기로 하면서 실제 DB로 옮김. pgvector로 임베딩 컬럼까지 미리 준비해둔
  것도 이 목적 때문(§데이터베이스, §다음 할 일).

## agent_and_ui와 합칠 때 체크리스트 (금요일 예정)

1. `src/components/ui/Icon.tsx`, `GlassIcon.tsx` — 이 브랜치 파일 삭제,
   `agent_and_ui` 파일 사용. 단, `agent_and_ui`의 `GlassIcon`/`dashboard.css`에
   `lavender` 톤이 없으니 그건 추가해야 함(`VENT` 카테고리용).
2. `src/components/community/community.css` 상단의 `.da-*` 규칙 삭제
   (dashboard.css에 이미 있음). `.cm-*` 규칙만 남기고 dashboard.css에
   합치거나 별도 import. `da-lavender` 톤은 위 1번 항목대로 dashboard.css에
   새로 추가.
3. `vite.config.ts`의 `plugins` 배열에 `createCommunityServerPlugin()` 추가.
4. `App.tsx`는 지금 독립 실행용 임시 셸(`src/App.tsx`)이라 **쓰지 않고
   버림**. 대신 `agent_and_ui`의 실제 `App.tsx`에서 Sidebar의 '경험 나눔'
   메뉴(`activeMenu === '경험 나눔'`)가 활성화됐을 때 `da-main` 자리에
   `<CommunityFeed />`를 렌더링하도록 조건 분기 추가.
5. `POST /api/community/recommend`(`recommendCommunityTips()`)를
   `agent_and_ui`의 `MockCaseTools.searchCommunityReviews()`(지금은 하드코딩된
   더미 1개 반환) 자리에 실제 구현으로 교체. `{ format: 'block' }`로 호출하면
   `toCommunityReviewBlock()`이 결과를 `CaseTools` 인터페이스가 기대하는
   `COMMUNITY_REVIEW` 블록 모양으로 바로 바꿔줌. 동작: `stepId`(기획서 §12
   절차 단계, `PROCEDURE_STEPS`) 또는 자유 텍스트 `situation` + `context`
   (관계·지역·채무초과 여부 등 개인화 신호, 전부 선택)를 받아 임베딩 검색 →
   유사도 0.3 미만 후보는 애초에 버리고(`SIMILARITY_THRESHOLD`) → 남은
   후보를 Solar Pro(LLM)한테 주고 `sourceIndex`(후보 목록 번호)로 근거를
   지목하게 해서 팁 카드(`title`/`summary`/`reason`/`quote`)를 쓰게 함 —
   id·날짜·좋아요 수 같은 사실 값은 전부 코드가 채우고 LLM은 문장만 쓰므로
   메타데이터를 지어낼 수 없는 구조. LLM 호출/파싱이 실패해도 원문 기반
   카드로 폴백해서 응답이 끊기지 않음(`toFallbackTip()`). GET
   `/api/community/steps`로 사용 가능한 단계 목록을 받아갈 수 있음.
6. 이 브랜치의 `package.json`/`tsconfig.json`/`vite.config.ts`는
   `agent_and_ui` 쪽 설정과 병합. 이번에 추가된 의존성(`@supabase/supabase-js`,
   `dotenv`)도 같이 옮겨야 함.
7. **`.env.local`은 merge 대상 저장소에도 새로 만들어야 함** (gitignore라
   git엔 안 실려있음). `.env.local.example` 보고 `SUPABASE_URL`/
   `SUPABASE_SERVICE_ROLE_KEY` 채우기 — 이 브랜치에서 쓰던 Supabase 프로젝트를
   그대로 재사용하면 데이터(65개 글)도 그대로 딸려옴.

## 가드레일

`community-recommend.ts` + `community-prompt.ts` + `prompts/community-recommend.json`
조합으로 구성됨. 팀원이 `role`/`task`/`style`(프롬프트 튜닝 담당)을, 제가
`guardrails` 배열(안전 담당)을 나눠 맡기로 역할을 정함(§"팀원 PR 병합" 참고) —
프롬프트 JSON 파일에 `_guardrails_note`로 이 분담이 명시돼 있음.

- `src/server/pii-guard.ts` — `redactPii()`. 전화번호·주민등록번호·이메일·
  계좌/카드번호를 정규식으로 마스킹함. `community-recommend.ts`에서 **LLM한테
  후보 글을 보여주기 전에**(`postList` 조립 시) 이걸로 먼저 거름(원문 자체를
  못 보게 하는 게 핵심 방어선), LLM이 만든 title/summary/reason/quote에도
  한 번 더 적용해서 이중으로 막고, LLM 실패 시 원문을 그대로 쓰는 폴백 경로
  (`toFallbackTip()`)에도 똑같이 적용함(안 그러면 폴백 경로로 가드레일이
  통째로 우회됨). 날짜(2026-07-30)나 "3개월" 같은 일반 숫자는 안 건드리게
  실제 테스트로 확인함. 실제 PII(전화번호·주민번호·계좌번호·이메일)가 섞인
  테스트 글로 파이프라인 전체를 실행해서 최종 카드에 유출 안 되는 것까지
  검증함(2026-07-31, `npx tsx`로 임시 글 생성 → 추천 실행 → 결과 확인 → 삭제).
  - 정규식 한계: 실명·구체적 주소처럼 패턴이 없는 개인정보는 못 잡음 →
    `prompts/community-recommend.json`의 `guardrails`에 "그런 정보 있어도
    옮기지 마라" 지시를 별도로 추가해서 보완함. 사용자 상황 설명에 특정
    인물의 개인정보를 요청하는 내용이 섞여 있어도 응하지 말라는 지시도
    같이 넣음.
  - 커뮤니티 피드 자체(글 목록, "더 자세히 보기" 원문)는 마스킹 대상이
    아님 — 사용자가 직접 쓴 자기 글을 그대로 보여주는 것뿐이라 의도적으로
    건드리지 않음. 가드레일은 **에이전트가 생성하는 요약/추천에만** 적용.
- `prompts/community-recommend.json`의 `guardrails` 배열 — 역할·범위(상속·
  장례·행정 절차 밖의 요청은 무관한 후보와 억지로 연결짓지 말고 빈 배열
  반환), 프롬프트 인젝션 방지(경험담 속 지시문 무시 + 시스템 프롬프트 유출
  거부), 개인정보 보호, 전문 자문 아님(법률·세무·의료 공식 자문처럼 단정
  금지), 유해 콘텐츠 금지 — 이 순서로 섹션을 나눠서 팀원이 `role`/`task`/
  `style`을 건드릴 때 안전 문구랑 안 섞이게 함. `task` 배열 쪽에 이미 있던
  "한 글에 여러 주제가 섞여 있으면 관련된 부분만 골라 쓰라"는 지시(원래
  팀원이 넣은 것)와 겹치지 않게, 그 부분은 손 안 대고 나머지 다섯 카테고리만
  추가함.
- **역할·범위는 프롬프트만으론 100% 안 지켜져서 코드 레벨 기준선도 같이
  씀.** "파이썬 정렬 알고리즘 짜는 법" 같은 완전히 무관한 질문이 "디지털
  유산 정리" 글과 "디지털"이라는 단어 하나 겹친다는 이유로 LLM한테 관련
  있다고 통과된 사례를 실제로 발견함(2026-07-30, 이때는 제 옛 구현
  `community-agent-tool.ts` 기준). 팀원도 독립적으로 같은 문제("점심 메뉴"
  질문에도 카드가 만들어짐)를 발견해서 `SIMILARITY_THRESHOLD`(0.3, 임베딩
  코사인 유사도)를 후보 필터링 단계에 걸어뒀음 — 이 값 미만인 후보는 애초에
  LLM한테 넘어가지도 않음(`recommendCommunityTips()`). 두 사람이 독립적으로
  같은 결론(코드 레벨 유사도 기준선 필요)에 도달한 부분이라 병합 때 팀원
  구현을 그대로 채택함.
- **LLM 실패 시 폴백은 "관련 있다고 이미 확인된 후보"로만 채움.** 예전
  `community-agent-tool.ts`는 "좋아요순 상위로 대충 채워 넣는" 폴백이 있어서
  무관한 질문에도 카드가 나오는 버그가 있었음(이미 고쳐서 폐기함). 지금
  구조는 애초에 `SIMILARITY_THRESHOLD`를 넘은 후보만 LLM한테 넘기기 때문에,
  LLM 호출/JSON 파싱이 실패해도 그 (이미 관련성 검증된) 후보들을 원문 기반
  카드로 폴백해서 보여주는 것뿐이라 같은 문제가 재발하지 않음.

## 팀원 PR 병합 (2026-07-31)

팀원이 `community-agent-prompt-tuning` 브랜치(PR #2)에서 이 브랜치의 예전
커밋(`1769fc3`, 제 최근 커밋 3개 이전 지점)을 기준으로 **저와 똑같이 커뮤니티
팁 추천 기능을 독립적으로 새로 만들고 있었음** — 서로 몰랐던 병렬 작업.
`gh pr merge`로 바로 못 붙임(`mergeable: CONFLICTING`) — `community-recommend.ts`를
제가 이미 삭제한 상태였고(제 버전 `community-agent-tool.ts`로 대체했었음),
`CommunityComposer`/`CommunityFeed`/`CommunityPostCard`/`community.css`/
`community-store.ts`도 다중 카테고리를 서로 독립적으로 구현해서 충돌.

**의사결정(사용자 승인)**: 팀원 버전을 추천 엔진의 기준으로 채택하고, 제
가드레일을 그 안에 끼워 넣는 방식으로 병합함. 이유:
- 팀원 버전이 `stepId`(기획서 §12 절차 단계) + 구조화된 `context`(채무초과
  여부, 미확인 항목 등)를 받는 더 정교한 입력, `sourceIndex`(후보 배열
  인덱스)로 근거를 지목하게 해서 id 지어내기를 원천 차단하는 더 안전한 출력
  검증, 프롬프트를 JSON으로 빼서 dev 서버 재시작 없이 튜닝 결과를 비교하는
  eval 스크립트까지 갖추고 있었음.
- `prompts/community-recommend.json`에 팀원이 `_guardrails_note: "다른
  팀원이 가드레일을 담당하므로 이 배열은 건드리지 않음"`이라고 이미 자리를
  비워뒀음 — 정확히 이 merge를 위한 구조였음.
- **UI/스토어 쪽(Composer/Feed/PostCard/css/store)은 제 버전을 그대로 유지**
  — 두 구현이 최종 결과는 동일(다중 카테고리 지원)했지만, 제 버전에 삭제
  기능·재임베딩 버그 수정 등이 이미 얹혀 있어서 더 완성된 상태였음.
- 팀원 버전에서만 있던 순수 개선 2개도 같이 가져옴: (1) `community-server-plugin.ts`에
  `withErrorBoundary()` 미들웨어 래퍼 추가 — 원래 GET/helpful/댓글 조회
  라우트에 try/catch가 없어서 Supabase 에러 하나에 dev 서버 프로세스 전체가
  죽는 버그가 있었음(Node 15+의 unhandled rejection 기본 동작), (2)
  `upstage-client.ts`에 Upstage 요청 30초 타임아웃 + `generateSolarChat()`
  temperature 기본값 0.2 추가(근거 기반 요약이라 편차를 줄이려는 것).
- 제 `src/server/community-agent-tool.ts`(구 버전 추천 엔진)와
  `/api/community/agent-test` 라우트는 **폐기**. `AgentTestWidget`은 이제
  실제 라우트 `/api/community/recommend`(`format: 'block'`)를 직접 호출함
  (§"이 브랜치에서 만든 것" 참고).
- 병합 후 `npx tsc --noEmit` 통과, 실제 Supabase+Upstage로 오프토픽/온토픽/
  stepId 케이스 + PII 마스킹까지 전부 재검증함(§가드레일 참고).

## 다음 할 일 (우선순위 순)

1. ~~CLAUDE.md 최신화~~ (완료, 이후로도 계속 갱신 중)
2. **agent_and_ui merge** — 금요일 예정, 위 체크리스트대로.
3. **COMMUNITY_REVIEW 블록에 실제 데이터 연결** — `POST /api/community/recommend`
   (`format: 'block'`)는 이 브랜치에서 이미 준비 완료(실행 검증까지 끝남).
   merge 후 `MockCaseTools.searchCommunityReviews()` 자리에 배선만 하면 됨
   (위 체크리스트 5번).
4. ~~임베딩 차원 수정 + 백필 실행~~ (완료, 65개 글 전부 임베딩 채움 —
   2026-07-30)
5. **`docs/tips_raw.md` 처리 방향 결정** — `tips_tagged.md`는 이번에 커뮤니티
   글로 옮겼지만, `tips_raw.md`(세무사 상담 요약)는 아직 미정. F7 팁 카드로
   갈지, 커뮤니티로 갈지, 출처를 "세무사 상담 요약"으로 명시하는 별도 카드로
   갈지 팀 논의 필요.
6. ~~`VENT`("그냥 이야기") 카테고리에 시드 글 채우기~~ (완료, 4개 — 2026-07-31)

## 실행 확인 관련 참고

`npm install && npm run dev` 정상, `tsc --noEmit` 에러 없음. 브라우저에서
글쓰기·수정·좋아요/취소·내가 쓴 글·댓글+대댓글·카테고리 필터까지 전부 실동작
확인함(Claude Code 로컬 세션에서).

`.claude/launch.json` — Claude Code 프리뷰 도구로 dev 서버를 이름 기반
(`community-dev`)으로 띄우기 위한 설정. 단, `vite.config.ts`나 서버 쪽
코드(`community-store.ts` 등)를 바꾼 뒤에는 **dev 서버 프로세스를 재시작**해야
반영됨 — Vite HMR이 서버 미들웨어 쪽 모듈 캐시까지 갱신해주지는 않음(실제로
겪은 문제, 포트 점유 프로세스를 찾아 종료하고 재시작해야 했음).
