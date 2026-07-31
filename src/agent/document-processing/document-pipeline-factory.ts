import { DocumentPipelineAdapter } from './document-pipeline'
import { DocumentPipelineMode } from './config'
import { PythonDocumentPipelineAdapter } from './python-document-pipeline-adapter'

export type DocumentPipelineConfig = {
  mode: DocumentPipelineMode
  environment: string
  apiKey: string
  pythonCommand?: string
}

export function createDocumentPipeline(config: DocumentPipelineConfig): DocumentPipelineAdapter {
  return new PythonDocumentPipelineAdapter({
    apiKey: config.apiKey,
    pythonCommand: config.pythonCommand,
  })
}
