import { AgentOutput } from '../schemas/agent-output'
import { CaseState } from '../schemas/case-state'
import { DocumentPipelineResult, DocumentProgress } from '../schemas/document-pipeline'

export type DocumentApiResponse = {
  output: AgentOutput
  caseState: CaseState
  pipelineResult: DocumentPipelineResult
}

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
  reader.onerror = () => reject(new Error('파일을 읽지 못했어요.'))
  reader.readAsDataURL(file)
})

export async function processDocuments(
  files: File[],
  caseState: CaseState,
  onProgress?: (progress: DocumentProgress[]) => void,
): Promise<DocumentApiResponse> {
  if (!files.length || files.length > 10) throw new Error('한 번에 1개부터 10개까지 올릴 수 있어요.')
  const ids = files.map((_, index) => `file-${Date.now()}-${index}`)
  onProgress?.(files.map((file, index) => ({ fileId: ids[index], status: 'UPLOADED', progress: 10, label: `${file.name} 업로드 완료` })))
  const encoded = await Promise.all(files.map(toBase64))
  onProgress?.(files.map((file, index) => ({ fileId: ids[index], status: 'CLASSIFYING', progress: 30, label: `${file.name} 문서 종류 확인 중` })))
  await Promise.resolve()
  onProgress?.(files.map((file, index) => ({ fileId: ids[index], status: 'EXTRACTING', progress: 45, label: `${file.name} 중요 정보 추출 중` })))
  await Promise.resolve()
  onProgress?.(files.map((file, index) => ({ fileId: ids[index], status: 'VALIDATING_PRIMARY', progress: 55, label: `${file.name} 중요 정보를 확인하고 있어요.` })))
  const secondaryTimer = window.setTimeout(() => {
    onProgress?.(files.map((file, index) => ({ fileId: ids[index], status: 'VALIDATING_SECONDARY', progress: 75, label: `${file.name} 다른 서류와 함께 확인 중` })))
  }, 250)
  const response = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: {
        batchId: `batch-${Date.now()}`,
        files: files.map((file, index) => ({
          fileId: ids[index],
          fileName: file.name,
          declaredMimeType: file.type,
          bytesBase64: encoded[index],
        })),
      },
      caseState,
    }),
  })
  window.clearTimeout(secondaryTimer)
  const data = await response.json().catch(() => ({})) as Partial<DocumentApiResponse> & { error?: string }
  if (!response.ok || !data.output || !data.caseState || !data.pipelineResult) throw new Error(data.error || '문서 처리를 완료하지 못했어요.')
  onProgress?.(data.pipelineResult.documents.map((document) => ({
    fileId: document.documentId,
    status: document.status === 'PARSED' ? 'COMPLETED' : document.status === 'FAILED' || document.status === 'UNSUPPORTED' ? 'FAILED' : 'NEEDS_REVIEW',
    progress: 100,
    label: document.status === 'PARSED' ? '분석 완료' : document.status === 'NEEDS_REVIEW' ? '직접 확인 필요' : '분석 실패',
  })))
  return data as DocumentApiResponse
}
