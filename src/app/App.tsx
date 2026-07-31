import { useEffect, useState } from 'react'
import { AgentChat } from '../components/agent/AgentChat'
import { CaseSummary } from '../components/dashboard/CaseSummary'
import { ProgressDashboard } from '../components/dashboard/ProgressDashboard'
import { MobileNav, Sidebar } from '../components/layout/Sidebar'
import { useCaseAgent } from '../features/case/useCaseAgent'
import { CaseSectionView } from '../features/case/CaseSectionView'
import { CommunityRouter, useCommunity } from '../features/community'
import { DocumentPreview } from '../components/documents/DocumentPreview'
import '../dashboard.css'

export default function App() {
  const controller = useCaseAgent()
  const community = useCommunity()
  const [path, setPath] = useState(window.location.pathname)
  const isCommunity = path.startsWith('/community')

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname)
    window.addEventListener('popstate', updatePath)
    return () => window.removeEventListener('popstate', updatePath)
  }, [])

  const menuAction = (label: string) => {
    if (label === '경험 나눔') {
      window.history.pushState({}, '', '/community')
      setPath('/community')
      return
    }
    if (isCommunity) {
      window.history.pushState({}, '', '/')
      setPath('/')
    }
    controller.menuAction(label)
  }

  const activeMenu = isCommunity ? '경험 나눔' : controller.activeMenu

  return (
    <div className="da-page">
      <main className="da-shell">
        <Sidebar activeMenu={activeMenu} menuAction={menuAction}/>
        {isCommunity ? <CommunityRouter path={path} controller={community}/> : <>
        <section className="da-main">
          {activeMenu === 'AI 홈' ? <>
          <ProgressDashboard
            caseState={controller.caseState}
            stages={controller.stages}
            addAgent={controller.addAgent}
          />
          <AgentChat controller={controller}/>
          </> : <CaseSectionView controller={controller}/>}
        </section>
        <CaseSummary
          caseState={controller.caseState}
          addAgent={controller.addAgent}
          completeTask={controller.completeTask}
        />
        </>}
      </main>
      <MobileNav activeMenu={activeMenu} menuAction={menuAction}/>
      <DocumentPreview document={controller.previewDocument} onClose={() => controller.setPreviewDocument(null)}/>
    </div>
  )
}
