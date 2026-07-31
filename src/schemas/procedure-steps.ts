import { z } from 'zod'
import stepData from '../../data/procedure-steps.json'
import { CommunityCategory } from './community'

// 단계 정의는 data/procedure-steps.json에 있음(docs/기획서.md §12 기한 룰 테이블).
// JSON으로 뺀 이유: scripts/eval-recommend.mjs가 같은 파일을 읽어서, searchText를
// 튜닝할 때 서버 코드를 건드리지 않고 바로 결과를 비교할 수 있게 하려는 것.
//
// agent_and_ui의 MockCaseTools가 만드는 4개 할일(CONFIRM_DEATH_REPORT 등)과는 축이
// 다름 — 그쪽은 상태 확인용 내부 할일이고, 이건 실제 행정 절차 단계.
export const procedureStepIdSchema = z.enum([
  'DEATH_REPORT',
  'RENOUNCE_OR_LIMITED_ACCEPTANCE',
  'SAFE_INHERITANCE_ONESTOP',
  'INHERITANCE_TAX',
  'PROPERTY_ACQUISITION_TAX',
  'VEHICLE_TRANSFER',
  'INSURANCE_CLAIM',
  'SURVIVOR_PENSION',
])
export type ProcedureStepId = z.infer<typeof procedureStepIdSchema>

export type ProcedureStep = {
  label: string
  deadline: string
  baseDate: string
  legalBasis: string
  /** 이 단계와 관련이 깊은 커뮤니티 카테고리. 하드 필터가 아니라 참고용. */
  categories: CommunityCategory[]
  /** 임베딩 검색에 쓰는 자연어 문장. */
  searchText: string
}

export const PROCEDURE_STEPS = stepData.steps as Record<ProcedureStepId, ProcedureStep>
export const PROCEDURE_STEP_IDS = procedureStepIdSchema.options
