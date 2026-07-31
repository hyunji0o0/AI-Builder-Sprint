import { describe, expect, it } from 'vitest'
import { createInitialCaseState } from '../../state/initial-case'
import { createDocumentProcessingTool } from './document-processing-tool'
import { MockDocumentPipelineAdapter } from '../document-pipeline'

const tinyPng = btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1))

describe('Document processing Tool Call', () => {
  it('Agent와 분리된 processDocuments Tool로 문서를 처리한다', async () => {
    const tool = createDocumentProcessingTool({
      mode: 'python',
      environment: 'test',
      apiKey: '',
    }, new MockDocumentPipelineAdapter())
    const result = await tool.execute({
      input: {
        batchId: 'tool-batch',
        files: [{
          fileId: 'death-doc',
          fileName: 'death-certificate-demo.png',
          declaredMimeType: 'image/png',
          bytesBase64: tinyPng,
        }],
      },
      caseState: createInitialCaseState(),
    })

    expect(tool.name).toBe('processDocuments')
    expect(result.pipelineResult.batchId).toBe('tool-batch')
    expect(result.output.meta.usedTools).toContain('parseDocument')
  })
})
