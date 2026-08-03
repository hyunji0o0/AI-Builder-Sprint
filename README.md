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

## AI 활용 증빙

이 절과 연결된 코드·프롬프트·테스트 결과를 AI 활용 증빙 자료로 제출합니다. 별도의 `CLAUDE.md` 없이도 아래 링크를 통해 모델 사용 위치, Agent 지침, 안전장치와 검증 결과를 저장소에서 바로 확인할 수 있습니다.

### 제출 기준 대응표

| 제출 요구 항목 | README 내 증빙 위치 | 저장소 근거 |
| --- | --- | --- |
| **모델** | 아래 `모델 및 API 사용 위치` | Solar LLM, Document Parse, Information Extract, Embeddings의 역할과 적용 코드 |
| **API 사용 위치** | 아래 `모델 및 API 사용 위치` | Vite 서버 미들웨어, Python 문서 파이프라인, 커뮤니티 추천 서버 코드 |
| **프롬프트/설정** | 아래 `프롬프트 및 실행 설정` | 역할별 프롬프트 파일, 모델 선택 환경변수, 문서 처리 임계값 |
| **테스트·검증 산출물** | 아래 `문서 분석 검증`, `안전성과 품질 검증` | 저장된 파이프라인 JSON 결과와 Vitest 평가 코드·재현 명령 |

### 모델 및 API 사용 위치

| AI/API | 서비스에서 하는 일 | 구현 근거 |
| --- | --- | --- |
| **Upstage Solar LLM** | 사용자 의도·정서 분류, 다음 행동 선택, 도구 결과를 한국어 답변과 UI Block으로 구성 | [`vite-agent-plugin.ts`](src/agent/server/vite-agent-plugin.ts), [`run-agent.ts`](src/agent/orchestrator/run-agent.ts) |
| **Upstage Document Parse** | 업로드한 이미지·PDF의 글자, 표와 문서 구조를 OCR로 추출 | [`document_parser.py`](src/agent/document-processing/python/document_parser.py) |
| **Upstage Information Extract** | 문서 종류에 맞는 스키마로 사망 정보, 기관명, 자산·채무 등 핵심 필드를 구조화 | [`information_extractor.py`](src/agent/document-processing/python/information_extractor.py), [`document_analysis_pipeline.py`](src/agent/document-processing/python/document_analysis_pipeline.py) |
| **Upstage Embeddings** | 커뮤니티 글과 사용자 상황의 의미 유사도를 검색해 현재 절차에 맞는 경험담 후보를 선정 | [`upstage-client.ts`](src/server/upstage-client.ts), [`community-recommend.ts`](src/server/community-recommend.ts) |
| **Solar 기반 재정렬·요약** | 검색 후보 안에서만 추천 이유와 요약을 생성하고, 글 ID·날짜·도움 수는 코드가 원본 데이터에서 채움 | [`community-recommend.ts`](src/server/community-recommend.ts), [`community-recommend.json`](prompts/community-recommend.json) |

Upstage API Key와 모델 설정은 브라우저 코드가 아니라 [`vite.config.ts`](vite.config.ts)에서 서버 플러그인에 주입합니다. 실제 키는 Git에 포함하지 않고 `.env.local`에서만 읽습니다.

### 프롬프트 및 실행 설정

| 구분 | 설정 또는 프롬프트 | 근거 파일 |
| --- | --- | --- |
| 모델 선택 | 기본 응답 모델 `solar-pro3`, 단순 분류 모델 `solar-mini`; `UPSTAGE_MODEL`, `UPSTAGE_SIMPLE_MODEL`로 변경 가능 | [`vite.config.ts`](vite.config.ts), [`.env.local.example`](.env.local.example) |
| Agent 정체성·공통 원칙 | 따뜻한 반말, 한국어 응답, 법률적 결정 금지, 내부 추론 비노출 | [`system.ts`](src/agent/prompts/system.ts) |
| 의도·정서 분류 | 사용자 의도와 정서 신호의 구조화 출력 규칙 | [`classify-intent.ts`](src/agent/prompts/classify-intent.ts) |
| 다음 행동 선택 | 사건 상태와 우선순위를 바탕으로 한 번에 핵심 행동 하나 선택 | [`select-action.ts`](src/agent/prompts/select-action.ts) |
| 응답 구성 | 도구 결과를 사용자 메시지와 UI Block으로 구성 | [`compose-response.ts`](src/agent/prompts/compose-response.ts) |
| 경험담 추천 | 후보 원문 밖의 사실 생성 금지, 추천 이유·요약 생성, PII·인젝션 가드레일 | [`recommend-review.ts`](src/agent/prompts/recommend-review.ts), [`community-recommend.json`](prompts/community-recommend.json) |
| 문서 처리 한계값 | 최대 10개/파일당 10MB, 분류 신뢰도 `0.72`, 필드 신뢰도 `0.8` | [`config.ts`](src/agent/document-processing/config.ts) |

