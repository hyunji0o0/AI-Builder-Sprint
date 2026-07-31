import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(process.cwd(), 'fixtures', 'documents', 'generated')
await mkdir(root, { recursive: true })

const cases = [
  ['death-certificate-demo.svg', '사망일 확인 문서', '사망일 2026-07-07'],
  ['deposit-balance-demo.svg', '자산 확인 문서', '잔액 17,000,000원'],
  ['loan-balance-demo.svg', '채무 확인 문서', '대출 잔액 84,000,000원'],
  ['card-debt-demo.svg', '카드 채무 확인 문서', '카드 이용대금 3,000,000원'],
]

for (const [fileName, title, value] of cases) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
  <rect width="100%" height="100%" fill="#fff8f0"/>
  <text x="80" y="120" font-size="44" fill="#24324a">${title}</text>
  <text x="80" y="230" font-size="34" fill="#24324a">${value}</text>
  <text x="80" y="650" font-size="30" fill="#b45f45">AI BUILDER SPRINT 테스트용 가상 문서</text>
  <text x="80" y="710" font-size="30" fill="#b45f45">실제 기관에서 발급한 문서가 아닙니다</text>
</svg>`
  await writeFile(join(root, fileName), svg, 'utf8')
}

console.log(`Generated ${cases.length} safe demo documents in ${root}`)
