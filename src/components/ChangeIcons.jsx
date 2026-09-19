// Icons for the two kinds of change a participant tracks: edits, and camera moves.
// Every camera icon shares one camera glyph and one curved-arrow shape.

export function EditsIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M11 2.5l1.7 4.8 4.8 1.7-4.8 1.7L11 15.5 9.3 10.7 4.5 9l4.8-1.7L11 2.5z" />
      <path d="M18 14l.85 2.4 2.4.85-2.4.85L18 20.5l-.85-2.4-2.4-.85 2.4-.85L18 14z" opacity="0.55" />
    </svg>
  )
}

const f = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`

// Elliptical arc from `from`° to `to`° (0 = right, 90 = bottom) with an arrowhead at `to`.
function arcArrow(cx, cy, rx, ry, from, to) {
  const rad = (d) => (d * Math.PI) / 180
  const pt = (d) => [cx + rx * Math.cos(rad(d)), cy + ry * Math.sin(rad(d))]
  const [sx, sy] = pt(from)
  const [ex, ey] = pt(to)
  const dir = Math.sign(to - from)
  let ux = -rx * Math.sin(rad(to)) * dir
  let uy = ry * Math.cos(rad(to)) * dir
  const len = Math.hypot(ux, uy)
  ux /= len
  uy /= len
  const [nx, ny] = [-uy, ux]
  return {
    d: `M ${f(sx, sy)} A ${rx} ${ry} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${dir > 0 ? 1 : 0} ${f(ex, ey)}`,
    head: [
      f(ex + ux * 5, ey + uy * 5),
      f(ex + nx * 4.2 - ux * 0.8, ey + ny * 4.2 - uy * 0.8),
      f(ex - nx * 4.2 - ux * 0.8, ey - ny * 4.2 - uy * 0.8),
    ].join(' '),
  }
}

function Arc({ from, to, cx, cy, rx, ry }) {
  const a = arcArrow(cx, cy, rx, ry, from, to)
  return (
    <>
      <path d={a.d} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <polygon points={a.head} fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </>
  )
}

function Camera({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-5.5" y="-10.5" width="8" height="4.5" rx="1.5" fill="currentColor" />
      <rect x="-11" y="-7.5" width="22" height="15" rx="3.5" fill="currentColor" />
      <circle r="4.8" fill="#fff" />
      <circle r="2.5" fill="currentColor" />
      <circle cx="7" cy="-4" r="1.1" fill="#fff" />
    </g>
  )
}

function Frame({ size, className, children }) {
  return (
    <svg viewBox="0 0 48 44" width={size} height={(size * 44) / 48} className={className} aria-hidden="true">
      {children}
    </svg>
  )
}

export function CameraIcon({ size = 32, className = '' }) {
  return (
    <Frame size={size} className={className}>
      <Camera x={24} y={22} />
    </Frame>
  )
}

// Azimuth: the orbit seen in perspective under the camera. Negative orbits right.
export function CameraOrbit({ degrees, size = 32, className = '' }) {
  const [from, to] = degrees < 0 ? [194, -14] : [-14, 194]
  return (
    <Frame size={size} className={className}>
      <Arc cx={24} cy={27} rx={19} ry={11.5} from={from} to={to} />
      <Camera x={24} y={14.5} />
    </Frame>
  )
}

// Elevation: the orbit seen from the side, beside the camera. Positive moves up.
export function CameraTilt({ degrees, size = 32, className = '' }) {
  const [from, to] = degrees > 0 ? [100, -100] : [-100, 100]
  return (
    <Frame size={size} className={className}>
      <Arc cx={22} cy={22} rx={20} ry={17} from={from} to={to} />
      <Camera x={16} y={22} />
    </Frame>
  )
}

// Zoom: the camera with a magnifier badge, + for zoom in and − for zoom out.
export function CameraZoom({ factor, size = 32, className = '' }) {
  return (
    <Frame size={size} className={className}>
      <Camera x={19} y={17} />
      <circle cx="35" cy="30" r="9.5" fill="currentColor" stroke="#fff" strokeWidth="2.5" />
      <g stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
        <path d="M30.5 30h9" />
        {factor > 1 && <path d="M35 25.5v9" />}
      </g>
    </Frame>
  )
}

export function CameraMoveIcon({ move, ...props }) {
  if (move.kind === 'azimuth') return <CameraOrbit degrees={move.value} {...props} />
  if (move.kind === 'elevation') return <CameraTilt degrees={move.value} {...props} />
  return <CameraZoom factor={move.value} {...props} />
}
