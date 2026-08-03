# 애도할 시간

> AI가 복잡한 사후 행정과 서류 정리를 맡아, 가족을 잃은 사람이 애도할 시간을 되찾도록 돕는 서비스입니다.

가족을 잃은 사용자가 무엇부터 물어봐야 할지 몰라도 괜찮도록, 업로드한 문서를 읽고 현재 사건 상태를 기억하며 다음 할 일을 한 단계씩 안내합니다. 계산과 상태 검증은 결정론적인 코드가 담당하고, Solar 기반 Agent는 문서 이해·의도 분류·설명 생성에 집중합니다.

본 서비스는 법률 정보를 이해하기 쉽게 정리하는 보조 도구이며 법률 자문이나 사용자를 대신한 법적 결정을 제공하지 않습니다.

> **실행 기준**: 현재 제출본은 외부 배포 없이 `localhost`에서 실행하는 로컬 데모를 기준으로 합니다. 프론트엔드, Agent API, 문서 분석 API, 커뮤니티 API가 하나의 Vite 개발 서버에서 함께 동작합니다.

## 핵심 기능

- **Agent 기반 사후 절차 안내**: 사망신고, 안심상속 원스톱, 자산·채무 확인, 전문가 상담 준비를 사건 상태에 맞춰 진행합니다.
- **문서 자동 분류·추출**: Upstage Document Parse와 Information Extract로 이미지·PDF의 종류와 핵심 필드를 추출합니다.
- **사용자 2중 확인**: AI가 추출한 값을 사람이 확인하거나 수정한 뒤에만 사건 상태와 금액 합계에 반영합니다.
- **자산·채무 요약**: 확인된 값과 미확인 값을 구분하고, 법적 결론 대신 검토가 필요한 위험 신호와 다음 행동을 안내합니다.
- **근거 기반 법률 안내**: 저장소에 검증해 둔 법령 데이터와 출처를 바탕으로 기한과 절차를 설명합니다.
- **경험 나눔 커뮤니티**: 비슷한 상황의 경험담을 검색하고 Agent가 현재 단계에 맞는 팁 카드로 추천합니다.
- **안전장치**: 개인정보 마스킹, 법률적 단정 차단, 위기 신호 감지, Agent 경계 및 라우팅 검증을 적용합니다.

## AI 활용 구조

```text
사용자 입력
  -> Agent Router
     |- Conversation Agent: 인사·감정·일반 질문·용어 설명
     `- Case Workflow Agent: 사건 상태 변경·문서·기한·업무 처리
          -> Document Tool: Document Parse -> 분류 -> Information Extract -> 사용자 확인
          -> Case Tools: 합계·누락·기한·우선순위 계산
  -> 구조화된 메시지 + UI Block + 갱신된 대시보드 상태
```

핵심 원칙은 **“판단과 계산은 코드가, 읽기와 설명은 AI가”**입니다. Agent는 한 요청에서 필요한 행동과 도구를 선택하지만, 금액 합계·상태 전이·기한 검증은 일반 코드가 수행합니다.

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| Frontend | Vite 6, React 18, TypeScript 5 |
| Agent | Solar LLM, 구조화 출력, Tool Call 기반 자체 Harness |
| Document AI | Upstage Document Parse, Information Extract, Python adapter |
| Data/Auth | Supabase Postgres, pgvector, Google OAuth |
| Validation/Test | Zod, Vitest, ESLint |

## 프로젝트 구조

```text
src/
  agent/                    Agent 라우팅·상태·도구·문서 처리·안전장치
    agents/conversation/    일상 대화와 일반 질문 Agent
    agents/case-workflow/   사건 처리 Agent
    document-processing/    Python 문서 파이프라인과 Node adapter
    orchestrator/           단일 Agent 진입점과 라우터
    server/                 /api/agent, /api/documents Vite middleware
  features/community/       경험 나눔 화면
  server/                   커뮤니티 API·추천·Supabase 저장소·PII guard
  schemas/                  공유 런타임 스키마
