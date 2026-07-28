import { CommunityFeed } from './components/community/CommunityFeed'
import './components/community/community.css'

// 이 브랜치를 독립 실행할 때 보이는 미리보기 셸입니다.
// agent_and_ui와 합칠 때는 App.tsx를 그쪽 것으로 교체하고,
// Sidebar의 '경험 나눔' 메뉴가 활성화됐을 때 <CommunityFeed /> 를
// da-main 자리에 렌더링하도록 연결하면 됩니다.
export default function App() {
  return (
    <div className="da-page cm-standalone">
      <div className="da-cloud da-cloud-a" />
      <div className="da-cloud da-cloud-b" />
      <main className="cm-standalone-shell">
        <CommunityFeed />
      </main>
    </div>
  )
}
