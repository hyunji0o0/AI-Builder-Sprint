# CLAUDE.md — community 브랜치

이 파일은 Claude Code가 이 저장소를 열 때 자동으로 읽는 컨텍스트 파일입니다.
Cowork에서 진행한 커뮤니티(경험 나눔) 기능 작업 배경과 결정 사항을 정리했습니다.

프로젝트 전체 배경(제품 기획, 왜 이 서비스인지, 기능 명세, 일정)은
`docs/기획서.md`, 대회 자체 규정(제출물·심사기준·적격성 게이트·특별상)은
`docs/대회_안내.md`를 먼저 읽어볼 것. 두 문서 모두 이 브랜치에서 처음
정리했고, 다른 브랜치(main/agent_and_ui/document-parser)에는 아직 없음 —
팀 전체가 보게 하려면 별도로 main에도 올리는 게 좋음.

## 브랜치 구조

- `main` — 대회 템플릿 README만 있음. 아직 아무것도 merge 안 됨.
- `agent_and_ui` — 실제 앱(Vite + React + TS). 사이드바·챗·대시보드 전부 여기 있음.
  앱 이름은 `time-to-grieve`. 백엔드가 따로 없고, Vite dev 서버에 미들웨어로
  API를 붙이는 방식(`src/agent/server/vite-agent-plugin.ts`)을 씀. DB 없이
  클라이언트가 매 요청마다 `caseState` 전체를 서버로 보내는 구조.
- `document-parser` — 문서 파싱 실험 코드, 별도.
- `community` (이 브랜치) — 경험 나눔(커뮤니티) 기능. `agent_and_ui`와 **아직
  merge 안 했고, 나중에 합치기로 함**. 그래서 지금은 자체적으로 실행 가능한
  최소 Vite+React+TS 프로젝트로 구성돼 있음(package.json, vite.config.ts 등).

## 이 브랜치에서 만든 것

풀스택 커뮤니티 기능:
- `src/schemas/community.ts` — zod 스키마. 카테고리 6종(`RENOUNCE`, `TAX`,
  `TRANSFER`, `INSURANCE`, `SUBSCRIPTION`, `ETC`)은 원래 기획서의 F2 할일
  카테고리와 맞춤 — 메인 챗(에이전트)이 지금 보고 있는 할일과 관련된 팁을
  필터링해서 가져오기 쉽게 하려는 의도.
- `src/server/community-store.ts` — 파일 기반 저장소.
  `data/community-posts.seed.json`(커밋됨, 팀원이 미리 써둔 시드 글)을
  초기값으로 쓰고, 새 글은 `data/community-posts.runtime.json`(gitignore됨)에
  씀. 나중에 실제 DB로 바꿀 때 이 파일만 교체하면 됨.
- `src/server/community-server-plugin.ts` — `/api/community/posts` GET/POST.
  `agent_and_ui`의 `vite-agent-plugin.ts`와 완전히 같은 패턴(Connect 미들웨어).
- `src/components/community/` — CommunityFeed(카테고리 탭 + 목록 + 글쓰기),
  CommunityPostCard, CommunityComposer.
- `src/components/ui/Icon.tsx`, `GlassIcon.tsx` — **`agent_and_ui`의 동일 파일을
  그대로 복사**해온 것. merge할 때 이 두 파일은 지우고 `agent_and_ui` 쪽을
  쓰면 됨 (완전히 같은 내용이라 충돌 없이 dedupe 가능).
- `src/components/community/community.css` — 위쪽 `.da-*` 규칙은
  `agent_and_ui`의 `src/dashboard.css`에서 그대로 가져온 것(중복, merge 때
  지우면 됨). 아래쪽 `.cm-*` 규칙만 이 브랜치에서 새로 추가한 것.

## 왜 이런 구조인가 (결정 배경)

- **회원가입은 나중에 구현.** 지금은 글쓰기 폼에서 닉네임을 직접 입력받는
  스텁. `CommunityPost.nickname`은 문자열이라, 나중에 로그인 붙이면 로그인
  유저 정보로 바꿔 끼우면 됨 (스키마 변경 없음).
- **카테고리는 필수값.** 메인 챗 쪽 에이전트가 "지금 이 할일과 관련된 팁"을
  골라오려면 태그가 있어야 필터링이 쉬움.
- **시드 데이터는 팀원이 실제로 쓴 글로 채움.** 데모 때 커뮤니티가 텅 비어
  보이는 콜드스타트 문제를 피하려는 것. 지어낸 후기처럼 보이지 않게, 실제
  팀원 계정으로 작성한 글만 시드로 넣기로 함.
- **원본 글 vs 정제된 팁 카드 구분.** 메인 챗의 `AgentBlock.tsx`에는 이미
  `COMMUNITY_REVIEW`라는 블록 타입이 스키마와 렌더링까지 만들어져 있음
  (지금은 하드코딩된 후기 1개짜리 더미). `toCommunityReviewItem()` 함수가
  `CommunityPost`를 그 블록이 기대하는 `{ excerpt, reason, createdAt,
  helpfulCount, url, label }` 형태로 변환해줌 — merge 후 이 어댑터로 실제
  데이터를 흘려보내면 더미를 대체할 수 있음.
- **데이터 전달은 API 엔드포인트 방식.** DB 직접 조회 대신 GET/POST 라우트로
  분리해서, 메인 챗 담당자가 인증·권한 몰라도 fetch만 하면 되게 함.

## agent_and_ui와 합칠 때 체크리스트

1. `src/components/ui/Icon.tsx`, `GlassIcon.tsx` — 이 브랜치 파일 삭제,
   `agent_and_ui` 파일 사용.
2. `src/components/community/community.css` 상단의 `.da-*` 규칙 삭제
   (dashboard.css에 이미 있음). `.cm-*` 규칙만 남기고 dashboard.css에
   합치거나 별도 import.
3. `vite.config.ts`의 `plugins` 배열에 `createCommunityServerPlugin()` 추가.
4. `App.tsx`는 지금 독립 실행용 임시 셸(`src/App.tsx`)이라 **쓰지 않고
   버림**. 대신 `agent_and_ui`의 실제 `App.tsx`에서 Sidebar의 '경험 나눔'
   메뉴(`activeMenu === '경험 나눔'`)가 활성화됐을 때 `da-main` 자리에
   `<CommunityFeed />`를 렌더링하도록 조건 분기 추가.
5. `src/agent/harness/` 쪽에서 `COMMUNITY_REVIEW` 블록을 만들 때
   `listCommunityPosts()` + `toCommunityReviewItem()`으로 실제 데이터를
   쓰도록 연결.
6. 이 브랜치의 `package.json`/`tsconfig.json`/`vite.config.ts`는
   `agent_and_ui` 쪽 설정과 병합(의존성 버전은 이미 맞춰서 씀 — 충돌 적을 것).

## 실행 확인 관련 참고

이 커뮤니티 기능은 Cowork(클라우드 샌드박스)에서 작성됐고, 그 환경은 npm
레지스트리·GitHub 접근이 막혀 있어서 `npm install`/`npm run dev`로 직접
돌려보거나 타입체크를 못 했음. 로컬(또는 Claude Code)에서 먼저
`npm install && npm run dev`로 실행 확인 후 이상 있으면 고칠 것.
