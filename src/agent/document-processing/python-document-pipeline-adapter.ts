import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import {
  DocumentPipelineInput,
  DocumentPipelineResult,
  DocumentType,
  PipelineExtractedField,
  ProcessedDocument,
  documentPipelineInputSchema,
  documentPipelineResultSchema,
} from '../schemas/document-pipeline'
import { inspectFile } from './file-inspector'
import { DocumentPipelineAdapter } from './document-pipeline'
import { DocumentVerifier, MockDocumentVerifier } from './document-verifier'
import { validateExtractedFields } from './primary-validator'

type PythonPipelineResult = {
  success?: boolean
  documentType?: string
  resultCategory?: string
  classification?: {
    confidence?: number
    needsConfirmation?: boolean
  }
  data?: Record<string, unknown>
  warnings?: unknown[]
  error?: {
    code?: string
    message?: string
  }
}

export type PythonDocumentPipelineAdapterConfig = {
  apiKey: string
  pythonCommand?: string
  projectRoot?: string
}

export const resolvePythonCommand = (configured?: string): string => {
  if (configured?.trim()) return configured.trim()
  if (process.platform !== 'win32') return 'python3'

  const localAppData = process.env.LOCALAPPDATA
  if (localAppData) {
    const pythonRoot = join(localAppData, 'Programs', 'Python')
    if (existsSync(pythonRoot)) {
      const candidates = readdirSync(pythonRoot)
        .filter((name) => /^Python\d+$/i.test(name))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .map((name) => join(pythonRoot, name, 'python.exe'))
      const installedCandidates = candidates.filter(existsSync)
      const installed = installedCandidates.find((candidate) =>
        spawnSync(candidate, ['-c', 'import requests, dotenv'], {
          stdio: 'ignore',
          windowsHide: true,
        }).status === 0)
        ?? installedCandidates[0]
      if (installed) return installed
    }
  }
  return 'python'
}

const typeMap: Record<string, DocumentType> = {
  death_certificate: 'DEATH_CERTIFICATE',
  death_report: 'DEATH_REPORT',
  financial_inquiry_result: 'FINANCIAL_DOCUMENT',
}

const labelMap: Record<string, string> = {
  requestNumber: '접수번호',
  inquiryStatus: '조회 상태',
  hasRecords: '조회 내역 존재 여부',
  recordCount: '조회 내역 수',
  message: '조회 결과',
  documentType: '문서 종류',
  deceasedName: '사망자 이름',
  deathDate: '사망일',
  deathDateTime: '사망 일시',
  reportDate: '신고일',
  institution: '금융기관',
  organizationName: '기관명',
  amount: '금액',
  balance: '잔액',
  referenceDate: '기준일',
  institutionName: '금융기관',
  recordType: '금융 내역 종류',
  branchName: '지점',
  repaymentDate: '상환일',
  recordStatus: '확인 상태',
  statusMessage: '상태 안내',
  hasFinancialRecords: '금융 거래 내역 존재 여부',
  depositAccountCount: '수신예금 건수',
  closedDepositCount: '수신해지 건수',
  loanCount: '대출 건수',
  loanAmount: '대출 금액',
  paymentCount: '출자금 건수',
  guaranteeCount: '보증 건수',
  guaranteeAmount: '보증 금액',
}

const sensitiveKey = /(resident|phone|email|address|domicile|account|customer|balanceNumber|contactNumber|사건번호)/i

const toPrimitive = (value: unknown): string | number | null => {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? '예' : '아니요'
  return JSON.stringify(value) ?? null
}

const toFields = (
  data: Record<string, unknown>,
  confidence: number,
): PipelineExtractedField[] => {
  const topLevelFields = Object.entries(data)
    .filter(([key, value]) => !['documentType', 'records', 'warnings', 'notice', 'isMockSample'].includes(key) && value !== '' && value !== null && !sensitiveKey.test(key))
    .map(([key, value]): [string, string, unknown] => [key, labelMap[key] ?? key, value])
  const records = Array.isArray(data.records) ? data.records : []
  const recordFields = records.flatMap((record, index): Array<[string, string, unknown]> => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return []
    const values = record as Record<string, unknown>
    const institution = typeof values.institutionName === 'string' ? values.institutionName : `${index + 1}번 내역`
    return Object.entries(values)
      .filter(([key, value]) => !sensitiveKey.test(key) && value !== '' && value !== null)
      .map(([key, value]) => [`records.${index}.${key}`, `${institution} · ${labelMap[key] ?? key}`, value])
  })
  return [...topLevelFields, ...recordFields]
    .map(([key, label, value]) => ({
      key,
      label,
      value: toPrimitive(value),
      normalizedValue: toPrimitive(value),
      source: { page: null, textSnippet: null, boundingBox: null },
      confidence,
      verificationStatus: 'UNVERIFIED' as const,
    }))
}

const parseJsonOutput = (stdout: string): PythonPipelineResult => {
  const trimmed = stdout.trim()
  if (!trimmed) throw new Error('EMPTY_DOCUMENT_PIPELINE_RESPONSE')
  return JSON.parse(trimmed) as PythonPipelineResult
}

const runPythonPipeline = (
  command: string,
  scriptPath: string,
  filePath: string,
  apiKey: string,
  timeoutMs = 90_000,
): Promise<PythonPipelineResult> =>
  new Promise((resolveResult, reject) => {
    let settled = false
    const child = spawn(command, [scriptPath, filePath, '--allow-confirmation'], {
      cwd: resolve(scriptPath, '..'),
      env: {
        ...process.env,
        UPSTAGE_API_KEY: apiKey,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
      windowsHide: true,
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      reject(new Error('DOCUMENT_PIPELINE_TIMEOUT'))
    }, timeoutMs)
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      try {
        resolveResult(parseJsonOutput(Buffer.concat(stdout).toString('utf8')))
      } catch {
        const detail = Buffer.concat(stderr).toString('utf8').trim()
        reject(new Error(detail ? 'INVALID_DOCUMENT_PIPELINE_RESPONSE' : 'DOCUMENT_PIPELINE_FAILED'))
      }
    })
  })