prompts/                    Agent·추천 프롬프트
supabase/                   DB 스키마와 마이그레이션
docs/                       기획·대회·AI 활용 문서
```

## 로컬 기동 실행 가이드

### 1. 사전 준비

- **Node.js 20 LTS 이상**
- **pnpm 10 이상**
- **Python 3.10 이상**
- Upstage API Key
- Supabase 프로젝트

> 현재 개발 서버는 보안을 위해 `localhost`에만 바인딩됩니다. 같은 네트워크의 다른 기기에서는 접속할 수 없습니다.

### 2. 저장소와 의존성 준비

```bash
git clone https://github.com/hyunji0o0/AI-Builder-Sprint.git
cd AI-Builder-Sprint
pnpm install
```

Python 문서 파이프라인 의존성을 설치합니다.

```bash
python -m pip install -r requirements.txt
```

Windows에서 `python` 명령을 찾지 못하면 다음 명령을 사용할 수 있습니다.

```powershell
py -m pip install -r requirements.txt
```

### 3. Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 [`supabase/schema.sql`](supabase/schema.sql)을 실행합니다.
3. 기존 DB의 임베딩 컬럼이 1536차원이라면 [`supabase/migration_fix_embedding_dim.sql`](supabase/migration_fix_embedding_dim.sql)을 실행해 4096차원으로 맞춥니다.
4. Authentication > Providers에서 Google 로그인을 활성화합니다.
5. Authentication의 Site URL과 허용 Redirect URL에 `http://localhost:5173`을 등록합니다.
6. Project Settings > API에서 Project URL, `anon` key, `service_role` key를 확인합니다.

### 4. 환경변수 설정

예시 파일을 복사합니다.

```powershell
Copy-Item .env.local.example .env.local
```

macOS/Linux에서는 다음 명령을 사용합니다.

```bash
cp .env.local.example .env.local
```

