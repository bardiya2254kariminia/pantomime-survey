import { useState } from 'react'
import { study } from '../config/study.js'

export default function ConsentPage({ onAgree }) {
  const [checked, setChecked] = useState(false)
  const c = study.consent

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-5">{c.title}</h1>
        <div className="space-y-3 text-slate-600 leading-relaxed mb-6">
          {c.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <label className="flex items-start gap-3 bg-slate-50 rounded-xl p-4 cursor-pointer mb-6">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 w-4 h-4 accent-indigo-600"
          />
          <span className="text-slate-700 text-sm">{c.checkbox}</span>
        </label>
        <div className="flex justify-end">
          <button
            onClick={onAgree}
            disabled={!checked}
            className={`font-semibold px-8 py-3 rounded-xl shadow transition-all duration-150 ${
              checked ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            I agree, continue →
          </button>
        </div>
      </div>
    </div>
  )
}
