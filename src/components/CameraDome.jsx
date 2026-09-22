import { useEffect, useId, useState } from 'react'
import { asset } from '../lib/asset.js'

// A dome around the subject that shows where each photo's camera stands, used on the
// welcome page (with a free "try it yourself" camera) and on every question.
// Seen from above and in front: the subject faces the viewer, so "front" (azimuth 0,
// elevation 0, the camera looking straight at the subject's face) is the near side.
// Azimuth follows study.js and the dataset: positive orbits left, negative orbits right
// (left and right as seen from the front camera, i.e. on screen).

const W = 860
const H = 540
const CX = 430
const CY = 300
const RX = 300 // horizon ellipse
const RY = 80
const DOME = 240 // dome height: tall enough that a camera 30° up at the front clears the subject

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

// The way from a point on the dome out of it, in screen space: where its snapshot and labels go.
function outward(p) {
  const dx = (p.x - CX) / RX
  const dy = (p.y - CY) / RY
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

// Plain-words pose, read after "the": "front", "left side", "back, toward the right, from above" …
function describePose({ az, el = 0, dist = 1 }) {
  const w = ((az + 540) % 360) - 180
  const a = Math.abs(w)
  const side = w > 0 ? 'left' : 'right'
  let where =
    a <= 15 ? 'front' : a >= 165 ? 'back' : a <= 65 ? `front, toward the ${side}` : a <= 115 ? `${side} side` : `back, toward the ${side}`
  if (el > 8) where += ', from above'
  if (dist > 1) where += ', farther away'
  return where
}

// "orbits 90° to the left and moves 30° up, and zooms out"
function describeMove({ az = 0, el = 0, dist = 0 }) {
  const parts = []
  if (az) parts.push(`orbits ${Math.abs(az)}° to the ${az > 0 ? 'left' : 'right'}`)
  if (el) parts.push(`moves ${Math.abs(el)}° ${el > 0 ? 'up' : 'down'}`)
  if (dist) parts.push(dist > 0 ? 'zooms out (moves farther away)' : 'zooms in (moves closer)')
  return parts.length ? parts.join(' and ') : 'stays where it is'
}

// Short form for the tag in the corner: "90° orbit left + 30° up + zoom out".
function moveLabel({ az = 0, el = 0, dist = 0 }) {
  const parts = []
  if (az) parts.push(`${Math.abs(az)}° orbit ${az > 0 ? 'left' : 'right'}`)
  if (el) parts.push(`${Math.abs(el)}° ${el > 0 ? 'up' : 'down'}`)
  if (dist) parts.push(dist > 0 ? 'zoom out' : 'zoom in')
  return parts.join(' + ') || 'no move'
}

// The camera: a star so it reads at a glance, with a camera body on it (as in the original figure).
function CameraStar({ x, y, faded, uid }) {
  return (
    <g transform={`translate(${x} ${y})`} filter={`url(#${uid}-shadow)`} opacity={faded ? 0.5 : 1}>
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

const SNAP = 92

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

// Where a camera's snapshot goes: just outside the dome in the camera's direction, or, if
// that spot is taken (two cameras can land close together on screen), the nearest free one.
function snapBox(pose, avoid = []) {
  const p = point(pose.az, pose.el)
  const o = outward(p)
  let first
  for (const d of [74, 104, 134]) {
    for (const turn of [0, 35, -35, 70, -70, 110, -110]) {
      const c = Math.cos(rad(turn))
      const s = Math.sin(rad(turn))
      const box = { x: p.x + (o.x * c - o.y * s) * d - SNAP / 2, y: p.y + (o.x * s + o.y * c) * d - SNAP / 2, w: SNAP, h: SNAP }
      first ??= box
      const inside = box.x >= 0 && box.y >= 0 && box.x + SNAP <= W && box.y + SNAP <= H
      if (inside && avoid.every((b) => !overlaps(box, b))) return box
    }
  }
  return first
}

// What the camera at `pose` sees, just outside the dome in the camera's direction.
// No `src` means the image is unknown -- the one participants must imagine -- shown as a question mark.
function Snapshot({ box, src, label, color, id, uid }) {
  const { x, y } = box
  const tag = label.length > 1 ? 30 : 22
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      {src ? (
        <>
          <clipPath id={`${uid}-snap-${id}`}>
            <rect width={SNAP} height={SNAP} rx="12" />
          </clipPath>
          <image href={asset(src)} width={SNAP} height={SNAP} clipPath={`url(#${uid}-snap-${id})`} preserveAspectRatio="xMidYMid slice" />
          <rect width={SNAP} height={SNAP} rx="12" fill="none" stroke={color} strokeWidth="3" />
        </>
      ) : (
        <>
          <rect width={SNAP} height={SNAP} rx="12" fill="#fff" stroke={color} strokeWidth="3" strokeDasharray="7 5" />
          <text x={SNAP / 2} y={SNAP / 2 + 20} textAnchor="middle" fontSize="56" fontWeight="800" fill={color}>
            ?
          </text>
        </>
      )}
      <rect x="5" y="5" width={tag} height="20" rx="5" fill={color} />
      <text x={5 + tag / 2} y="20" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">
        {label}
      </text>
    </g>
  )
}

// The subject(s) in the middle of the dome, as round front-view badges.
function Logo({ srcs, uid }) {
  const two = srcs.length > 1
  const r = two ? 32 : 38
  const offsets = two ? [-25, 25] : [0]
  return (
    <g transform={`translate(${CX} ${CY})`} filter={`url(#${uid}-shadow)`}>
      {srcs.map((src, i) => (
        <g key={src} transform={`translate(${offsets[i]} 0)`}>
          <circle r={r + 3} fill="#fff" stroke="#b9d7ef" strokeWidth="2" />
          <image href={asset(src)} x={-r} y={-r} width={r * 2} height={r * 2} />
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

// The "front" label: the first spot that is clear of every snapshot and camera.
function frontLabel(boxes) {
  const long = 'front (the way the subject faces)'
  const w = (text) => text.length * 8.2
  const spots = [
    { text: long, x: CX - 30, anchor: 'end', y: CY + RY + 24 },
    { text: long, x: CX + 30, anchor: 'start', y: CY + RY + 24 },
    { text: 'front', x: CX - 30, anchor: 'end', y: CY + RY + 24 },
    { text: 'front', x: CX + 30, anchor: 'start', y: CY + RY + 24 },
    { text: 'front', x: CX, anchor: 'middle', y: CY + RY - 14 },
  ]
  const box = (s) => ({
    x: s.anchor === 'end' ? s.x - w(s.text) : s.anchor === 'start' ? s.x : s.x - w(s.text) / 2,
    y: s.y - 14,
    w: w(s.text),
    h: 18,
  })
  return spots.find((s) => boxes.every((b) => !overlaps(box(s), b))) ?? spots[spots.length - 1]
}

// `pairs`: [{ id, tab, from: {az, el, dist}, move: {az, el, dist}, imgs: [before, after|null],
//             labels: ['A', 'A′'], color, logos: [src], note }]
// `explore`: logos for an extra "Try it yourself" tab with a free camera, or nothing for no such tab.
export default function CameraDome({ pairs, explore }) {
  // Several domes can share a page (one per pair on each question), so SVG ids must be unique.
  const uid = `dome${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [tab, setTab] = useState(pairs[0].id)
  const [replay, setReplay] = useState(0)
  const [az, setAz] = useState(45)
  const [el, setEl] = useState(30)
  const t = useProgress(`${tab}-${replay}`)
  const [reduceMotion] = useState(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  const tabs = [...pairs.map((p) => ({ id: p.id, label: p.tab })), ...(explore ? [{ id: 'explore', label: 'Try it yourself' }] : [])]
  const found = pairs.find((p) => p.id === tab)
  const pair = found && {
    ...found,
    from: { el: 0, dist: 1, ...found.from },
    to: {
      az: found.from.az + (found.move.az ?? 0),
      el: (found.from.el ?? 0) + (found.move.el ?? 0),
      dist: (found.from.dist ?? 1) + (found.move.dist ?? 0),
    },
  }

  // Pair tabs animate the camera from the first photo's pose to the second's.
  const cam = pair ? { az: pair.from.az + (pair.to.az - pair.from.az) * t, el: pair.from.el + (pair.to.el - pair.from.el) * t } : { az, el }
  const camPt = point(cam.az, cam.el)
  const ground = point(cam.az, 0)
  const moved = pair && (Math.abs(pair.to.az - pair.from.az) > 0 || Math.abs(pair.to.el - pair.from.el) > 0)

  const cams = pair ? [pair.from, pair.to, cam] : [cam]
  const camBoxes = cams.map((c) => {
    const p = point(c.az, c.el)
    return { x: p.x - 24, y: p.y - 24, w: 48, h: 48 }
  })
  const logoBox = { x: CX - 62, y: CY - 44, w: 124, h: 88 }
  const cornerBox = { x: 0, y: 0, w: 360, h: 60 } // the move tag
  const snaps = []
  if (pair) {
    snaps.push(snapBox(pair.from, [...camBoxes.slice(0, 2), logoBox, cornerBox]))
    snaps.push(snapBox(pair.to, [...camBoxes.slice(0, 2), logoBox, cornerBox, snaps[0]]))
  }
  const front = frontLabel([...snaps, ...camBoxes])
  const moveText = pair && moveLabel(pair.move)

  const sides = [
    { az: 180, text: 'back', dy: 26 },
    { az: 90, text: 'left', dx: 34, dy: 5 },
    { az: -90, text: 'right', dx: -34, dy: 5 },
  ]
  const logos = pair ? pair.logos : explore

  return (
    <div>
      {tabs.length > 1 && (
        <div className="flex flex-wrap justify-center gap-1.5 mb-3" role="tablist">
          {tabs.map((x) => (
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
      )}

      <div className="rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50/60 to-white p-2 sm:p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label="Camera positions on a dome around the subject">
          <defs>
            <filter id={`${uid}-shadow`} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#2d79af" floodOpacity=".16" />
            </filter>
            <marker id={`${uid}-arrow-red`} markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" viewBox="0 0 10 10" refX="8" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill={RED} />
            </marker>
            <marker id={`${uid}-arrow-blue`} markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" viewBox="0 0 10 10" refX="8" refY="5" orient="auto">
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
          {sides
            .filter((l) => cams.every((c) => c.el > 25 || Math.abs(((c.az - l.az + 540) % 360) - 180) > 30))
            .map((l) => {
              const p = point(l.az)
              return (
                <text key={l.text} x={p.x + (l.dx ?? 0)} y={p.y + (l.dy ?? 0)} textAnchor="middle" fontSize="15" fontWeight="700" fill="#6f859a">
                  {l.text}
                </text>
              )
            })}

          <Logo srcs={logos} uid={uid} />
          <path d={`M ${CX - RX} ${CY} A ${RX} ${RY} 0 0 0 ${CX + RX} ${CY}`} fill="none" stroke="#92b4d4" strokeWidth="2.2" />
          {/* "front": where the subject is looking */}
          <path d={`M ${CX} ${CY + 44} L ${CX} ${CY + RY - 4}`} stroke="#aac3da" strokeWidth="2" strokeDasharray="3 4" />
          <text x={front.x} y={front.y} textAnchor={front.anchor} fontSize="15" fontWeight="700" fill="#6f859a">
            {front.text}
          </text>

          {/* ray from the subject to the camera, and its foot on the horizon */}
          <line x1={CX} y1={CY} x2={camPt.x} y2={camPt.y} stroke="#adb8c4" strokeWidth="1.8" />
          {cam.el > 1.5 && <circle cx={ground.x} cy={ground.y} r="5" fill="#97a9bb" />}

          {pair ? (
            moved && (
              <>
                <path d={arcPath(pair.from, cam)} fill="none" stroke={RED} strokeWidth="3.4" strokeDasharray="7 5" markerEnd={`url(#${uid}-arrow-red)`}>
                  {/* dashes march from the first camera to the second */}
                  {!reduceMotion && <animate attributeName="stroke-dashoffset" from="24" to="0" dur="0.8s" repeatCount="indefinite" />}
                </path>
              </>
            )
          ) : (
            <>
              {Math.abs(cam.az) > 2 && (
                <>
                  <path d={arcPath({ az: 0, el: 0 }, { az: cam.az, el: 0 })} fill="none" stroke={RED} strokeWidth="3.4" strokeDasharray="7 5" markerEnd={`url(#${uid}-arrow-red)`} />
                  <text x={point(cam.az / 2).x} y={point(cam.az / 2).y + 36} textAnchor="middle" fontSize="18" fontWeight="850" fill={RED}>
                    azimuth
                  </text>
                </>
              )}
              {/* elevation arc (hidden near 0° to avoid clutter) */}
              {cam.el > 1.5 && (
                <>
                  <path d={arcPath({ az: cam.az, el: 0 }, cam)} fill="none" stroke={BLUE} strokeWidth="3.4" strokeDasharray="7 5" markerEnd={`url(#${uid}-arrow-blue)`} />
                  <text x={camPt.x + (cam.az <= 0 ? 24 : -24)} y={camPt.y - 16} textAnchor={cam.az <= 0 ? 'start' : 'end'} fontSize="18" fontWeight="850" fill={BLUE}>
                    elevation
                  </text>
                </>
              )}
            </>
          )}

          {pair && (
            <>
              <CameraStar {...point(pair.from.az, pair.from.el)} faded uid={uid} />
              <Snapshot box={snaps[0]} src={pair.imgs[0]} label={pair.labels[0]} color={pair.color} id={`${pair.id}-0`} uid={uid} />
              {t > 0.98 && <Snapshot box={snaps[1]} src={pair.imgs[1]} label={pair.labels[1]} color={pair.color} id={`${pair.id}-1`} uid={uid} />}
            </>
          )}
          <CameraStar x={camPt.x} y={camPt.y} uid={uid} />

          {/* once the camera has arrived: arrowheads keep flowing along the move, start → end */}
          {pair && moved && t > 0.98 && !reduceMotion && (
            <g key={`${tab}-${replay}`}>
              {[0, 0.6, 1.2].map((delay) => (
                <path key={delay} d="M-7 -7.5 L3 0 L-7 7.5" fill="none" stroke={RED} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0">
                  <animateMotion dur="1.8s" begin={`${delay}s`} repeatCount="indefinite" rotate="auto" path={arcPath(pair.from, pair.to)} keyPoints="0.12;0.88" keyTimes="0;1" calcMode="linear" />
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.8;1" dur="1.8s" begin={`${delay}s`} repeatCount="indefinite" />
                </path>
              ))}
            </g>
          )}

          {pair && (
            <g transform="translate(20 18)">
              <rect width={moveText.length * 8.6 + 96} height="32" rx="16" fill="#fff" stroke="#f3c4c3" strokeWidth="1.5" />
              <text x="16" y="21" fontSize="14" fontWeight="700" fill="#6f859a">
                move:{' '}
                <tspan fontWeight="850" fill={RED}>
                  {moveText}
                </tspan>
              </text>
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
          <strong>{describePose(pair.from)}</strong>.{' '}
          <span className="font-semibold" style={{ color: pair.color }}>{pair.labels[1]}</span> is taken after the camera{' '}
          <strong className="text-[#ef5350]">{describeMove(pair.move)}</strong>, from the <strong>{describePose(pair.to)}</strong>.
          {pair.note && ` ${pair.note}`}{' '}
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
            The camera is at the <strong>{describePose({ az, el })}</strong>. Drag the sliders to move it around the subject.
          </p>
        </>
      )}
    </div>
  )
}
