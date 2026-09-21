import { useCallback, useEffect, useRef, useState } from 'react'
import { submitResponse } from '../lib/responses.js'
import { ArrowIcon } from '../components/Arrows.jsx'

export default function ThankYouPage({ session, onSubmitted, onBack }) {
  const [status, setStatus] = useState('saving')
  const [copied, setCopied] = useState(false)
  const started = useRef(false)

  const send = useCallback(() => {
    setStatus('saving')
    submitResponse({
      sessionId: session.sessionId,
      studyId: session.studyId,
      startedAt: session.startedAt,
      rankings: session.rankings,
    })
      .then(() => {
        setStatus('success')
        onSubmitted()
      })
      .catch((err) => {
        console.error('Failed to save responses:', err)
        setStatus('error')
      })
  }, [session, onSubmitted])

  // Guard so React StrictMode's double effect in development doesn't submit twice.
  useEffect(() => {
    if (started.current) return
    started.current = true
    send()
  }, [send])

  const backup = JSON.stringify({ session_id: session.sessionId, study_id: session.studyId, rankings: session.rankings }, null, 2)

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full text-center">
        {status === 'saving' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
            <div className="flex justify-center mb-5">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-slate-700">Saving your responses…</h2>
            <p className="text-slate-400 mt-2 text-sm">Please keep this page open for a moment.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-3">Thank you!</h1>
            <p className="text-slate-600 leading-relaxed mb-6">
              Your responses have been recorded. Your feedback helps us build better AI image editing tools. We appreciate
              your time!
            </p>
            <div className="bg-slate-50 rounded-xl p-4 text-left text-sm text-slate-500">
              <p className="font-medium text-slate-600 mb-1">Session ID (for your records)</p>
              <code className="font-mono text-xs text-indigo-600 break-all">{session.sessionId}</code>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 sm:p-10">
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 8v4m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-3">Submission failed</h1>
            <p className="text-slate-600 leading-relaxed mb-5">
              We couldn't save your responses, probably because of a network problem. Your answers are kept in this browser,
              so you can try again. If it keeps failing, please copy the data below and send it to the researcher.
            </p>
            <div className="flex gap-3 justify-center mb-5">
              <button onClick={send} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl">
                Try again
              </button>
              <button
                onClick={() => navigator.clipboard?.writeText(backup).then(() => setCopied(true))}
                className="bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold px-6 py-2.5 rounded-xl"
              >
                {copied ? 'Copied ✓' : 'Copy data'}
              </button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-left text-xs text-slate-600 overflow-auto max-h-64">
              <pre className="whitespace-pre-wrap break-all">{backup}</pre>
            </div>
            {/* Only while nothing is saved: a saved response is final (Firestore rules forbid updates). */}
            <button
              onClick={onBack}
              className="group inline-flex items-center gap-2 mt-5 text-sm font-semibold text-slate-500 hover:text-indigo-700 cursor-pointer"
            >
              <ArrowIcon direction="left" className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              Previous: back to the last question
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