생성한 `.env.local`에 실제 값을 입력합니다. 상세 항목은 아래 [환경변수 정보](#환경변수-정보)를 참고하세요.

### 5. 개발 서버 실행

```bash
pnpm dev
```

브라우저에서 [http://localhost:5173](http://localhost:5173)을 엽니다. 개발 서버에는 프론트엔드와 다음 API middleware가 함께 실행됩니다.

- `POST /api/agent`: Agent 실행
- `POST /api/documents`: 문서 분석
- `/api/community/*`: 게시글·댓글·추천

`.env.local`, `vite.config.ts`, `src/server/*`, `src/agent/server/*` 또는 Agent 서버 코드를 수정했다면 Vite 개발 서버를 완전히 종료한 뒤 다시 실행해야 합니다.

## 환경변수 정보

환경변수는 프로젝트 루트의 `.env.local`에만 저장합니다. `.env.local`은 Git에서 제외되어 있으며 실제 키를 README, 예시 파일, 이슈 또는 커밋에 기록하면 안 됩니다.

| 변수 | 필수 | 노출 범위 | 설명 |
| --- | --- | --- | --- |
| `UPSTAGE_API_KEY` | 필수 | 서버 전용 | Solar, Document Parse, Information Extract, 임베딩 호출에 사용하는 Upstage API Key |
| `UPSTAGE_MODEL` | 선택 | 서버 전용 | 주 Agent 모델. 기본값은 `solar-pro3` |
| `UPSTAGE_SIMPLE_MODEL` | 선택 | 서버 전용 | 분류 등 단순 작업용 모델. 기본값은 `solar-mini` |
| `SUPABASE_URL` | 필수 | 서버 전용 | 커뮤니티 저장소에서 사용하는 Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 필수 | **서버 비밀값** | 커뮤니티 서버가 DB에 접근할 때 사용. RLS를 우회하므로 절대 브라우저나 Git에 노출하지 않음 |
| `VITE_SUPABASE_URL` | 필수 | 브라우저 공개 | 로그인 클라이언트에서 사용하는 Supabase Project URL. 보통 `SUPABASE_URL`과 같은 값 |
| `VITE_SUPABASE_ANON_KEY` | 필수 | 브라우저 공개 | Google 로그인에 사용하는 Supabase `anon` key. `service_role` key와 혼동 금지 |
| `PYTHON_COMMAND` | 선택 | 서버 전용 | Python 자동 탐색이 실패할 때 사용할 실행 파일 경로. 예: `C:\\Python311\\python.exe` |

최소 설정 예시는 다음과 같습니다.

```env
UPSTAGE_API_KEY=up_xxxxxxxxxxxxxxxxxxxx
UPSTAGE_MODEL=solar-pro3
UPSTAGE_SIMPLE_MODEL=solar-mini

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Python 자동 탐색이 실패할 때만 사용
# PYTHON_COMMAND=C:\\path\\to\\python.exe
```

> `VITE_` 접두사가 붙은 값은 빌드 시 브라우저 코드에 포함됩니다. 비밀키에는 절대 `VITE_` 접두사를 사용하지 마세요.

## 실행/배포 환경 정보

이 프로젝트의 실행 및 데모 환경은 **로컬 PC**입니다. 별도의 운영 서버나 공개 배포 URL은 사용하지 않습니다.

| 구분 | 주소/산출물 | 용도 | 전체 기능 사용 여부 |
| --- | --- | --- | --- |
| **로컬 통합 서버** | `http://localhost:5173` | 실제 데모. 프론트엔드 + Agent/문서/커뮤니티 API 통합 실행 | **가능** |
| 로컬 정적 미리보기 | `http://localhost:4173` | 빌드된 프론트엔드 화면만 확인 | 불가 |
| 로컬 빌드 산출물 | `dist/` | 타입 검사 및 정적 프론트엔드 빌드 결과 | 불가 |

현재 API는 별도 백엔드가 아니라 `vite.config.ts`의 Vite 개발 서버 plugin으로 제공됩니다. 로컬 통합 서버를 실행하면 다음 구성요소가 한 프로세스 안에서 연결됩니다.

- 브라우저: React UI와 Supabase Google 로그인
- Node.js/Vite: Agent·문서·커뮤니티 API middleware
- Python subprocess: Upstage 문서 분석 파이프라인
- 외부 관리형 서비스: Upstage API, Supabase DB/Auth

따라서 **전체 기능 테스트와 데모는 반드시 `pnpm dev`로 실행**해야 합니다. `pnpm build`로 생성한 `dist/`는 프론트엔드 정적 파일만 포함하므로, 이를 별도로 호스팅해도 `/api/agent`, `/api/documents`, `/api/community/*`는 동작하지 않습니다.

외부 운영 배포는 현재 제출 범위에 포함하지 않습니다. 향후 배포할 때는 Vite middleware를 Node 서버 또는 Serverless Function으로 이전해야 하며, `UPSTAGE_API_KEY`와 `SUPABASE_SERVICE_ROLE_KEY`는 서버 런타임에만 주입해야 합니다.

### 빌드 및 정적 미리보기

```bash
pnpm build
pnpm preview
```

`pnpm preview`는 정적 화면 확인용입니다. Agent·문서 분석·커뮤니티 API까지 검증하려면 `pnpm dev`를 사용하세요.

## 검증 명령어

```bash
pnpm lint
pnpm test
pnpm build
```

세부 평가 명령은 다음과 같습니다.

```bash
pnpm guardrails:evaluate
pnpm routing:evaluate
pnpm tips:evaluate
```

## 자주 발생하는 문제

### `Port 5173 is already in use`

기존 개발 서버가 실행 중입니다. 이전 터미널의 Vite 프로세스를 종료한 뒤 `pnpm dev`를 다시 실행하세요. 이 프로젝트는 잘못된 서버에 접속하는 일을 막기 위해 `strictPort`를 사용합니다.

### `UPSTAGE_API_KEY` 또는 Supabase 환경변수 오류

`.env.local`의 변수명이 정확한지 확인하고 개발 서버를 재시작하세요. 키 앞뒤의 따옴표나 불필요한 공백도 제거합니다.

### 문서 분석이 오래 걸리거나 실패함

`python --version`과 `python -m pip install -r requirements.txt` 실행 여부를 확인하세요. Python 자동 탐색이 실패하면 `PYTHON_COMMAND`에 Python 실행 파일의 절대 경로를 지정합니다.

## 보안 주의사항

- 실제 주민등록번호, 계좌번호, 사건번호가 포함된 문서를 공개 데모에 사용하지 않습니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 관리자 권한이므로 노출이 의심되면 즉시 폐기하고 재발급합니다.
- API Key를 과거 커밋에 올렸다면 파일에서 지우는 것만으로 해결되지 않습니다. 반드시 제공자 콘솔에서 키를 재발급해야 합니다.
- Agent가 제공하는 상속 관련 안내는 정보 제공이며, 최종 법률 판단과 접수는 공식 기관 또는 전문가에게 확인합니다.

## 대회 정보

AI BUILDER SPRINT 2026의 주제인 **“AI를 통해 인간다움을 더욱 잘 드러낼 수 있는 서비스”**에 맞춰 개발했습니다. AI가 사람인 척 위로하는 대신, 사람이 감당하기 어려운 행정·서류·기한 정리를 맡아 가족과 애도에 쓸 시간을 돌려주는 것이 이 프로젝트의 인간다움입니다.

- 주최: 부산대학교 APPTIVE
- 후원: Upstage, 부산대학교 Anchor 사업단, 부산대학교 AI융합교육원, MODUSIGN
- 상세 기획: [`docs/기획서.md`](docs/기획서.md)
- 대회 규정: [`docs/대회_안내.md`](docs/대회_안내.md)
