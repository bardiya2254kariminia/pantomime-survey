import { cameraMoves } from '../lib/camera.js'
import { CameraIcon, CameraMoveIcon, EditsIcon } from './ChangeIcons.jsx'

// What changed from A to A′, from the question's meta.json: its edits and its camera moves.
export default function ChangePanel({ edits = [], camera }) {
  const moves = camera ? cameraMoves(camera) : null
  if (!edits.length && !moves) return null

  return (
    <div className={`grid gap-3 mt-5 ${edits.length && moves ? 'md:grid-cols-2' : ''}`}>
      {edits.length > 0 && (
        <section className="rounded-xl border border-purple-200 bg-purple-50/70 p-3.5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-purple-700 mb-2.5">
            <EditsIcon className="w-4 h-4" />
            Edits
          </h3>
          <div className="flex flex-wrap gap-2">
            {edits.map((edit, i) => (
              <span key={i} className="rounded-full border border-purple-200 bg-white px-3 py-1 text-sm font-medium text-purple-800">
                {edit}
              </span>
            ))}
          </div>
        </section>
      )}

      {moves && (
        <section className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700 mb-2.5">
            <CameraIcon size={18} />
            Camera
          </h3>
          {moves.length ? (
            <div className="flex flex-wrap gap-2">
              {moves.map((move) => (
                <span
                  key={move.kind}
                  className="flex items-center gap-2 rounded-full border border-sky-200 bg-white pl-2 pr-3 py-1 text-sm text-sky-800"
                >
                  <CameraMoveIcon move={move} size={32} className="flex-shrink-0 text-sky-600" />
                  <span>
                    <span className="font-semibold">{move.label}</span> · {move.detail}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-sky-800">The camera does not move.</p>
          )}
        </section>
      )}
    </div>
  )
}
