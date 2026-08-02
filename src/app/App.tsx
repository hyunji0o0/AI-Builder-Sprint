import { useEffect, useState } from 'react'
import { AgentChat } from '../components/agent/AgentChat'
import { CaseSummary } from '../components/dashboard/CaseSummary'
import { ProgressDashboard } from '../components/dashboard/ProgressDashboard'
import { MobileNav, Sidebar } from '../components/layout/Sidebar'
import { useCaseAgent } from '../features/case/useCaseAgent'
import { CaseSectionView } from '../features/case/CaseSectionView'
import { CommunityRouter, useCommunity } from '../features/community'
import { DocumentPreview } from '../components/documents/DocumentPreview'
import { useAuth } from '../features/auth/useAuth'
import { LoginScreen } from '../features/auth/LoginScreen'
import { MobileUserGuideTrigger, UserGuide } from '../features/user-guide'
import '../dashboard.css'

export default function App() {
  const auth = useAuth()
  const controller = useCaseAgent()
  const community = useCommunity()
  const [path, setPath] = useState(window.location.pathname)
  const [guideOpen, setGuideOpen] = useState(false)
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

  if (auth.isLoading) return <div className="da-page da-login-page"/>
  if (!auth.user) return <LoginScreen onSignIn={auth.signInWithGoogle} error={auth.error}/>

  return (
    <div className="da-page">
      <main className="da-shell">
        <Sidebar activeMenu={activeMenu} menuAction={menuAction} onOpenGuide={() => setGuideOpen(true)}/>
        {isCommunity ? <CommunityRouter path={path} controller={community}/> : <>
        <section className="da-main">
          {activeMenu === 'AI 홈' ? <>
          <ProgressDashboard
            caseState={controller.caseState}
            stages={controller.stages}
            addAgent={controller.addAgent}
          />
          <AgentChat controller={controller}/>
          </> : <CaseSectionView controller={controller} user={auth.user} onSignOut={auth.signOut}/>}
        </section>
        <CaseSummary
          caseState={controller.caseState}
          addAgent={controller.addAgent}
          completeTask={controller.completeTask}
          menuAction={menuAction}
        />
        </>}
      </main>
      <MobileNav activeMenu={activeMenu} menuAction={menuAction}/>
      <DocumentPreview document={controller.previewDocument} onClose={() => controller.setPreviewDocument(null)}/>
      <MobileUserGuideTrigger onClick={() => setGuideOpen(true)}/>
      <UserGuide open={guideOpen} onClose={() => setGuideOpen(false)}/>
    </div>
  )
}
