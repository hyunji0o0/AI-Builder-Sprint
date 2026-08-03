import { FormEvent, useMemo, useState } from 'react'
import { GlassIcon } from '../../../components/ui/GlassIcon'
import { Icon } from '../../../components/ui/Icon'
import { COMMUNITY_CATEGORY_TABS, COMMUNITY_REGIONS, LOCAL_GATHERING_TYPES } from '../constants/community.constants'
import { CreateReviewInput, ReviewCategory } from '../model/community.types'
import { communityRepository, formatCommunityRegion, hasPossiblePrivateInformation, hasUnsafeLocalMeetingInformation } from '../services/community.service'
import { CommunityDisclaimer, navigateCommunity } from './CommunityCommon'

const WRITE_CATEGORY_OPTIONS = COMMUNITY_CATEGORY_TABS.filter((tab) => tab !== '전체' && tab !== '동행글') as ReviewCategory[]

type ReviewForm = {
  nickname: string
  title: string
  categories: ReviewCategory[]
  content: string
  isLocalGathering: boolean
  region: string
  district: string
  gatheringType: string
}

const initialForm: ReviewForm = {
  nickname: '', title: '', categories: [WRITE_CATEGORY_OPTIONS[0]], content: '',
  isLocalGathering: false, region: '', district: '', gatheringType: LOCAL_GATHERING_TYPES[0],
}

