import { study, RANK_LABELS } from '../config/study.js'
import { asset } from '../lib/asset.js'

function ExampleImage({ src, label, caption, border, tag, goal }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <img
          src={asset(src)}
          alt={`Image ${label}: ${caption}`}
          className={`w-28 h-28 sm:w-32 sm:h-32 object-contain rounded-xl border-2 ${border} shadow-sm bg-slate-100`}
        />
        <span className={`absolute top-1 left-1 ${tag} text-white text-xs font-bold px-1.5 py-0.5 rounded-md leading-tight`}>
          {label}
        </span>
        {goal && (
          <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold shadow">
            goal
          </span>
        )}
      </div>
      <span className="text-xs text-slate-500">{caption}</span>
    </div>
  )
}

function Arrow({ text, color }) {
  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <div className="flex items-center gap-1">
        <div className={`w-6 sm:w-8 h-0.5 ${color.bar}`} />
        <svg viewBox="0 0 10 10" className={`w-3 h-3 ${color.head}`} aria-hidden="true">
          <path d="M1 1l8 4-8 4z" fill="currentColor" />
        </svg>
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${color.text}`}>{text}</span>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm">
        {n}
      </div>
      <div>
        <p className="font-medium text-slate-800">{title}</p>
        <p className="text-slate-500 text-sm mt-0.5">{children}</p>
      </div>
    </div>
  )
}

export default function WelcomePage({ onStart }) {
  const ex = study.welcomeExample
  const nRanks = RANK_LABELS.length
  const indigo = { bar: 'bg-indigo-400', head: 'text-indigo-500', text: 'text-indigo-600' }
  const emerald = { bar: 'bg-emerald-500', head: 'text-emerald-600', text: 'text-emerald-700' }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-10">
          <div className="inline-block bg-indigo-100 text-indigo-700 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
            {study.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">{study.title}</h1>
          <p className="text-lg text-slate-500">{study.subtitle}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">What is this task about?</h2>
          <p className="text-slate-600 leading-relaxed mb-5">
            In each question you will see 3 input images named <strong>A</strong>, <strong>A′</strong>, and{' '}
            <strong>B</strong>.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 sm:p-5 mb-5">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-5 text-center">How the task works</p>

            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
              <ExampleImage src={ex.a} label="A" caption="Example" border="border-indigo-300" tag="bg-indigo-600" />
              <Arrow text="the change" color={indigo} />
              <ExampleImage src={ex.a_prime} label="A′" caption="Example, changed" border="border-indigo-400" tag="bg-indigo-700" />
            </div>
            <p className="text-center text-xs text-indigo-500 font-medium mb-4">
              ↑ A → A′ demonstrates a change ({ex.change})
            </p>

            <div className="border-t border-slate-200 mb-4" />

            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
              <ExampleImage src={ex.b} label="B" caption="New subject" border="border-emerald-300" tag="bg-emerald-600" />
              <Arrow text="same change" color={emerald} />
              <ExampleImage src={ex.b_prime} label="B′" caption="Output (ideal)" border="border-emerald-500" tag="bg-emerald-700" goal />
            </div>
            <p className="text-center text-xs text-emerald-700 font-medium">↑ B′ is B with the same change applied</p>
          </div>

          <p className="text-slate-600 leading-relaxed">
            Image <strong>A′</strong> is a changed version of image <strong>A</strong>. By comparing <strong>A</strong> and{' '}
            <strong>A′</strong> you can see what changed: for example the camera moved around the subject, the subject
            changed its pose, or something was added. Image <strong>B</strong> shows a <strong>different</strong> subject.
            The goal of the AI methods is to produce <strong>B′</strong>: image <strong>B</strong> with{' '}
            <strong>the same change</strong> applied, while keeping the subject of B recognisable.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-7 mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Your job in this study</h2>
          <div className="space-y-4">
            <Step n={1} title="Look at the images A and A′">See what changed between them.</Step>
            <Step n={2} title="Look at image B">This is the image the AI methods are trying to change.</Step>
            <Step n={3} title="Imagine the ideal result B′">B, changed in the same way that A was changed into A′.</Step>
            <Step n={4} title={`Rank the ${nRanks} best AI outputs`}>
              For each question you will see several AI-generated results. Pick the best {nRanks} and rank them as{' '}
              <strong>{RANK_LABELS.join(', ')}</strong>. Click any image to enlarge it.
            </Step>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-6">
          <p className="text-slate-700 text-sm leading-relaxed text-center">{study.question.goodOutput}</p>
        </div>

        <div className="text-center">
          <p className="text-slate-500 text-sm mb-5">
            ⏱ Estimated time: <strong>{study.estimatedTime}</strong> &nbsp;·&nbsp; No sign-in required
          </p>
          <button
            onClick={onStart}
            className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-lg px-10 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-150"
          >
            Start Study →
          </button>
        </div>
      </div>
    </div>
  )
}
