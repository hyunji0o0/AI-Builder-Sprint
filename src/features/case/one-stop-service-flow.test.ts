import { describe, expect, it } from 'vitest'
import {
  createOneStopApplicationGuide,
  createOneStopResultsGuide,
  ONE_STOP_APPLICATION_URL,
} from './one-stop-service-flow'
import { agentUIBlockSchema } from '../../agent/schemas/agent-output'

describe('one-stop service flow', () => {
  it('shows application guidance before asking for result uploads', () => {
    const block = createOneStopApplicationGuide()
    expect(agentUIBlockSchema.parse(block)).toEqual(block)
    expect(block.type).toBe('ONE_STOP_SERVICE_GUIDE')
    if (block.type !== 'ONE_STOP_SERVICE_GUIDE') return

    expect(block.stage).toBe('APPLICATION')
    expect(block.checklist.map((item) => item.label)).toContain('신청인의 신분증')
    expect(block.resources.some((resource) => resource.url === ONE_STOP_APPLICATION_URL)).toBe(true)
    expect(block.actions.map((action) => action.id)).toContain('onboarding_one_stop_application_completed')
    expect(block.actions.map((action) => action.id)).not.toContain('onboarding_one_stop_upload_results')
  })

  it('explains result types and upload steps after application', () => {
    const block = createOneStopResultsGuide()
    expect(agentUIBlockSchema.parse(block)).toEqual(block)
    expect(block.type).toBe('ONE_STOP_SERVICE_GUIDE')
    if (block.type !== 'ONE_STOP_SERVICE_GUIDE') return

    expect(block.stage).toBe('RESULTS')
    expect(block.infoItems.some((item) => item.title.includes('금융'))).toBe(true)
    expect(block.checklist.some((item) => item.label.includes('우리 서비스에 올리기'))).toBe(true)
    expect(block.actions.map((action) => action.id)).toContain('onboarding_one_stop_upload_results')
    expect(block.notice).toContain('먼저 받은 문서부터')
  })
})
