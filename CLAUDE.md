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
돌려보거나 타입체크를 못 했음. → **Claude Code(로컬)에서 실행 확인 완료**
(아래 참고). `npm install && npm run dev` 정상, `tsc --noEmit` 에러 없음,
브라우저에서 글쓰기·수정까지 실동작 확인함.

## Claude Code(로컬) 세션에서 이어서 작업한 것

Cowork 인계 이후 로컬 Claude Code 세션에서 추가로 바꾼 부분. **아직 커밋 안
됨** (working tree에 변경 상태로 남아있음 — 새 세션에서 `git status`/`git
diff`로 확인 가능, 파일 자체는 디스크에 그대로 있으니 커밋 여부와 무관하게
보임).

- **글쓰기 UI를 인라인 폼 → 게시판 스타일로 변경.** `CommunityFeed.tsx`에
  `view: 'list' | 'write'` 상태를 두고, 헤더의 "글쓰기" 버튼을 누르면 목록/탭이
  사라지고 `CommunityComposer`가 전체 화면 폼(닉네임 + 카테고리 칩 + 여러 줄
  textarea + 취소/등록 버튼)으로 나타나는 방식. **URL 라우팅(react-router)은
  일부러 안 씀** — merge 대상인 `agent_and_ui`도 라우터가 없는 단일 SPA라서,
  라우팅 라이브러리를 새로 얹으면 merge 때 부담이 커짐. 그래서 클라이언트
  상태 토글만으로 구현.
- **"내가 쓴 글 확인·수정" 기능 추가.** 아직 로그인이 없어서(§"왜 이런
  구조인가" 참고), 소유권 판별은 **이 브라우저의 localStorage**에 작성한 글
  id를 기록해두는 방식으로 스텁 처리함 (`src/client/my-community-posts.ts`).
  내가 쓴 글의 카드에만 수정 아이콘이 뜨고, 누르면 글쓰기 화면이 기존
  내용으로 채워진 채 열림. 나중에 로그인 붙이면 이 판별 로직만 서버 쪽 소유자
  필드 체크로 교체하면 됨 (스키마 변경은 최소화됨 — `updateCommunityPostSchema`
  는 category/content만 받음, nickname은 수정 불가로 고정).
  - 백엔드: `PATCH /api/community/posts/:id` 추가 (`community-server-plugin.ts`,
    `community-store.ts`의 `updateCommunityPost()`)
  - 프론트: `community-api.ts`에 `updateCommunityPost()`, `CommunityPostCard`에
    소유자에게만 보이는 수정 버튼, `CommunityComposer`가 `initialPost` prop으로
    생성/수정 겸용 모드 지원
- **DB 전환은 보류.** "커뮤니티 글을 DB에 넣어야 한다"는 논의가 있었지만,
  지금은 기존 파일 기반 저장(`community-store.ts`)을 그대로 두기로 함. DB
  전환은 라우팅과 무관한 별개 작업이라 나중에 하기로 함.
- **사진 첨부 기능은 요청했다가 바로 취소됨.** 실제로 코드에 반영된 적 없음
  (착수 전 취소).
- **`docs/tips_raw.md` 신규.** 세무사 상담 내용 요약에서 법정 기한 있는
  사실(이미 §12 룰 테이블에 있음)은 빼고, 노하우·주의사항만 자연스러운
  문장으로 뽑아 쌓아둔 원자료. 아직 F7 팁 카드로 갈지 커뮤니티로 갈지
  미정 — 원자료 단계. **주의: 이 내용은 세무사(전문가) 조언이라 팀원 1인칭
  경험담(현재 시드 데이터 톤)과 성격이 다름.** 그대로 커뮤니티 글처럼
  넣으면 "실제 팀원 경험 맞냐"는 심사 질문에 애매해지니, 출처를 "세무사
  상담 요약"으로 명시하는 별도 카드로 갈지 검토 필요.
- **`.claude/launch.json` 신규.** Claude Code 프리뷰 도구로 dev 서버를 이름
  기반(`community-dev`)으로 띄우기 위한 설정. 단, 세션에 따라 이 파일이
  아니라 세션 시작 당시 디렉토리의 launch.json을 참조하는 경우가 있었음 —
  안 되면 `npm run dev` 직접 실행 후 `preview_start`에 `url` 파라미터로 열 것.
