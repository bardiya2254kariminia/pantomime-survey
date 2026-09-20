import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { app, isFirebaseConfigured } from '../config/firebase.js'
import { fetchAllResponses } from '../lib/responses.js'
import { methodStats, perSampleWinners, responsesToCsv, statsToCsv, responsesWithNames, download } from '../lib/report.js'

// One-hue ordinal ramp (dark = better rank), validated with the dataviz palette checker.
const RANK_RAMPS = {
  1: ['#1c5cab'],
  2: ['#1c5cab', '#86b6ef'],
  3: ['#1c5cab', '#3987e5', '#86b6ef'],
  4: ['#104281', '#256abf', '#5598e7', '#86b6ef'],
  5: ['#0d366b', '#184f95', '#2a78d6', '#5598e7', '#86b6ef'],
}
const auth = app ? getAuth(app) : null

const ordinal = (n) => ['1st', '2nd', '3rd'][n] ?? `${n + 1}th`
const pct = (x) => `${(x * 100).toFixed(1)}%`

function formatDuration(ms) {
  if (!ms && ms !== 0) return '–'
  const m = Math.floor(ms / 60000)
  const s = Math.round((ms % 60000) / 1000)
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function median(xs) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function Tile({ label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
    </div>
  )
}

function Card({ title, children, action }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Gate({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Study results</h1>
        {children}
      </div>
    </div>
  )
}

function SignIn() {
  const [error, setError] = useState(null)
  const signIn = () => signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => setError(e.message))
  return (
    <Gate>
      <p className="text-slate-600 mb-6">Researchers only. Sign in with your Google account to see the answers.</p>
      <button onClick={signIn} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl">
        Sign in with Google
      </button>
      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
    </Gate>
  )
}

// Signed in, but Firestore refused: this account is not in the `admins` collection yet.
function NotAdmin({ user, onRetry }) {
  const [copied, setCopied] = useState(false)
  return (
    <Gate>
      <p className="text-slate-600 mb-5">
        <strong>{user.email}</strong> is not an admin yet. To make it one, add its user ID to Firestore once:
      </p>
      <div className="bg-slate-50 rounded-xl p-4 mb-5">
        <p className="text-xs font-medium text-slate-500 mb-1">Your user ID</p>
        <code className="font-mono text-sm text-indigo-700 break-all">{user.uid}</code>
        <button
          onClick={() => navigator.clipboard?.writeText(user.uid).then(() => setCopied(true))}
          className="block mx-auto mt-2 text-xs font-semibold text-indigo-600 hover:underline"
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <ol className="text-left text-sm text-slate-600 space-y-1.5 list-decimal pl-5 mb-6">
        <li>Firebase console → <strong>Firestore Database</strong> → <strong>+ Start collection</strong></li>
        <li>Collection ID: <code>admins</code></li>
        <li>Document ID: paste the user ID above</li>
        <li>Add any field, e.g. <code>note</code> (string) = <code>me</code>, then <strong>Save</strong></li>
      </ol>
      <div className="flex justify-center gap-4">
        <button onClick={onRetry} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl">
          I added it, try again
        </button>
        <button onClick={() => signOut(auth)} className="text-sm text-slate-500 hover:text-slate-700">
          Use another account
        </button>
      </div>
    </Gate>
  )
}

function RankBars({ stats, nRanks }) {
  const colors = RANK_RAMPS[nRanks] ?? RANK_RAMPS[5]
  const maxTotal = Math.max(1, ...stats.map((s) => s.counts.reduce((a, b) => a + b, 0)))

  return (
    <>
      <div className="flex flex-wrap gap-4 mb-4 text-sm text-slate-600" aria-label="Legend">
        {colors.slice(0, nRanks).map((c, i) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: c }} />
            {ordinal(i)} place
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3 font-medium">Method</th>
              <th className="py-2 pr-3 font-medium w-1/2 min-w-48">Times ranked (by place)</th>
              {Array.from({ length: nRanks }, (_, i) => (
                <th key={i} className="py-2 px-2 font-medium text-right">{ordinal(i)}</th>
              ))}
              <th className="py-2 px-2 font-medium text-right" title="Borda points: 1st = N, 2nd = N−1, …">Points</th>
              <th className="py-2 px-2 font-medium text-right" title="Share of showings ranked 1st">1st rate</th>
              <th className="py-2 pl-2 font-medium text-right" title={`Share of showings ranked in the top ${nRanks}`}>Top-{nRanks} rate</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.method} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-3 font-medium text-slate-800 whitespace-nowrap">{s.label}</td>
                <td className="py-2.5 pr-3">
                  <div className="flex gap-[2px] h-4" role="img" aria-label={`${s.label}: ${s.counts.map((c, i) => `${c} × ${ordinal(i)}`).join(', ')}`}>
                    {s.counts.map((c, i) =>
                      c ? (
                        <div
                          key={i}
                          title={`${s.label}: ${c} × ${ordinal(i)} place`}
                          className="h-4 first:rounded-l last:rounded-r hover:opacity-80"
                          style={{ width: `${(c / maxTotal) * 100}%`, background: colors[i] }}
                        />
                      ) : null,
                    )}
                  </div>
                </td>
                {s.counts.map((c, i) => (
                  <td key={i} className="py-2.5 px-2 text-right tabular-nums text-slate-700">{c}</td>
                ))}
                <td className="py-2.5 px-2 text-right tabular-nums font-semibold text-slate-900">{s.points}</td>
                <td className="py-2.5 px-2 text-right tabular-nums text-slate-700">{pct(s.firstRate)}</td>
                <td className="py-2.5 pl-2 text-right tabular-nums text-slate-700">{pct(s.selectedRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function ResultsPage({ samples }) {
  const [user, setUser] = useState(undefined) // undefined = still checking
  const [responses, setResponses] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [denied, setDenied] = useState(false)
  const [showTests, setShowTests] = useState(false)

  useEffect(() => {
    if (!isFirebaseConfigured) return setUser(null)
    return onAuthStateChanged(auth, setUser)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    setDenied(false)
    fetchAllResponses()
      .then(setResponses)
      .catch((e) => {
        console.error(e)
        if (e.code === 'permission-denied') setDenied(true)
        else setError(e.message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user === null && isFirebaseConfigured) return setResponses(null)
    if (user !== undefined) load()
  }, [user, load])

  // Answers submitted from `npm run dev` are tagged "<id>-dev" and hidden unless asked for.
  const isTest = (r) => (r.study_id ?? '').endsWith('-dev')
  const visible = useMemo(() => (responses ?? []).filter((r) => showTests || !isTest(r)), [responses, showTests])
  const testCount = (responses ?? []).filter(isTest).length

  const nRanks = useMemo(
    () => Math.max(1, ...visible.flatMap((r) => r.rankings.map((x) => Object.keys(x).filter((k) => /^rank\d+$/.test(k)).length))),
    [visible],
  )
  const stats = useMemo(() => methodStats(visible, samples), [visible, samples])
  const winners = useMemo(() => perSampleWinners(visible, samples), [visible, samples])

  if (user === undefined) return <p className="p-8 text-slate-500">Checking sign-in…</p>
  if (isFirebaseConfigured && !user) return <SignIn />
  if (denied) return <NotAdmin user={user} onRetry={load} />

  const sorted = [...visible].sort((a, b) => (b.submitted_at ?? '').localeCompare(a.submitted_at ?? ''))
  const answered = sorted.reduce((n, r) => n + r.rankings.length, 0)
  const medianTime = median(sorted.map((r) => r.total_time_ms).filter((x) => typeof x === 'number'))
  const stamp = new Date().toISOString().slice(0, 10)

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Study results</h1>
            <p className="text-sm text-slate-500 mt-1">
              {isFirebaseConfigured ? `Signed in as ${user.email}` : 'Local mode: responses from this browser only'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={load} disabled={loading} className="bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg">
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            {testCount > 0 && (
              <label className="flex items-center gap-2 text-sm text-slate-600 px-2">
                <input type="checkbox" checked={showTests} onChange={(e) => setShowTests(e.target.checked)} className="accent-indigo-600" />
                Include {testCount} test run{testCount === 1 ? '' : 's'} from <code>npm run dev</code>
              </label>
            )}
            {isFirebaseConfigured && (
              <button onClick={() => signOut(auth)} className="text-sm text-slate-500 hover:text-slate-700 px-2">
                Sign out
              </button>
            )}
          </div>
        </header>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">{error}</div>}

        {responses && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Tile label="Participants" value={sorted.length} />
              <Tile label="Questions answered" value={answered} />
              <Tile label="Median completion" value={formatDuration(medianTime)} />
              <Tile label="Latest submission" value={sorted[0]?.submitted_at ? new Date(sorted[0].submitted_at).toLocaleDateString() : '–'} />
            </div>

            <Card
              title="Export"
              action={<span className="text-xs text-slate-400">{sorted.length} responses</span>}
            >
              <div className="flex flex-wrap gap-2">
                <button onClick={() => download(`responses_${stamp}.csv`, responsesToCsv(sorted))} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                  All answers (CSV, one row per question)
                </button>
                <button onClick={() => download(`method_summary_${stamp}.csv`, statsToCsv(stats))} className="bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg">
                  Method summary (CSV)
                </button>
                <button onClick={() => download(`responses_${stamp}.json`, JSON.stringify(responsesWithNames(sorted), null, 2), 'application/json')} className="bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg">
                  Raw data (JSON)
                </button>
              </div>
            </Card>

            {sorted.length === 0 ? (
              <p className="text-slate-500 text-center py-12">No responses yet.</p>
            ) : (
              <>
                <Card title="Methods, ranked by points">
                  <RankBars stats={stats} nRanks={nRanks} />
                </Card>

                <Card title="Most-preferred method per question">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                          <th className="py-2 pr-3 font-medium">Question</th>
                          <th className="py-2 px-2 font-medium text-right">Answers</th>
                          <th className="py-2 pl-3 font-medium">Times ranked 1st</th>
                        </tr>
                      </thead>
                      <tbody>
                        {winners.map((w) => (
                          <tr key={w.sample_id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-3 font-mono text-xs text-slate-700">{w.sample_id}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{w.answers}</td>
                            <td className="py-2 pl-3 text-slate-600">
                              {w.firsts.length
                                ? w.firsts.map(([m, c], i) => (
                                    <span key={m} className={i === 0 ? 'font-semibold text-slate-900' : ''}>
                                      {i > 0 && ' · '}
                                      {m} {c}
                                    </span>
                                  ))
                                : '–'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card title="Submissions">
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                          <th className="py-2 pr-3 font-medium">Submitted</th>
                          <th className="py-2 pr-3 font-medium">Session</th>
                          <th className="py-2 px-2 font-medium text-right">Questions</th>
                          <th className="py-2 pl-2 font-medium text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((r) => (
                          <tr key={r.session_id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                              {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '–'}
                            </td>
                            <td className="py-2 pr-3 font-mono text-xs text-slate-500">{r.session_id}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{r.rankings.length}</td>
                            <td className="py-2 pl-2 text-right tabular-nums">{formatDuration(r.total_time_ms)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
