# Agent module

`애도할 시간`의 대화형 Agent를 책임 단계별로 분리한 모듈입니다.

Agent 기능과 실행 순서의 단일 기준은 팀 문서
`애도할_시간_최종_기능_및_사용자_시나리오.md`의 F1~F7입니다.
OCR 구현은 외부 분석 결과를 입력받는 경계 밖의 책임이며, Agent는 문서 확인 이후
`개인별 절차 → 우선 업무 → 부족 서류 → 업무 준비 → 공식 처리 → 완료 확인 → 다음 업무`
순서로 사건 상태를 전진시킵니다.

```text
agent/
├─ client/      브라우저에서 Agent·문서 API를 호출하는 클라이언트
├─ server/      Vite 개발·미리보기 서버의 API와 Upstage adapter
├─ orchestrator/
│               conversation-agent와 case-workflow-agent 중 하나만 선택
├─ agents/
│  ├─ conversation/
│  │            일상대화·일반 질문 전용 독립 Harness
│  └─ case-workflow/
│               기본정보 수집과 문서 결과 후처리 전용 독립 Harness
├─ document-processing/
│               OCR 결과 수신, 문서 검사·분류·추출·검증 구현
├─ tools/
│  ├─ document-processing-tool.ts
│  │            문서 파이프라인을 processDocuments Tool Call로 노출
│  └─ case-tools.ts
│               사건 상태·금융·업무 관련 결정론적 도구
├─ shared/      두 Agent가 공유할 수 있는 타입 계약과 LLM 경계
├─ schemas/     CaseState, AgentOutput, 문서 결과 런타임 Zod 스키마
├─ state/       초기 사건 상태와 상태 저장소
├─ tools/       결정론적 사건·금융·업무 도구
├─ safety/      개인정보 마스킹, 법률 경계, 출력 안전장치
└─ prompts/     팀에서 수정 가능한 버전별 프롬프트 초안
```

의존 방향은 다음과 같습니다.

```text
UI → client → server → orchestrator/runAgent
                           ├─ agents/conversation/runConversationAgent
                           └─ agents/case-workflow/runCaseWorkflowAgent

문서 업로드 API → tools/processDocuments.execute()
                     └─ document-processing pipeline
```

두 Agent Harness는 서로를 import하지 않습니다.

- `conversation-agent`는 CaseTools, 문서 파이프라인, 업무 후처리 코드를 호출하지
  않으며 사건 상태를 변경하지 않습니다.
- `case-workflow-agent`는 conversation의 prompt·responder를 import하지 않습니다.
- `orchestrator`만 요청을 분류하여 두 Agent 중 하나를 호출합니다.
- 문서 처리는 Agent Harness 내부 함수가 아니라 `DocumentProcessingTool.execute()`
  경계를 통해 호출합니다.
- 공통 사용이 허용되는 것은 `schemas`, `shared` 계약, 개인정보·안전 인터페이스뿐입니다.
