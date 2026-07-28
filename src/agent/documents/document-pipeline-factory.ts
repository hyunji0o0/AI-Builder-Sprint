import { DocumentPipelineAdapter, LiveDocumentPipelineAdapter, MockDocumentPipelineAdapter } from './document-pipeline'
import { DocumentPipelineMode } from './config'

export type DocumentPipelineConfig = {
  mode: DocumentPipelineMode
  environment: string
  allowMockInProduction: boolean
  apiKey: string
}

export function createDocumentPipeline(config: DocumentPipelineConfig): DocumentPipelineAdapter {
  if (config.environment === 'production' && config.mode === 'mock' && !config.allowMockInProduction) {
    throw new Error('MOCK_DOCUMENT_PIPELINE_BLOCKED_IN_PRODUCTION')
  }
  return config.mode === 'live'
    ? new LiveDocumentPipelineAdapter(config.apiKey)
    : new MockDocumentPipelineAdapter()
}

