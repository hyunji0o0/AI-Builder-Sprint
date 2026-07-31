import { Icon, IconName } from './Icon'

export function GlassIcon({ icon, tone = 'blue' }: { icon: IconName; tone?: string }) {
  return <span className={`da-orb da-${tone}`}><Icon name={icon}/></span>
}
