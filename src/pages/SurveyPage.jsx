import { useRef, useState } from 'react'
import { study, RANK_LABELS } from '../config/study.js'
import Img from '../components/Img.jsx'
import Lightbox from '../components/Lightbox.jsx'
import ChangePanel from '../components/ChangePanel.jsx'
import CameraDome from '../components/CameraDome.jsx'
import { ArrowIcon } from '../components/Arrows.jsx'

// Medal colours for the first three ranks, as on the reference site; later ranks are neutral.
const RANK_BADGE = ['bg-yellow-400 text-yellow-900 border-yellow-500', 'bg-slate-300 text-slate-700 border-slate-400', 'bg-amber-600 text-white border-amber-700']
const RANK_RING = ['ring-4 ring-yellow-400 ring-offset-2', 'ring-4 ring-slate-400 ring-offset-2', 'ring-4 ring-amber-500 ring-offset-2']
const badge = (i) => RANK_BADGE[i] ?? 'bg-indigo-100 text-indigo-800 border-indigo-300'
const ring = (i) => RANK_RING[i] ?? 'ring-4 ring-indigo-300 ring-offset-2'
const rankName = (i) => ['Best', 'Second best', 'Third best'][i] ?? `${RANK_LABELS[i]} best`

// Tailwind needs literal class names, so map output count → large-screen column class.
const LG_COLS = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' }

// The question's camera dome: A → A′ as shown, and B → B′ with B′ left as a question mark.
// zoom is a factor in meta.json but a distance label (1 or 3) in the poses, 2 apart.
function domePairs(sample) {
  if (!sample.poses || !sample.camera) return null
  const { azimuth, elevation, zoom } = sample.camera
  const move = { az: azimuth, el: elevation, dist: zoom < 1 ? 2 : zoom > 1 ? -2 : 0 }
  const from = (p) => ({ az: p.azimuth, el: p.elevation, dist: p.distance })
  return [
    {
      id: 'a',
      tab: 'A → A′',
      from: from(sample.poses.a),
      move,
      imgs: [sample.a, sample.a_prime],
      labels: ['A', 'A′'],
      color: '#6366f1',
      logos: [sample.logos?.a ?? sample.a],
    },
    {
      id: 'b',
      tab: 'B → B′ (?)',
      from: from(sample.poses.b),
      move,
      imgs: [sample.b, null],
      labels: ['B', 'B′'],
      color: '#10b981',
      logos: [sample.logos?.b ?? sample.b],
      note: 'That is where B′, the image you imagine, is seen from.',
    },
  ]
}

