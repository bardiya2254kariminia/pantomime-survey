import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import samples from './data/samples.json'
import { study } from './config/study.js'
import { shuffle } from './lib/shuffle.js'
import { loadProgress, saveProgress, clearProgress } from './lib/progress.js'
import LocalModeBanner from './components/LocalModeBanner.jsx'
import WelcomePage from './pages/WelcomePage.jsx'
import SurveyPage from './pages/SurveyPage.jsx'
import ThankYouPage from './pages/ThankYouPage.jsx'

// Loaded on demand: participants never download the report page or Firebase Auth.
const ResultsPage = lazy(() => import('./pages/ResultsPage.jsx'))

const STAGE = { WELCOME: 'welcome', SURVEY: 'survey', THANKYOU: 'thankyou' }

// crypto.randomUUID is secure-context-only, so it is missing when the site is previewed
// over plain http. crypto.getRandomValues is not, so build the v4 uuid from it instead.
function sessionId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// A fresh session: its own id, question order, and per-question output order.
function newSession() {
  const ordered = study.shuffleQuestions ? shuffle(samples) : samples
  return {
    studyId: study.id,
    sessionId: sessionId(),
    startedAt: Date.now(),
    stage: STAGE.WELCOME,
    index: 0,
    rankings: [],
    questionOrder: ordered.map((s) => s.id),
    outputOrder: Object.fromEntries(
      samples.map((s) => {
        const methods = Object.keys(s.outputs)
        return [s.id, study.shuffleOutputs ? shuffle(methods) : methods]
      }),
    ),
  }
}

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export default function App() {
  const hash = useHashRoute()
  const [session, setSession] = useState(() => {
    const saved = loadProgress(study.id)
    // Only resume sessions whose questions and stage still exist (a saved 'consent' stage would render nothing).
    //
    // The output order is checked too, and against the CURRENT method names. A session
    // saved before the questions changed holds method keys that no longer index
    // sample.outputs, so resuming it would show blank tiles and, worse, record answers
    // under names this study no longer uses. Starting over is the honest outcome.
    const methodsMatch = (id) => {
      const now = Object.keys(samples.find((s) => s.id === id)?.outputs ?? {})
      const then = saved.outputOrder?.[id]
      return Array.isArray(then) && then.length === now.length && then.every((m) => now.includes(m))
    }
    const valid =
      saved &&
      Object.values(STAGE).includes(saved.stage) &&
      saved.questionOrder.every((id) => samples.some((s) => s.id === id)) &&
      saved.questionOrder.every(methodsMatch)
    return valid ? saved : newSession()
  })

  useEffect(() => {
    if (session.stage !== STAGE.WELCOME) saveProgress(session)
  }, [session])

  // Coming back from the first question keeps the original start time and answers.
  const start = useCallback(
    () => setSession((s) => ({ ...s, stage: STAGE.SURVEY, startedAt: s.rankings.length ? s.startedAt : Date.now() })),
    [],
  )

  const next = useCallback((ranking) => {
    setSession((s) => {
      const rankings = [...s.rankings.filter((r) => r.sample_id !== ranking.sample_id), ranking]
      const done = s.index + 1 >= s.questionOrder.length
      return { ...s, rankings, index: done ? s.index : s.index + 1, stage: done ? STAGE.THANKYOU : STAGE.SURVEY }
    })
    window.scrollTo(0, 0)
  }, [])

  // One step back: previous question, or the welcome page from the first one. `draft` is the
  // (possibly incomplete) ranking of the page being left, so it is still there on return.
  // Only complete rankings can be submitted, because Next is needed to get past every question.
  const back = useCallback((draft) => {
    setSession((s) => {
      const rankings = draft ? [...s.rankings.filter((r) => r.sample_id !== draft.sample_id), draft] : s.rankings
      if (s.stage === STAGE.THANKYOU) return { ...s, stage: STAGE.SURVEY }
      if (s.index === 0) return { ...s, rankings, stage: STAGE.WELCOME }
      return { ...s, rankings, index: s.index - 1 }
    })
    window.scrollTo(0, 0)
  }, [])

  const restart = useCallback(() => {
    clearProgress()
    setSession(newSession())
  }, [])

  if (hash.startsWith('#/results')) {
    return (
      <>
        <LocalModeBanner />
        <Suspense fallback={<p className="p-8 text-slate-500">Loading…</p>}>
          <ResultsPage samples={samples} />
        </Suspense>
      </>
    )
  }

  const sample = samples.find((s) => s.id === session.questionOrder[session.index])

  return (
    <>
      <LocalModeBanner />
      {session.stage === STAGE.WELCOME && <WelcomePage onStart={start} />}
      {session.stage === STAGE.SURVEY && (
        <SurveyPage
          key={sample.id}
          sample={sample}
          outputOrder={session.outputOrder[sample.id]}
          currentIndex={session.index}
          total={session.questionOrder.length}
          initial={session.rankings.find((r) => r.sample_id === sample.id)}
          onNext={next}
          onBack={back}
          onRestart={restart}
        />
      )}
      {session.stage === STAGE.THANKYOU && (
        <ThankYouPage session={session} onSubmitted={clearProgress} onBack={() => back()} />
      )}
    </>
  )
}