export function ReviewWritePage() {
  const searchParams = new URLSearchParams(window.location.search)
  const writeMode = searchParams.get('mode')
  const isCompanionMode = writeMode === 'companion'
  const isLocalMode = writeMode === 'local' || isCompanionMode
  const requestedRegion = searchParams.get('region')
  const initialRegion = COMMUNITY_REGIONS.find((region) => region === requestedRegion) ?? ''
  const requestedCategory = searchParams.get('category') as ReviewCategory | null
  const initialCategory = requestedCategory && WRITE_CATEGORY_OPTIONS.includes(requestedCategory)
    ? requestedCategory
    : WRITE_CATEGORY_OPTIONS[0]
  const gatheringTypeOptions = isCompanionMode
    ? [LOCAL_GATHERING_TYPES[2]]
    : LOCAL_GATHERING_TYPES.slice(0, 2)
  const [form,setForm] = useState<ReviewForm>(() => isLocalMode
    ? { ...initialForm, isLocalGathering: true, categories: [isCompanionMode ? '동행글' : '그냥 이야기'], region: initialRegion, gatheringType: gatheringTypeOptions[0] }
    : { ...initialForm, categories: [initialCategory], region: initialRegion })
  const [privacyConfirmed,setPrivacyConfirmed] = useState(false)
  const [localSafetyConfirmed, setLocalSafetyConfirmed] = useState(false)
  const privacyWarning = useMemo(
    () => hasPossiblePrivateInformation(`${form.title} ${form.content} ${form.district}`),
    [form.content, form.district, form.title],
  )
  const localSafetyWarning = useMemo(
    () => hasUnsafeLocalMeetingInformation(`${form.title} ${form.content} ${form.district}`),
    [form.content, form.district, form.title],
  )
  const localComplete = !form.isLocalGathering
    || Boolean(form.region && form.gatheringType && localSafetyConfirmed && !localSafetyWarning)
  const complete = Boolean(
    form.nickname.trim() && form.title.trim() && form.content.trim()
    && form.categories.length > 0 && localComplete,
  )
  const toggleCategory = (category: ReviewCategory) => setForm((current) => {
    const has = current.categories.includes(category)
    if (current.isLocalGathering && has) return current
    if (has && current.categories.length === 1) return current
    return { ...current, categories: has ? current.categories.filter((item) => item !== category) : [...current.categories, category] }
  })
  const updateRegion = (region: string) => setForm((current) => ({
    ...current,
    region,
    district: region ? current.district : '',
  }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!complete || (privacyWarning && !privacyConfirmed)) return
    const content = form.content.trim()
    const region = formatCommunityRegion(form.region, form.district)
    const taskType = form.isLocalGathering ? `지역모임 · ${form.gatheringType}` : ''
    const input: CreateReviewInput = {
      categories: form.categories, title: form.title.trim(), authorName: form.nickname.trim(), isAnonymous: true,
      region, relation: null, taskType, situationTags: [region, taskType].filter((value): value is string => Boolean(value)),
      body: { situation: content, difficulty: '', actionTaken: '', preparedDocuments: [], usefulTip: '', caution: '' },
    }
    try {
      const created = await communityRepository.createReview(input)
      navigateCommunity(`/community/${created.id}`)
    } catch (error) {
      console.error('후기를 등록하지 못했어요:', error)
    }
  }
  return <section className="cm-workspace cm-single"><main className="cm-write da-glass">
    <button className="cm-back" onClick={() => navigateCommunity('/community')}><Icon name="arrowLeft" size={18}/>게시판으로</button>
    <header><GlassIcon icon="edit" tone="peach"/><div><span>SHARE YOUR EXPERIENCE</span><h1>경험 나누기</h1><p>누군가에게 도움이 될 수 있도록 경험을 자유롭게 적어보세요.</p></div></header>
    <PrivacyWarning active={privacyWarning}/>
    <form className="cm-write-form" onSubmit={submit}>
      <label className="cm-write-nickname">닉네임<input value={form.nickname} maxLength={20} placeholder="닉네임" onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}/></label>
      <label className="cm-write-title">제목<input value={form.title} maxLength={80} placeholder="제목을 적어주세요" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}/></label>
      <div className="cm-write-categories">
        <span>{form.isLocalGathering ? '분류' : '분류 (여러 개 선택 가능)'}</span>
        <div className="cm-write-category-options">
          {form.isLocalGathering
            ? <button type="button" className="active" disabled>{isCompanionMode ? '동행글' : '그냥 이야기'}</button>
            : WRITE_CATEGORY_OPTIONS.map((category) => <button type="button" key={category} className={form.categories.includes(category) ? 'active' : ''} onClick={() => toggleCategory(category)}>{category}</button>)}
        </div>
      </div>
      {!form.isLocalGathering && <section className="cm-write-region">
        <header><strong>지역 (선택)</strong><small>선택하지 않으면 ‘지역 무관’으로 표시돼요.</small></header>
        <div className="cm-local-fields cm-optional-region-fields">
          <label>시·도<select value={form.region} onChange={(event) => updateRegion(event.target.value)}><option value="">선택 안 함</option>{COMMUNITY_REGIONS.map((region) => <option value={region} key={region}>{region}</option>)}</select></label>
          <label>시·군·구<input value={form.district} disabled={!form.region} maxLength={12} placeholder="예: 해운대구 (선택)" onChange={(event) => setForm((current) => ({ ...current, district: event.target.value.replace(/[^가-힣0-9\s]/g, '') }))}/></label>
        </div>
      </section>}
      {form.isLocalGathering && <section className="cm-local-write active">
        <div className="cm-local-toggle"><span><strong>{isCompanionMode ? '동행 모임 만들기' : '지역 이야기·정보 글'}</strong><small>{isCompanionMode ? '같은 지역에서 공공기관 방문을 함께할 모임을 만드는 글이에요.' : '우리 지역의 이야기나 행정 정보를 나누는 글이에요.'}</small></span></div>
        <>
          <div className="cm-local-fields">
            <label>시·도<select value={form.region} onChange={(event) => updateRegion(event.target.value)}><option value="">지역 선택</option>{COMMUNITY_REGIONS.map((region) => <option value={region} key={region}>{region}</option>)}</select></label>
            <label>시·군·구<input value={form.district} maxLength={12} placeholder="예: 해운대구 (선택)" onChange={(event) => setForm((current) => ({ ...current, district: event.target.value.replace(/[^가-힣0-9\s]/g, '') }))}/></label>
            <label>글 유형<select value={form.gatheringType} disabled={gatheringTypeOptions.length === 1} onChange={(event) => setForm((current) => ({ ...current, gatheringType: event.target.value }))}>{gatheringTypeOptions.map((type) => <option value={type} key={type}>{type}</option>)}</select></label>
          </div>
          <div className="cm-local-safety"><Icon name="shield" size={18}/><span><strong>공개된 안전한 장소에서 만나세요.</strong><small>집 주소, 정확한 만남 장소, 전화번호나 오픈채팅 주소는 글에 적지 말고 댓글에도 개인정보를 남기지 마세요.</small></span></div>
          <label className="cm-local-confirm"><input type="checkbox" checked={localSafetyConfirmed} onChange={(event) => setLocalSafetyConfirmed(event.target.checked)}/>공공장소 이용과 개인정보 보호 안내를 확인했어요.</label>
        </>
      </section>}
      <label className="cm-write-content">
        <textarea value={form.content} placeholder={form.isLocalGathering ? (isCompanionMode ? '어느 지역의 어떤 공공기관에 동행이 필요한지, 희망 날짜대와 필요한 도움을 적어주세요. 정확한 주소나 연락처는 적지 마세요.' : '우리 지역에서 나누고 싶은 이야기나 행정 정보를 적어주세요. 정확한 주소나 연락처는 적지 마세요.') : '어떤 경험을 나누고 싶으신가요? 상황, 어려웠던 점, 도움이 된 방법 등을 자유롭게 적어주세요.'} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}/>
      </label>
    </form>
    {(form.isLocalGathering ? localSafetyWarning : privacyWarning) && (form.isLocalGathering
      ? <p className="cm-local-blocked">지역 모임 글에는 연락처나 상세 주소를 넣을 수 없어요. 해당 내용을 지운 뒤 게시해주세요.</p>
      : <label className="cm-privacy-check"><input type="checkbox" checked={privacyConfirmed} onChange={(event) => setPrivacyConfirmed(event.target.checked)}/>개인정보로 보이는 내용을 다시 확인했습니다.</label>)}
    <div className="cm-write-actions"><button onClick={() => navigateCommunity('/community')}>취소</button><button disabled={!complete || (privacyWarning && !privacyConfirmed)} onClick={(event) => void submit(event)}>{isCompanionMode ? '동행 모임 만들기' : '경험 게시하기'}</button></div>
    <CommunityDisclaimer/>
  </main></section>
}

export function PrivacyWarning({ active }: { active: boolean }) {
  return <div className={`cm-privacy-warning ${active ? 'active' : ''}`}><Icon name="shield" size={20}/><div><strong>{active ? '개인정보로 보이는 내용이 포함되어 있어요.' : '개인정보를 입력하지 말아주세요.'}</strong><p>{active ? '게시하기 전에 해당 내용을 확인해주세요.' : '실명, 전화번호, 주민등록번호, 계좌번호, 상세 주소, 사건번호, 금융기관 고객번호는 제외해주세요.'}</p></div></div>
}
