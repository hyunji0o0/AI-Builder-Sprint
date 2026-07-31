import { CSSProperties } from 'react'
import { CaseAgentController } from '../../features/case/useCaseAgent'
import { Icon, IconName } from '../ui/Icon'

export const menuItems: { label: string; icon: IconName }[] = [
  { label: 'AI 홈', icon: 'home' },
  { label: '내 할 일', icon: 'check' },
  { label: '서류함', icon: 'folder' },
  { label: '경험 나눔', icon: 'users' },
  { label: '내 정보', icon: 'person' },
]

type Props = Pick<CaseAgentController, 'activeMenu' | 'menuAction'>

export function Sidebar({ activeMenu, menuAction }: Props) {
  const activeIndex = menuItems.findIndex((item) => item.label === activeMenu)
  return (
    <aside className="da-sidebar">
      <div className="da-brand">
        <img className="da-brand-logo" src="/aedohal-sigan-icon-3d.svg" alt=""/>
        <div><strong>애도할 시간</strong><span>당신의 곁에서 함께해요</span></div>
      </div>
      <nav aria-label="주요 메뉴" style={{ '--active-index': activeIndex } as CSSProperties}>
        <span className="da-nav-slider" aria-hidden="true"/>
        {menuItems.map((item) => (
          <button className={activeMenu === item.label ? 'active' : ''} onClick={() => menuAction(item.label)} key={item.label}>
            <span className="da-nav-icon"><Icon name={item.icon}/></span>{item.label}
          </button>
        ))}
      </nav>
      <div className="da-help"><Icon name="heart" size={17}/><div><strong>도움이 필요하신가요?</strong><span>고객센터 1522-0000</span></div></div>
      <small className="da-privacy">개인정보는 안전하게 보호돼요</small>
    </aside>
  )
}

export function MobileNav({ activeMenu, menuAction }: Props) {
  return (
    <nav className="da-mobile-nav" aria-label="모바일 메뉴">
      {menuItems.map((item) => (
        <button className={activeMenu === item.label ? 'active' : ''} onClick={() => menuAction(item.label)} key={item.label}>
          <Icon name={item.icon}/><span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
