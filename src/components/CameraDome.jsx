import { useEffect, useState } from 'react'
import { asset } from '../lib/asset.js'

// A dome around the subject that shows where each photo's camera stands.
// Seen from above and in front: the subject faces the viewer, so "front" (azimuth 0,
// elevation 0, the camera looking straight at the subject's face) is the near side.
// Azimuth follows study.js and the dataset: positive orbits left, negative orbits right
// (left and right as seen from the front camera, i.e. on screen).

const W = 860
const H = 500
const CX = 430
const CY = 280
const RX = 300 // horizon ellipse
const RY = 80
const DOME = 200 // dome height

const RED = '#ef5350'
const BLUE = '#2a7fbe'
const rad = (d) => (d * Math.PI) / 180
const fmt = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v))}°`

function point(az, el = 0) {
  const x = Math.sin(rad(az)) * Math.cos(rad(el))
  const z = Math.cos(rad(az)) * Math.cos(rad(el))
  return { x: CX - RX * x, y: CY + RY * z - DOME * Math.sin(rad(el)) }
}

// Polyline along the sphere between two poses; used for both arcs so they follow the dome.
function arcPath(from, to) {
  const steps = Math.max(2, Math.ceil(Math.max(Math.abs(to.az - from.az), Math.abs(to.el - from.el)) / 3))
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    return point(from.az + (to.az - from.az) * t, from.el + (to.el - from.el) * t)
  })
  return pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

// Plain-words pose, read after "the": "front", "left side", "back, toward the right" …
function describePose(az, el = 0) {
  const a = Math.abs(az)
  const side = az > 0 ? 'left' : 'right'
  const where =
    a <= 15 ? 'front' : a >= 165 ? 'back' : a <= 65 ? `front, toward the ${side}` : a <= 115 ? `${side} side` : `back, toward the ${side}`
  return el > 8 ? `${where}, from above` : where
}

// The camera: a star so it reads at a glance, with a camera body on it (as in the original figure).
function CameraStar({ x, y, faded }) {
  return (
    <g transform={`translate(${x} ${y})`} filter="url(#dome-shadow)" opacity={faded ? 0.5 : 1}>
      <path
        d="M0 -22 L6 -8 L21 -6.5 L9.5 3 L13 18.5 L0 10.5 L-13 18.5 L-9.5 3 L-21 -6.5 L-6 -8 Z"
        fill="#fff"
        stroke="#222"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <rect x="-9" y="-5.5" width="18" height="11.5" rx="3.4" fill="#222" />
      <rect x="-4.2" y="-9" width="8.4" height="3.6" rx="1.6" fill="#222" />
      <circle cy="0.2" r="3.5" fill="#fff" />
      <circle cy="0.2" r="1.6" fill="#222" />
    </g>
  )
}

// What the camera at `pose` sees, placed just outside the dome in the direction of the camera.
function Snapshot({ pose, src, label, color }) {
  const p = point(pose.az, pose.el)
  const dx = (p.x - CX) / RX
  const dy = (p.y - CY) / RY
  const len = Math.hypot(dx, dy) || 1
  const S = 92
  const x = p.x + (dx / len) * 74 - S / 2
  const y = p.y + (dy / len) * 74 - S / 2
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <clipPath id={`dome-snap-${label}`}>
        <rect width={S} height={S} rx="12" />
      </clipPath>
      <image href={asset(src)} width={S} height={S} clipPath={`url(#dome-snap-${label})`} preserveAspectRatio="xMidYMid slice" />
      <rect width={S} height={S} rx="12" fill="none" stroke={color} strokeWidth="3" />
      <rect x="5" y="5" width={label.length > 1 ? 30 : 22} height="20" rx="5" fill={color} />
      <text x={label.length > 1 ? 20 : 16} y="20" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">
        {label}
      </text>
    </g>
  )
}

function Logo({ subjects }) {
  const r = subjects.length > 1 ? 36 : 44
  const offsets = subjects.length > 1 ? [-28, 28] : [0]
  return (
    <g transform={`translate(${CX} ${CY})`} filter="url(#dome-shadow)">
      {subjects.map((s, i) => (
        <g key={s} transform={`translate(${offsets[i]} 0)`}>
          <circle r={r + 3} fill="#fff" stroke="#b9d7ef" strokeWidth="2" />
          <image href={asset(`welcome/logo_${s}.png`)} x={-r} y={-r} width={r * 2} height={r * 2} />
        </g>
      ))}
    </g>
  )
}

// Moves 0 → 1 over `ms` whenever `key` changes (instantly if the viewer prefers reduced motion).
function useProgress(key, ms = 1400) {
  const [t, setT] = useState(1)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setT(1)
    let frame
    const start = performance.now()
    const tick = (now) => {
      const k = Math.min(1, (now - start) / ms)
      setT(1 - (1 - k) ** 3)
      if (k < 1) frame = requestAnimationFrame(tick)
    }
    setT(0)
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [key, ms])
  return t
}

const TABS = [
  { id: 'a', label: 'Example: A → A′' },
  { id: 'b', label: 'Goal: B → B′' },
  { id: 'explore', label: 'Try it yourself' },
]