export default function SurveyPage({ sample, outputOrder, currentIndex, total, initial, onNext, onBack, onRestart }) {
  const methods = outputOrder ?? Object.keys(sample.outputs)
  // method → rank index, restored from an earlier visit to this question (via Previous).
  const [ranks, setRanks] = useState(() => {
    const restored = {}
    RANK_LABELS.forEach((_, i) => {
      const m = initial?.[`rank${i + 1}`]
      if (m && methods.includes(m)) restored[m] = i
    })
    return restored
  })
  const [zoom, setZoom] = useState(null)
  const shownAt = useRef(Date.now())
  const dome = domePairs(sample)
  const [showDome, setShowDome] = useState(true)

  const nRanks = Math.min(RANK_LABELS.length, methods.length)
  const assigned = Object.keys(ranks).length
  const complete = assigned === nRanks

  // Same toggle rule as the reference: clicking a rank moves it to this image; clicking it again clears it.
  function assign(method, rank) {
    setRanks((prev) => {
      const next = { ...prev }
      if (next[method] === rank) {
        delete next[method]
        return next
      }
      for (const m in next) if (next[m] === rank) delete next[m]
      next[method] = rank
      return next
    })
  }

  // Time from earlier visits is carried over, so time_ms is the total spent on the question.
  function ranking() {
    const result = { sample_id: sample.id }
    for (let i = 0; i < nRanks; i++) result[`rank${i + 1}`] = null
    for (const [m, r] of Object.entries(ranks)) result[`rank${r + 1}`] = m
    result.display_order = methods
    result.time_ms = (initial?.time_ms ?? 0) + Date.now() - shownAt.current
    return result
  }

  const pct = (currentIndex / total) * 100
  const refs = [
    { label: 'A', sub: 'Example', img: sample.a, text: 'text-indigo-700', border: 'border-indigo-200' },
    { label: 'A′', sub: 'Example, changed', img: sample.a_prime, text: 'text-indigo-700', border: 'border-indigo-200' },
    { label: 'B', sub: 'New subject', img: sample.b, text: 'text-emerald-700', border: 'border-emerald-200' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex justify-between text-sm text-slate-500 mb-1.5">
            <span>
              Question {currentIndex + 1} of {total}
            </span>
            <span>{Math.round(pct)}% complete</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-2 bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 mb-5">
          <h2 className="text-base sm:text-lg font-semibold text-slate-700 mb-4">
            {study.question.referenceHeading}
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {refs.map((r) => (
              <div key={r.label} className="flex flex-col">
                <div className={`text-center text-sm font-semibold mb-1 ${r.text}`}>
                  {r.label}
                  <span className="font-normal text-slate-400 ml-1 text-xs hidden sm:inline">— {r.sub}</span>
                </div>
                <Img
                  src={r.img}
                  alt={`Image ${r.label}`}
                  className={`border-2 ${r.border}`}
                  onClick={() => setZoom({ src: r.img, alt: `Image ${r.label}` })}
                />
              </div>
            ))}
          </div>
          <ChangePanel edits={sample.edits} camera={sample.camera} />
          {dome && (
            <section className="mt-5 rounded-xl border border-sky-200 bg-white p-3.5">
              <button
                onClick={() => setShowDome((v) => !v)}
                aria-expanded={showDome}
                className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-sky-700">Where is the camera?</span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  {showDome ? 'Hide' : 'Show'}
                  <ArrowIcon direction={showDome ? 'up' : 'down'} className="w-3.5 h-3.5" />
                </span>
              </button>
              {showDome && (
                <div className="max-w-3xl mx-auto mt-3">
                  <CameraDome pairs={dome} />
                </div>
              )}
            </section>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex items-start justify-between mb-1 gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {study.question.rankHeading.replace('best', `${nRanks} best`)}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {study.question.rankHelp} <strong>{RANK_LABELS[0]}</strong>. Click an image to enlarge it.
              </p>
            </div>
            <span
              className={`flex-shrink-0 text-sm font-medium px-3 py-1 rounded-full ${
                complete ? 'bg-green-100 text-green-700' : 'bg-indigo-50 text-indigo-600'
              }`}
            >
              {assigned}/{nRanks} ranked
            </span>
          </div>

          <div className="flex gap-3 my-4 flex-wrap">
            {RANK_LABELS.slice(0, nRanks).map((label, i) => (
              <div key={label} className="flex items-center gap-1.5 text-sm text-slate-500">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${badge(i)}`}>{label}</span>
                <span>= {rankName(i)}</span>
              </div>
            ))}
          </div>

          <div className={`grid grid-cols-2 md:grid-cols-3 ${LG_COLS[methods.length] ?? 'lg:grid-cols-5'} gap-4`}>
            {methods.map((method, idx) => {
              const r = ranks[method]
              const has = r !== undefined
              return (
                <div key={method} className="flex flex-col gap-2">
                  <div className={`relative rounded-xl ${has ? ring(r) : ''} transition-all duration-150`}>
                    {has && (
                      <div className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-xs font-bold border ${badge(r)}`}>
                        {RANK_LABELS[r]}
                      </div>
                    )}
                    {/* Method names are never shown to participants: outputs are labelled by position only. */}
                    <Img
                      src={sample.outputs[method]}
                      alt={`Output ${idx + 1}`}
                      onClick={() => setZoom({ src: sample.outputs[method], alt: `Image ${idx + 1}` })}
                    />
                  </div>
                  <div className="text-center text-xs font-semibold text-slate-500">Image {idx + 1}</div>
                  <div className="flex gap-1 justify-center">
                    {RANK_LABELS.slice(0, nRanks).map((label, i) => {
                      const mine = r === i
                      const taken = !mine && Object.values(ranks).includes(i)
                      return (
                        <button
                          key={label}
                          onClick={() => assign(method, i)}
                          title={taken ? `${label} is already given to another image. Click to move it here.` : `Mark as ${label}`}
                          className={`flex-1 text-xs font-semibold py-1.5 rounded-lg border transition-all duration-100 cursor-pointer ${
                            mine
                              ? `${badge(i)} shadow-sm`
                              : taken
                                ? 'bg-slate-50 border-slate-200 text-slate-300 hover:text-slate-500'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onBack(ranking())}
              title={currentIndex === 0 ? 'Back to the instructions' : 'Back to the previous question'}
              className="group inline-flex items-center gap-2 font-semibold text-base px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700 transition-all duration-150 cursor-pointer"
            >
              <ArrowIcon direction="left" className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Previous
            </button>
            <button
              onClick={() => window.confirm('Start over? Your answers so far will be discarded.') && onRestart()}
              className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2"
            >
              Start over
            </button>
          </div>
          <button
            onClick={() => onNext(ranking())}
            disabled={!complete}
            className={`group inline-flex items-center gap-2 font-semibold text-base px-8 py-3 rounded-xl shadow transition-all duration-150 ${
              complete
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            {currentIndex + 1 === total ? 'Submit Responses' : 'Next Question'}
            <ArrowIcon className={`w-4 h-4 transition-transform ${complete ? 'group-hover:translate-x-1' : ''}`} />
          </button>
        </div>
        {!complete && (
          <p className="text-right text-sm text-slate-400 mt-2">Assign {RANK_LABELS.slice(0, nRanks).join(', ')} to continue.</p>
        )}
      </div>

      <Lightbox image={zoom} onClose={() => setZoom(null)} />
    </div>
  )
}
