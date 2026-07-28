import { DocumentPipelineFile, ValidationIssue } from '../schemas/document-pipeline'
import { DOCUMENT_LIMITS } from './config'

const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((value, index) => bytes[index] === value)

export type InspectedFile = {
  bytes: Uint8Array
  detectedMimeType: string | null
  encryptedPdf: boolean
  issues: ValidationIssue[]
}

export function inspectFile(file: DocumentPipelineFile): InspectedFile {
  const bytes = decodeBase64(file.bytesBase64)
  const detectedMimeType = startsWith(bytes, [0xff, 0xd8, 0xff]) ? 'image/jpeg'
    : startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? 'image/png'
      : startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' ? 'image/webp'
        : String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-' ? 'application/pdf'
          : null
  const issues: ValidationIssue[] = []
  if (bytes.length > DOCUMENT_LIMITS.maxFileBytes) issues.push(issue('FILE_TOO_LARGE', 'ERROR', file.fileId, '파일 크기가 허용 범위를 넘었어요.', '파일을 나누거나 크기를 줄여 다시 올려주세요.'))
  if (!detectedMimeType) issues.push(issue('UNSUPPORTED_HEADER', 'ERROR', file.fileId, '이 파일에서는 지원되는 이미지나 PDF 형식을 확인하지 못했어요.', 'JPG, PNG, WEBP 또는 PDF로 다시 저장해 주세요.'))
  if (detectedMimeType && detectedMimeType !== file.declaredMimeType) issues.push(issue('MIME_MISMATCH', 'ERROR', file.fileId, '파일 정보와 실제 형식이 서로 달라 확인이 필요해요.', '원본 파일을 다시 저장해 올려주세요.'))
  if (detectedMimeType?.startsWith('image/') && file.width && file.height && (file.width < DOCUMENT_LIMITS.minImageWidth || file.height < DOCUMENT_LIMITS.minImageHeight)) {
    issues.push(issue('LOW_RESOLUTION', 'WARNING', file.fileId, '사진 해상도가 낮아 일부 내용을 충분히 확인하지 못할 수 있어요.', '조금 더 선명한 사진을 올리거나 직접 입력할 수 있어요.'))
  }
  const encryptedPdf = detectedMimeType === 'application/pdf' && new TextDecoder('latin1').decode(bytes).includes('/Encrypt')
  if (encryptedPdf) issues.push(issue('ENCRYPTED_PDF', 'ERROR', file.fileId, '암호화된 PDF는 아직 자동으로 확인할 수 없어요.', '암호를 해제한 사본을 올리거나 직접 입력해 주세요.'))
  return { bytes, detectedMimeType, encryptedPdf, issues }
}

const issue = (code: string, severity: ValidationIssue['severity'], documentId: string, message: string, suggestedAction: string): ValidationIssue => ({
  code, severity, documentId, fieldKey: null, message, suggestedAction,
})

