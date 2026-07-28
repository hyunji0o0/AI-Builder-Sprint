import { FormEvent, useMemo, useState } from 'react'
import { GlassIcon } from '../../../components/ui/GlassIcon'
import { Icon } from '../../../components/ui/Icon'
import { CreateReviewInput, ReviewCategory } from '../model/community.types'
import { communityRepository, hasPossiblePrivateInformation } from '../services/community.service'
import { CommunityDisclaimer, navigateCommunity } from './CommunityCommon'

const initialForm = {
  category:'재산·채무' as ReviewCategory, region:'부산', relation:'부모님', taskType:'채무 확인',
  situation:'', difficulty:'', actionTaken:'', preparedDocuments:'', usefulTip:'', caution:'',
}

export function ReviewWritePage() {
  const [form,setForm] = useState(initialForm)
  const [privacyConfirmed,setPrivacyConfirmed] = useState(false)
  const text = Object.values(form).join(' ')
  const privacyWarning = useMemo(() => hasPossiblePrivateInformation(text), [text])
  const complete = Boolean(form.situation && form.difficulty && form.actionTaken && form.usefulTip && form.caution)
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]:value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!complete || (privacyWarning && !privacyConfirmed)) return
    const input: CreateReviewInput = {
      category:form.category,title:`${form.taskType} 경험을 나눕니다`,authorName:'익명의 곁',isAnonymous:true,region:form.region || null,relation:form.relation || null,
      taskType:form.taskType,situationTags:[form.region,form.taskType].filter(Boolean),
      body:{situation:form.situation,difficulty:form.difficulty,actionTaken:form.actionTaken,preparedDocuments:form.preparedDocuments.split(',').map((item) => item.trim()).filter(Boolean),usefulTip:form.usefulTip,caution:form.caution},
    }
    const created = await communityRepository.createReview(input)
    navigateCommunity(`/community/${created.id}`)
  }
  return <section className="cm-workspace cm-single"><main className="cm-write da-glass">
    <button className="cm-back" onClick={() => navigateCommunity('/community')}><Icon name="arrowLeft" size={18}/>게시판으로</button>
    <header><GlassIcon icon="edit" tone="peach"/><div><span>SHARE YOUR EXPERIENCE</span><h1>경험 나누기</h1><p>누군가에게 도움이 될 수 있도록 경험을 한 단계씩 적어보세요.</p></div></header>
    <PrivacyWarning active={privacyWarning}/>
    <ReviewWriteForm form={form} update={update} onSubmit={submit}/>
    {privacyWarning && <label className="cm-privacy-check"><input type="checkbox" checked={privacyConfirmed} onChange={(event) => setPrivacyConfirmed(event.target.checked)}/>개인정보로 보이는 내용을 다시 확인했습니다.</label>}
    <div className="cm-write-actions"><button onClick={() => navigateCommunity('/community')}>취소</button><button disabled={!complete || (privacyWarning && !privacyConfirmed)} onClick={(event) => void submit(event)}>경험 게시하기</button></div>
    <CommunityDisclaimer/>
  </main></section>
}

export function ReviewWriteForm({ form, update, onSubmit }: { form: typeof initialForm; update: (key: keyof typeof initialForm,value:string)=>void; onSubmit:(event:FormEvent)=>void }) {
  const fields: Array<[keyof typeof initialForm,string,string]> = [
    ['situation','당시 상황','어떤 상황에서 업무를 시작했나요?'],['difficulty','가장 어려웠던 점','무엇이 가장 어렵거나 헷갈렸나요?'],
    ['actionTaken','실제로 한 일','어떤 순서로 무엇을 했나요?'],['preparedDocuments','준비한 서류','쉼표로 구분해 적어주세요.'],
    ['usefulTip','미리 알았으면 좋았을 팁','다른 사용자에게 전하고 싶은 팁이 있나요?'],['caution','처리하면서 주의한 점','개인정보 없이 주의할 점을 적어주세요.'],
  ]
  return <form className="cm-write-form" onSubmit={onSubmit}>
    <div className="cm-write-basics"><label>관련 업무<input value={form.taskType} onChange={(event)=>update('taskType',event.target.value)}/></label><label>지역<input value={form.region} onChange={(event)=>update('region',event.target.value)}/></label><label>고인과의 관계<input value={form.relation} onChange={(event)=>update('relation',event.target.value)}/></label></div>
    {fields.map(([key,label,placeholder],index) => <label className="cm-write-field" key={key}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{label}</strong><textarea value={form[key]} placeholder={placeholder} onChange={(event)=>update(key,event.target.value)}/></div></label>)}
  </form>
}

export function PrivacyWarning({ active }: { active: boolean }) {
  return <div className={`cm-privacy-warning ${active ? 'active' : ''}`}><Icon name="shield" size={20}/><div><strong>{active ? '개인정보로 보이는 내용이 포함되어 있어요.' : '개인정보를 입력하지 말아주세요.'}</strong><p>{active ? '게시하기 전에 해당 내용을 확인해주세요.' : '실명, 전화번호, 주민등록번호, 계좌번호, 상세 주소, 사건번호, 금융기관 고객번호는 제외해주세요.'}</p></div></div>
}
