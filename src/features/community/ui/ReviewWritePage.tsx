import { FormEvent, useMemo, useState } from 'react'
import { GlassIcon } from '../../../components/ui/GlassIcon'
import { Icon } from '../../../components/ui/Icon'
import { COMMUNITY_CATEGORY_TABS } from '../constants/community.constants'
import { CreateReviewInput, ReviewCategory } from '../model/community.types'
import { communityRepository, hasPossiblePrivateInformation } from '../services/community.service'
import { CommunityDisclaimer, navigateCommunity } from './CommunityCommon'

const WRITE_CATEGORY_OPTIONS = COMMUNITY_CATEGORY_TABS.filter((tab) => tab !== '전체') as ReviewCategory[]

const initialForm = { nickname: '', title: '', categories: [WRITE_CATEGORY_OPTIONS[0]], content: '' }

export function ReviewWritePage() {
  const [form,setForm] = useState(initialForm)
  const [privacyConfirmed,setPrivacyConfirmed] = useState(false)
  const privacyWarning = useMemo(() => hasPossiblePrivateInformation(form.content), [form.content])
  const complete = Boolean(form.nickname.trim() && form.title.trim() && form.content.trim() && form.categories.length > 0)
  const toggleCategory = (category: ReviewCategory) => setForm((current) => {
    const has = current.categories.includes(category)
    if (has && current.categories.length === 1) return current
    return { ...current, categories: has ? current.categories.filter((item) => item !== category) : [...current.categories, category] }
  })
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!complete || (privacyWarning && !privacyConfirmed)) return
    const content = form.content.trim()
    const input: CreateReviewInput = {
      categories: form.categories, title: form.title.trim(), authorName: form.nickname.trim(), isAnonymous: true,
      region: null, relation: null, taskType: '', situationTags: [],
      body: { situation: content, difficulty: '', actionTaken: '', preparedDocuments: [], usefulTip: '', caution: '' },
    }
    const created = await communityRepository.createReview(input)
    navigateCommunity(`/community/${created.id}`)
  }
  return <section className="cm-workspace cm-single"><main className="cm-write da-glass">
    <button className="cm-back" onClick={() => navigateCommunity('/community')}><Icon name="arrowLeft" size={18}/>게시판으로</button>
    <header><GlassIcon icon="edit" tone="peach"/><div><span>SHARE YOUR EXPERIENCE</span><h1>경험 나누기</h1><p>누군가에게 도움이 될 수 있도록 경험을 자유롭게 적어보세요.</p></div></header>
    <PrivacyWarning active={privacyWarning}/>
    <form className="cm-write-form" onSubmit={submit}>
      <label className="cm-write-nickname">닉네임<input value={form.nickname} maxLength={20} placeholder="닉네임" onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}/></label>
      <label className="cm-write-title">제목<input value={form.title} maxLength={80} placeholder="제목을 적어주세요" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}/></label>
      <div className="cm-write-categories">
        <span>분류 (여러 개 선택 가능)</span>
        <div className="cm-write-category-options">
          {WRITE_CATEGORY_OPTIONS.map((category) => <button type="button" key={category} className={form.categories.includes(category) ? 'active' : ''} onClick={() => toggleCategory(category)}>{category}</button>)}
        </div>
      </div>
      <label className="cm-write-content">
        <textarea value={form.content} placeholder="어떤 경험을 나누고 싶으신가요? 상황, 어려웠던 점, 도움이 된 방법 등을 자유롭게 적어주세요." onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}/>
      </label>
    </form>
    {privacyWarning && <label className="cm-privacy-check"><input type="checkbox" checked={privacyConfirmed} onChange={(event) => setPrivacyConfirmed(event.target.checked)}/>개인정보로 보이는 내용을 다시 확인했습니다.</label>}
    <div className="cm-write-actions"><button onClick={() => navigateCommunity('/community')}>취소</button><button disabled={!complete || (privacyWarning && !privacyConfirmed)} onClick={(event) => void submit(event)}>경험 게시하기</button></div>
    <CommunityDisclaimer/>
  </main></section>
}

export function PrivacyWarning({ active }: { active: boolean }) {
  return <div className={`cm-privacy-warning ${active ? 'active' : ''}`}><Icon name="shield" size={20}/><div><strong>{active ? '개인정보로 보이는 내용이 포함되어 있어요.' : '개인정보를 입력하지 말아주세요.'}</strong><p>{active ? '게시하기 전에 해당 내용을 확인해주세요.' : '실명, 전화번호, 주민등록번호, 계좌번호, 상세 주소, 사건번호, 금융기관 고객번호는 제외해주세요.'}</p></div></div>
}
