/** 외부 OCR 결과를 검증하는 문서 처리 한계값입니다. */
export const DOCUMENT_LIMITS = {
  maxFilesPerBatch: 10,
  maxFileBytes: 10 * 1024 * 1024,
  minImageWidth: 640,
  minImageHeight: 480,
  classificationThreshold: 0.72,
  fieldConfidenceThreshold: 0.8,
} as const

export type DocumentPipelineMode = 'mock' | 'live'
