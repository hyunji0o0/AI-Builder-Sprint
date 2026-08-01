import { CSSProperties } from 'react'
import type { User } from '@supabase/supabase-js'
import { CaseAgentController } from '../../features/case/useCaseAgent'
import { Icon, IconName } from '../ui/Icon'

export const menuItems: { label: string; icon: IconName }[] = [
  { label: 'AI 홈', icon: 'home' },
  { label: '내 할 일', icon: 'check' },
  { label: '서류함', icon: 'folder' },
  { label: '경험 나눔', icon: 'users' },
  { label: '내 정보', icon: 'person' },
]

type NavProps = Pick<CaseAgentController, 'activeMenu' | 'menuAction'>
type Props = NavProps & {
  user: User
  onSignOut: () => void
}

export function Sidebar({ activeMenu, menuAction, user, onSignOut }: Props) {
  const activeIndex = menuItems.findIndex((item) => item.label === activeMenu)
  const displayName = user.user_metadata.full_name ?? user.email ?? '사용자'
  const avatarUrl = user.user_metadata.avatar_url ?? user.user_metadata.picture
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
      <div className="da-user">
        {avatarUrl ? <img className="da-user-avatar" src={avatarUrl} alt=""/> : <span className="da-user-avatar da-user-avatar-fallback">{displayName[0]}</span>}
        <div><strong>{displayName}</strong><span>{user.email}</span></div>
        <button type="button" className="da-user-logout" onClick={onSignOut} aria-label="로그아웃">
          <Icon name="arrowLeft" size={15}/>
        </button>
      </div>
      <div className="da-help"><Icon name="heart" size={17}/><div><strong>도움이 필요하신가요?</strong><span>고객센터 1522-0000</span></div></div>
      <small className="da-privacy">개인정보는 안전하게 보호돼요</small>
    </aside>
  )
}

export function MobileNav({ activeMenu, menuAction }: NavProps) {
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
