import { CaseState } from '../../schemas/case-state'
import { DocumentPipelineInput } from '../../schemas/document-pipeline'
import { createDocumentPipeline, DocumentPipelineConfig } from '../document-pipeline-factory'
import {
  DocumentPipelineRunResult,
  runDocumentPipeline,
} from '../run-document-pipeline'
import { DocumentPipelineAdapter } from '../document-pipeline'

export type DocumentProcessingToolInput = {
  input: DocumentPipelineInput
  caseState: CaseState
}

export interface DocumentProcessingTool {
  readonly name: 'processDocuments'
  execute(input: DocumentProcessingToolInput): Promise<DocumentPipelineRunResult>
}

/**
 * OCR·추출 파이프라인을 Agent와 분리된 Tool Call 경계로 노출합니다.
 * Agent Harness는 내부 파이프라인 구현을 알지 않고 execute()만 호출합니다.
 */
export function createDocumentProcessingTool(
  config: DocumentPipelineConfig,
  adapter?: DocumentPipelineAdapter,
): DocumentProcessingTool {
  const pipeline = adapter ?? createDocumentPipeline(config)
  return {
    name: 'processDocuments',
    execute({ input, caseState }) {
      return runDocumentPipeline(input, caseState, pipeline)
    },
  }
}
