import { AgentChat } from '../components/agent/AgentChat'
import { CaseSummary } from '../components/dashboard/CaseSummary'
import { ProgressDashboard } from '../components/dashboard/ProgressDashboard'
import { MobileNav, Sidebar } from '../components/layout/Sidebar'
import { useCaseAgent } from '../features/case/useCaseAgent'
import '../dashboard.css'

export default function App() {
  const controller = useCaseAgent()

  return (
    <div className="da-page">
      <div className="da-cloud da-cloud-a"/>
      <div className="da-cloud da-cloud-b"/>
      <main className="da-shell">
        <Sidebar activeMenu={controller.activeMenu} menuAction={controller.menuAction}/>
        <section className="da-main">
          <ProgressDashboard
            caseState={controller.caseState}
            stages={controller.stages}
            addAgent={controller.addAgent}
          />
          <AgentChat controller={controller}/>
        </section>
        <CaseSummary
          caseState={controller.caseState}
          addAgent={controller.addAgent}
          completeTask={controller.completeTask}
        />
      </main>
      <MobileNav activeMenu={controller.activeMenu} menuAction={controller.menuAction}/>
    </div>
  )
}
