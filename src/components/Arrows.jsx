const ROTATE = { right: '', left: 'rotate-180', up: '-rotate-90', down: 'rotate-90' }

// Inline arrow used in buttons and captions, so every arrow on the site shares one shape.
export function ArrowIcon({ direction = 'right', className = '' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${ROTATE[direction]} ${className}`}
      aria-hidden="true"
    >
      <path d="M4 10h11.5M11 5.5 15.5 10 11 14.5" />
    </svg>
  )
}

const TONES = {
  indigo: { from: '#c7d2fe', to: '#6366f1', pill: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200', icons: 'text-indigo-600' },
  emerald: { from: '#a7f3d0', to: '#10b981', pill: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', icons: 'text-emerald-600' },
}

// Connector between two images: optional icons above, gradient arrow, label pill below.
export function FlowArrow({ label, tone = 'indigo', icons }) {
  const t = TONES[tone]
  const id = `flow-arrow-${tone}`
  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-20 sm:w-36">
      {icons && <div className={`flex items-end justify-center gap-1 ${t.icons}`}>{icons}</div>}
      <svg viewBox="0 0 100 20" className="w-full h-auto overflow-visible" aria-hidden="true">
        <defs>
          {/* userSpaceOnUse: a horizontal line has a zero-height bounding box, which breaks the default units. */}
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="5" y1="10" x2="92" y2="10">
            <stop offset="0" stopColor={t.from} />
            <stop offset="1" stopColor={t.to} />
          </linearGradient>
        </defs>
        <circle cx="5" cy="10" r="3.5" fill={t.from} />
        <path d="M12 10H90" stroke={`url(#${id})`} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M82 3.5 92 10 82 16.5" fill="none" stroke={t.to} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold text-center leading-tight sm:whitespace-nowrap ${t.pill}`}>
        {label}
      </span>
    </div>
  )
}