export class PythonDocumentPipelineAdapter implements DocumentPipelineAdapter {
  private readonly apiKey: string
  private readonly pythonCommand: string
  private readonly projectRoot: string
  private readonly verifier: DocumentVerifier

  constructor(config: PythonDocumentPipelineAdapterConfig, verifier: DocumentVerifier = new MockDocumentVerifier()) {
    this.apiKey = config.apiKey
    this.pythonCommand = resolvePythonCommand(config.pythonCommand)
    this.projectRoot = config.projectRoot || process.cwd()
    this.verifier = verifier
  }

  async parse(rawInput: DocumentPipelineInput): Promise<DocumentPipelineResult> {
    const input = documentPipelineInputSchema.parse(rawInput)
    if (!this.apiKey) throw new Error('UPSTAGE_API_KEY_REQUIRED')

    const workingDirectory = await mkdtemp(join(tmpdir(), 'aedohal-documents-'))
    try {
      const documents: ProcessedDocument[] = []
      for (const file of input.files) {
        const inspection = inspectFile(file)
        if (!inspection.detectedMimeType || inspection.encryptedPdf) {
          documents.push(validateExtractedFields({
            documentId: file.fileId,
            fileName: file.fileName,
            mimeType: file.declaredMimeType,
            inputForm: inspection.detectedMimeType === 'application/pdf' ? 'PDF' : 'PHOTO',
            documentType: 'UNKNOWN',
            classificationConfidence: 0,
            alternativeTypes: [],
            status: inspection.detectedMimeType ? 'FAILED' : 'UNSUPPORTED',
            extractedFields: [],
            validationIssues: inspection.issues,
          }))
          continue
        }

        const extension = extname(file.fileName) || (inspection.detectedMimeType === 'application/pdf' ? '.pdf' : '.png')
        const temporaryPath = join(workingDirectory, `${file.fileId.replace(/[^a-zA-Z0-9_-]/g, '_')}${extension}`)
        await writeFile(temporaryPath, inspection.bytes)
        const parsed = await runPythonPipeline(
          this.pythonCommand,
          join(this.projectRoot, 'document_analysis_pipeline.py'),
          temporaryPath,
          this.apiKey,
        )
        const confidence = Math.max(0, Math.min(1, parsed.classification?.confidence ?? 0))
        const documentType = typeMap[parsed.documentType ?? ''] ?? 'UNKNOWN'
        const succeeded = parsed.success === true
        const needsReview = parsed.classification?.needsConfirmation === true || documentType === 'UNKNOWN'
        const validationIssues = [...inspection.issues]
        if (!succeeded) {
          validationIssues.push({
            code: parsed.error?.code || 'DOCUMENT_ANALYSIS_FAILED',
            severity: 'ERROR',
            documentId: file.fileId,
            fieldKey: null,
            message: parsed.error?.message || '문서 분석을 완료하지 못했어요.',
            suggestedAction: '파일을 다시 올리거나 직접 입력해 주세요.',
          })
        }
        if (needsReview) {
          validationIssues.push({
            code: 'DOCUMENT_TYPE_REVIEW_REQUIRED',
            severity: 'WARNING',
            documentId: file.fileId,
            fieldKey: null,
            message: '문서 종류를 직접 확인해야 해요.',
            suggestedAction: '표시된 문서 종류가 맞는지 확인해 주세요.',
          })
        }
        documents.push(validateExtractedFields({
          documentId: file.fileId,
          fileName: file.fileName,
          mimeType: inspection.detectedMimeType,
          inputForm: inspection.detectedMimeType === 'application/pdf' ? 'PDF' : 'PHOTO',
          documentType,
          classificationConfidence: confidence,
          alternativeTypes: [],
          status: !succeeded ? 'FAILED' : needsReview ? 'NEEDS_REVIEW' : 'PARSED',
          extractedFields: succeeded ? toFields(parsed.data ?? {}, confidence) : [],
          validationIssues,
        }))
      }

      const verified = await this.verifier.verify(documents)
      const requiresUserConfirmation = verified.documents.some((document) =>
        document.status !== 'PARSED' || document.extractedFields.some((field) => field.verificationStatus !== 'AUTO_VERIFIED'))
        || verified.issues.some((issue) => issue.severity === 'BLOCKING')
      return documentPipelineResultSchema.parse({
        batchId: input.batchId,
        documents: verified.documents,
        batchIssues: [],
        crossDocumentIssues: verified.issues,
        requiresUserConfirmation,
        explanation: verified.documents.some((document) => document.status === 'FAILED')
          ? '일부 문서는 분석을 마치지 못했어. 다시 올리거나 직접 입력할 수 있어.'
          : verified.issues.some((issue) => issue.severity === 'BLOCKING')
            ? '서류 사이에 서로 다른 내용이 있어. 원문을 보면서 먼저 확인해줘.'
            : `올려준 서류 ${verified.documents.length}개의 분석을 마쳤어. 추출된 내용이 맞는지 확인해줘.`,
      })
    } finally {
      const resolvedWorkingDirectory = resolve(workingDirectory)
      if (resolvedWorkingDirectory.startsWith(resolve(tmpdir()))) {
        await rm(resolvedWorkingDirectory, { recursive: true, force: true })
      }
    }
  }
}
