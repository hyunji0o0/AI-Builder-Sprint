import { DocumentPipelineAdapter } from '../documents/document-pipeline'
import {
  DocumentPipelineInput,
  DocumentPipelineResult,
  documentPipelineResultSchema,
} from '../schemas/document-pipeline'

/**
 * OCR 담당 API 대신 이미 생성된 분석 결과를 Agent 흐름에 주입하는 테스트용 어댑터입니다.
 */
export class StaticDocumentAnalysisAdapter implements DocumentPipelineAdapter {
  constructor(private readonly result: DocumentPipelineResult) {}

  async parse(input: DocumentPipelineInput): Promise<DocumentPipelineResult> {
    return documentPipelineResultSchema.parse({
      ...this.result,
      batchId: input.batchId,
    })
  }
}