export default function CameraDome({ example }) {
  const [tab, setTab] = useState('a')
  const [replay, setReplay] = useState(0)
  const [az, setAz] = useState(45)
  const [el, setEl] = useState(30)
  const t = useProgress(`${tab}-${replay}`)
  const [reduceMotion] = useState(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  const move = example.cameraAzimuth
  const pairs = {
    a: {
      from: { az: example.poses.a, el: 0 },
      to: { az: example.poses.a + move, el: 0 },
      imgs: [example.a, example.a_prime],
      labels: ['A', 'A′'],
      color: '#6366f1',
      subject: 'dog',
    },
    b: {
      from: { az: example.poses.b, el: 0 },
      to: { az: example.poses.b + move, el: 0 },
      imgs: [example.b, example.b_prime],
      labels: ['B', 'B′'],
      color: '#10b981',
      subject: 'cat',
    },
  }
  const pair = pairs[tab]

  // Pair tabs animate the camera from the first photo's pose to the second's.
  const cam = pair
    ? { az: pair.from.az + (pair.to.az - pair.from.az) * t, el: 0 }
    : { az, el }
  const camPt = point(cam.az, cam.el)
  const ground = point(cam.az, 0)
  const azFrom = pair ? pair.from : { az: 0, el: 0 }
  const shownAz = pair ? pair.to.az - pair.from.az : az
  const azMid = point((azFrom.az + cam.az) / 2, 0)

  const cams = pair ? [pair.from, pair.to, cam] : [cam]
  // "front" goes on the side the orbit does not pass through.
  const frontLeft = (pair ? pair.to.az : az) <= 0
  const labels = [
    { az: 180, text: 'back', dy: 26 },
    { az: 90, text: 'left', dx: 34, dy: 5 },
    { az: -90, text: 'right', dx: -34, dy: 5 },
  ]

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-1.5 mb-3" role="tablist">
        {TABS.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => (tab === x.id ? setReplay((n) => n + 1) : setTab(x.id))}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors cursor-pointer ${
              tab === x.id
                ? 'bg-sky-600 border-sky-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:text-sky-700'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50/60 to-white p-2 sm:p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label="Camera positions on a dome around the subject">
          <defs>
            <filter id="dome-shadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#2d79af" floodOpacity=".16" />
            </filter>
            <marker id="dome-arrow-red" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" viewBox="0 0 10 10" refX="8" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill={RED} />
            </marker>
            <marker id="dome-arrow-blue" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" viewBox="0 0 10 10" refX="8" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill={BLUE} />
            </marker>
          </defs>

          {/* dome: far half of the horizon dashed, near half solid */}
          <path d={`M ${CX - RX} ${CY} A ${RX} ${DOME} 0 0 1 ${CX + RX} ${CY} A ${RX} ${RY} 0 0 1 ${CX - RX} ${CY} Z`} fill="#f4f9fe" />
          <path d={`M ${CX - RX} ${CY} A ${RX} ${DOME} 0 0 1 ${CX + RX} ${CY}`} fill="none" stroke="#92b4d4" strokeWidth="2.2" />
          <path d={`M ${CX - RX} ${CY} A ${RX} ${RY} 0 0 1 ${CX + RX} ${CY}`} fill="none" stroke="#92b4d4" strokeWidth="2" strokeDasharray="5 6" />
          <text x={CX} y={CY - DOME - 12} textAnchor="middle" fontSize="18" fontWeight="800" fill="#17324a">
            top
          </text>
          {labels.filter((l) => cams.every((c) => c.el > 25 || Math.abs(((c.az - l.az + 540) % 360) - 180) > 30)).map((l) => {
            const p = point(l.az)
            return (
              <text key={l.text} x={p.x + (l.dx ?? 0)} y={p.y + (l.dy ?? 0)} textAnchor="middle" fontSize="15" fontWeight="700" fill="#6f859a">
                {l.text}
              </text>
            )
          })}

          <Logo subjects={pair ? [pair.subject] : ['dog', 'cat']} />
          <path d={`M ${CX - RX} ${CY} A ${RX} ${RY} 0 0 0 ${CX + RX} ${CY}`} fill="none" stroke="#92b4d4" strokeWidth="2.2" />
          {/* "front": where the subject is looking */}
          <path d={`M ${CX} ${CY + 50} L ${CX} ${CY + RY - 4}`} stroke="#aac3da" strokeWidth="2" strokeDasharray="3 4" />
          <text x={frontLeft ? CX - 30 : CX + 30} y={CY + RY + 24} textAnchor={frontLeft ? 'end' : 'start'} fontSize="15" fontWeight="700" fill="#6f859a">
            front (the way the subject faces)
          </text>

          {/* ray from the subject to the camera, and its foot on the horizon */}
          <line x1={CX} y1={CY} x2={camPt.x} y2={camPt.y} stroke="#adb8c4" strokeWidth="1.8" />
          {cam.el > 1.5 && <circle cx={ground.x} cy={ground.y} r="5" fill="#97a9bb" />}

          {/* azimuth arc */}
          {Math.abs(cam.az - azFrom.az) > 2 && (
            <>
              <path d={arcPath(azFrom, { az: cam.az, el: 0 })} fill="none" stroke={RED} strokeWidth="3.4" strokeDasharray="7 5" markerEnd="url(#dome-arrow-red)">
                {/* dashes march from the first camera to the second */}
                {pair && !reduceMotion && <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.8s" repeatCount="indefinite" />}
              </path>
              <text x={azMid.x} y={azMid.y + 36} textAnchor="middle" fontSize="18" fontWeight="850" fill={RED}>
                {pair ? `${Math.abs(shownAz)}° orbit` : 'azimuth'}
              </text>
            </>
          )}

          {/* elevation arc (hidden near 0° to avoid clutter) */}
          {cam.el > 1.5 && (
            <>
              <path d={arcPath({ az: cam.az, el: 0 }, cam)} fill="none" stroke={BLUE} strokeWidth="3.4" strokeDasharray="7 5" markerEnd="url(#dome-arrow-blue)" />
              <text x={camPt.x + (cam.az <= 0 ? 24 : -24)} y={camPt.y - 16} textAnchor={cam.az <= 0 ? 'start' : 'end'} fontSize="18" fontWeight="850" fill={BLUE}>
                elevation
              </text>
            </>
          )}

          {pair && (
            <>
              <CameraStar {...point(pair.from.az)} faded />
              <Snapshot pose={pair.from} src={pair.imgs[0]} label={pair.labels[0]} color={pair.color} />
              {t > 0.98 && <Snapshot pose={pair.to} src={pair.imgs[1]} label={pair.labels[1]} color={pair.color} />}
            </>
          )}
          <CameraStar x={camPt.x} y={camPt.y} />

          {/* once the camera has arrived: arrowheads keep flowing along the orbit, start → end */}
          {pair && t > 0.98 && !reduceMotion && (
            <g key={`${tab}-${replay}`}>
              {[0, 0.6, 1.2].map((delay) => (
                <path key={delay} d="M-7 -7.5 L3 0 L-7 7.5" fill="none" stroke={RED} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0">
                  <animateMotion dur="1.8s" begin={`${delay}s`} repeatCount="indefinite" rotate="auto" path={arcPath(pair.from, pair.to)} keyPoints="0.12;0.88" keyTimes="0;1" calcMode="linear" />
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.8;1" dur="1.8s" begin={`${delay}s`} repeatCount="indefinite" />
                </path>
              ))}
            </g>
          )}

          {!pair && (
            <g transform="translate(24 20)">
              <rect width="150" height="32" rx="16" fill="#fff" stroke="#d0e2f2" strokeWidth="1.5" />
              <text x="75" y="21" textAnchor="middle" fontSize="14" fontWeight="850" fill={RED}>
                azimuth: {fmt(az)}
              </text>
              <rect x="160" width="160" height="32" rx="16" fill="#fff" stroke="#d0e2f2" strokeWidth="1.5" />
              <text x="240" y="21" textAnchor="middle" fontSize="14" fontWeight="850" fill={BLUE}>
                elevation: {fmt(el)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {pair ? (
        <p className="mt-3 text-sm text-slate-600 text-center leading-relaxed">
          <span className="font-semibold" style={{ color: pair.color }}>{pair.labels[0]}</span> is taken from the{' '}
          <strong>{describePose(pair.from.az)}</strong>.{' '}
          <span className="font-semibold" style={{ color: pair.color }}>{pair.labels[1]}</span> is taken after the camera orbits{' '}
          <strong className="text-[#ef5350]">{Math.abs(move)}°</strong> to the {move < 0 ? 'right' : 'left'}, from the{' '}
          <strong>{describePose(pair.to.az)}</strong>.
          {tab === 'b' && ' The same camera move as in A → A′.'}{' '}
          <button onClick={() => setReplay((n) => n + 1)} className="text-sky-600 hover:text-sky-800 underline underline-offset-2 cursor-pointer">
            Replay
          </button>
        </p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <label className="rounded-xl border border-sky-100 bg-sky-50/50 px-3.5 py-2.5">
              <span className="flex justify-between text-xs font-bold tracking-wide text-slate-700 mb-1">
                AZIMUTH (around) <span style={{ color: RED }}>{fmt(az)}</span>
              </span>
              <input type="range" min="-180" max="180" value={az} onChange={(e) => setAz(+e.target.value)} className="w-full accent-sky-600" />
            </label>
            <label className="rounded-xl border border-sky-100 bg-sky-50/50 px-3.5 py-2.5">
              <span className="flex justify-between text-xs font-bold tracking-wide text-slate-700 mb-1">
                ELEVATION (up) <span style={{ color: BLUE }}>{fmt(el)}</span>
              </span>
              <input type="range" min="0" max="90" value={el} onChange={(e) => setEl(+e.target.value)} className="w-full accent-sky-600" />
            </label>
          </div>
          <p className="mt-2.5 text-sm text-slate-600 text-center">
            The camera is at the <strong>{describePose(az, el)}</strong>. Drag the sliders to move it around the subject.
          </p>
        </>
      )}
    </div>
  )
}
