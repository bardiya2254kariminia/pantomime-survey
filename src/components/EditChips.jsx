// Red "skipped" / green "applied" edit lists, as on the reference site. Each list is optional.
export default function EditChips({ applied = [], skipped = [] }) {
  if (!applied.length && !skipped.length) return null

  return (
    <div className={`grid gap-4 mb-5 ${applied.length && skipped.length ? 'sm:grid-cols-2' : ''}`}>
      {skipped.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold">✕</span>
            <span className="text-sm font-semibold text-red-700">Skipped edits (should NOT appear in the output)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {skipped.map((e) => (
              <span key={e} className="bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full border border-red-200">{e}</span>
            ))}
          </div>
        </div>
      )}
      {applied.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs font-bold">✓</span>
            <span className="text-sm font-semibold text-green-700">Applied edits (SHOULD appear in the output)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {applied.map((e) => (
              <span key={e} className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full border border-green-200">{e}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
