import { Icon, IconName } from './Icon'

// agent_and_ui의 src/components/ui/GlassIcon.tsx와 동일한 내용.
// 합칠 때 이 파일은 지우고 그쪽 파일을 그대로 쓰면 됨.
export function GlassIcon({ icon, tone = 'blue' }: { icon: IconName; tone?: string }) {
  return <span className={`da-orb da-${tone}`}><Icon name={icon}/></span>
}
