// Turns a camera pose change from meta.json into the moves shown to participants.
// azimuth: degrees, negative orbits right. elevation: degrees, positive moves up. zoom: factor, 1 = unchanged.
const signed = (n) => `${n < 0 ? '−' : '+'}${Math.abs(n)}`

export function cameraMoves({ azimuth = 0, elevation = 0, zoom = 1 } = {}) {
  const moves = []
  if (azimuth) {
    moves.push({
      kind: 'azimuth',
      value: azimuth,
      label: `${signed(azimuth)}° azimuth`,
      detail: azimuth < 0 ? 'orbits right' : 'orbits left',
    })
  }
  if (elevation) {
    moves.push({
      kind: 'elevation',
      value: elevation,
      label: `${signed(elevation)}° elevation`,
      detail: elevation > 0 ? 'moves up' : 'moves down',
    })
  }
  if (zoom !== 1) {
    moves.push({ kind: 'zoom', value: zoom, label: `${zoom}× zoom`, detail: zoom > 1 ? 'zooms in' : 'zooms out' })
  }
  return moves
}