프롬프트는 코드 흐름과 분리되어 있어 역할별로 수정할 수 있고, API Key는 프롬프트나 프론트엔드 번들에 포함하지 않습니다. 제출용 환경변수 이름과 용도는 [`.env.local.example`](.env.local.example)에 값 없이 정리했습니다.

### Agent Harness 실행 구조

- 단일 실행 진입점: [`src/agent/orchestrator/run-agent.ts`](src/agent/orchestrator/run-agent.ts)
- 대화 Agent/사건 Agent 라우팅: [`src/agent/orchestrator/agent-router.ts`](src/agent/orchestrator/agent-router.ts)
- 의도 분류 → 행동 선택 → Tool Call → 응답 구성: [`src/agent/agents/case-workflow/`](src/agent/agents/case-workflow/)
- 일상 대화·정서 응답: [`src/agent/agents/conversation/`](src/agent/agents/conversation/)
- 역할별 수정 가능한 프롬프트 초안: [`src/agent/prompts/`](src/agent/prompts/)
- 커뮤니티 추천 프롬프트와 평가 질의: [`prompts/community-recommend.json`](prompts/community-recommend.json), [`prompts/eval-queries.json`](prompts/eval-queries.json)

LLM이 사건 상태를 직접 임의 변경하지 않도록 Agent가 선택한 행동은 도구 계층을 거칩니다. 금액 합계, 누락 정보, 업무 상태와 기한은 코드가 다시 계산하고 Zod 런타임 스키마로 입력·출력을 검증합니다. 한 요청의 도구 실행 횟수도 제한해 반복 호출과 무한 루프를 방지합니다.

### 문서 분석 검증

문서 파이프라인은 다음 순서로 검증합니다.

```text
원본 파일
  -> Document Parse
  -> 본문 기반 문서·기관 분류
  -> Information Extract
  -> 스키마/날짜/금액 검증
  -> 사용자 확인 또는 수정
  -> 확인된 값만 CaseState에 반영
```

저장된 파이프라인 평가 요약은 [`pipeline_test_summary.json`](tests/results/pipeline/pipeline_test_summary.json), 문서별 세부 추출·검증 결과는 [`tests/results/pipeline/details/`](tests/results/pipeline/details/)에서 확인할 수 있습니다. 기록된 평가에서는 실제 실행된 샘플 14건이 모두 파이프라인 처리, 문서 분류, 기관 분류와 스키마 검증을 통과했습니다. 샘플이 없어 건너뛴 항목은 결과 파일에 `SKIP`과 사유를 함께 남겨 성공률에 포함하지 않았습니다.

### 안전성과 품질 검증

