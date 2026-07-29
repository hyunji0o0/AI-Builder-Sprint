# Agent module

`애도할 시간`의 대화형 Agent와 문서 처리 기능을 한곳에 모은 모듈입니다.

Agent 기능과 실행 순서의 단일 기준은 팀 문서
`애도할_시간_최종_기능_및_사용자_시나리오.md`의 F1~F7입니다.
OCR 구현은 외부 분석 결과를 입력받는 경계 밖의 책임이며, Agent는 문서 확인 이후
`개인별 절차 → 우선 업무 → 부족 서류 → 업무 준비 → 공식 처리 → 완료 확인 → 다음 업무`
순서로 사건 상태를 전진시킵니다.

```text
agent/
├─ client/      브라우저에서 Agent·문서 API를 호출하는 클라이언트
├─ server/      Vite 개발·미리보기 서버의 API와 Upstage adapter
├─ harness/     분류 → 행동 선택 → 도구 실행 → 응답 검증 실행 코어
├─ documents/   문서 검사·분류·추출·1차/2차 검증 pipeline
├─ schemas/     CaseState, AgentOutput, 문서 결과 런타임 Zod 스키마
├─ state/       초기 사건 상태와 상태 저장소
├─ tools/       결정론적 사건·금융·업무 도구
├─ safety/      개인정보 마스킹, 법률 경계, 출력 안전장치
└─ prompts/     팀에서 수정 가능한 버전별 프롬프트 초안
```

의존 방향은 `UI → client → server → harness/documents`입니다. Harness와
문서 pipeline은 React 컴포넌트를 import하지 않으며 테스트에서 독립 실행할
수 있습니다. `vite.config.ts`는 환경변수를 읽고 `server` 플러그인을 등록하는
역할만 담당합니다.
