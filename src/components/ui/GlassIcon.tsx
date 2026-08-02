import { Icon, IconName } from './Icon'

export function GlassIcon({ icon, tone = 'blue', size }: { icon: IconName; tone?: string; size?: number }) {
  return <span className={`da-orb da-${tone}`}><Icon name={icon} size={size}/></span>
}