| 검증 항목 | 적용 방식 | 증빙 코드/명령 |
| --- | --- | --- |
| 개인정보 보호 | LLM 입력 전과 출력 후 주민번호·전화번호·이메일·계좌/카드번호 마스킹 | [`privacy-filter.ts`](src/agent/safety/privacy-filter.ts), [`pii-guard.ts`](src/server/pii-guard.ts) |
| 법률 판단 경계 | “상속포기하세요”와 같은 단정적 결론을 차단하고 정보 제공·전문가 확인 안내로 교정 | [`output-guard.ts`](src/agent/safety/output-guard.ts) |
| 프롬프트 인젝션 방어 | 시스템 지침 변경, 내부 프롬프트 공개, 역할 이탈 요청을 코드 수준에서 탐지 | [`adversarial-input-guard.ts`](src/agent/safety/adversarial-input-guard.ts) |
| 서비스 범위 제한 | 실제로 없는 일정 예약·자동 제출 등 기능을 Agent가 약속하지 못하도록 허용 기능 목록 검증 | [`service-capabilities.ts`](src/agent/safety/service-capabilities.ts) |
| 위기 신호 우선 처리 | 즉각적인 위험이 의심되면 일반 행정·커뮤니티 추천보다 안전 경로를 우선 | [`safety-hooks.ts`](src/agent/safety/safety-hooks.ts) |
| 라우팅 평가 | 일상 대화와 사건 처리 요청이 올바른 Agent로 전달되는지 평가 | `npm run routing:evaluate` |
| 가드레일 평가 | 공격성 입력·법률 단정·서비스 범위 이탈 시나리오 평가 | `npm run guardrails:evaluate` |
| 커뮤니티 검색 평가 | 키워드와 의미 검색의 관련성 및 무관한 추천 차단 평가 | `npm run tips:evaluate` |

평가 코드는 각각 [`guardrail-evaluation.test.ts`](src/agent/safety/guardrail-evaluation.test.ts), [`agent-router.evaluation.test.ts`](src/agent/orchestrator/agent-router.evaluation.test.ts), [`community-search-ranking.test.ts`](src/server/community-search-ranking.test.ts)에서 확인할 수 있습니다.

2026-08-03 기준 로컬 재검증 결과는 다음과 같습니다.

| 검증 명령 | 결과 |
| --- | --- |
| `npm run test` | 테스트 파일 **28개**, 테스트 **196개** 통과 |
| `npm run guardrails:evaluate` | 테스트 **1개** 통과 |
| `npm run routing:evaluate` | 테스트 **1개** 통과 |
| `npm run tips:evaluate` | 테스트 **3개** 통과 |

전체 단위·통합 테스트는 `npm run test`, 타입 및 프로덕션 빌드 검증은 `npm run build`, 정적 코드 검사는 `npm run lint`로 재현할 수 있습니다. 위 수치는 저장소의 현재 테스트 코드를 로컬에서 다시 실행해 확인한 결과이며, 외부 API를 사용하는 문서 평가의 상세 산출물은 별도 JSON 파일로 보존합니다.

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
- **npm 10 이상** (Node.js 설치 시 함께 설치됨)
- **Python 3.10 이상**
- Upstage API Key
- Supabase 프로젝트

> 현재 개발 서버는 보안을 위해 `localhost`에만 바인딩됩니다. 같은 네트워크의 다른 기기에서는 접속할 수 없습니다.

### 2. 저장소와 의존성 준비

```bash
git clone https://github.com/hyunji0o0/AI-Builder-Sprint.git
cd AI-Builder-Sprint
npm install
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
npm run dev
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

따라서 **전체 기능 테스트와 데모는 반드시 `npm run dev`로 실행**해야 합니다. `npm run build`로 생성한 `dist/`는 프론트엔드 정적 파일만 포함하므로, 이를 별도로 호스팅해도 `/api/agent`, `/api/documents`, `/api/community/*`는 동작하지 않습니다.

외부 운영 배포는 현재 제출 범위에 포함하지 않습니다. 향후 배포할 때는 Vite middleware를 Node 서버 또는 Serverless Function으로 이전해야 하며, `UPSTAGE_API_KEY`와 `SUPABASE_SERVICE_ROLE_KEY`는 서버 런타임에만 주입해야 합니다.

### 빌드 및 정적 미리보기

```bash
npm run build
npm run preview
```

`npm run preview`는 정적 화면 확인용입니다. Agent·문서 분석·커뮤니티 API까지 검증하려면 `npm run dev`를 사용하세요.

## 검증 명령어

```bash
npm run lint
npm run test
npm run build
```

세부 평가 명령은 다음과 같습니다.

```bash
npm run guardrails:evaluate
npm run routing:evaluate
npm run tips:evaluate
```

## 자주 발생하는 문제

### `Port 5173 is already in use`

기존 개발 서버가 실행 중입니다. 이전 터미널의 Vite 프로세스를 종료한 뒤 `npm run dev`를 다시 실행하세요. 이 프로젝트는 잘못된 서버에 접속하는 일을 막기 위해 `strictPort`를 사용합니다.

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
