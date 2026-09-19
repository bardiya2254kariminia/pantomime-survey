// Turns raw responses into per-method statistics and flat CSV exports.
// Points: with N ranks per question, 1st = N points, 2nd = N-1, …, last rank = 1 (Borda count).

function ranksOf(r) {
  // rank1, rank2, … → [method, method, …] in rank order
  return Object.keys(r)
    .filter((k) => /^rank\d+$/.test(k))
    .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)))
    .map((k) => r[k])
}

export function methodStats(responses, samples) {
  const methods = new Set(samples.flatMap((s) => Object.keys(s.outputs)))
  const nRanks = Math.max(1, ...responses.flatMap((resp) => resp.rankings.map((r) => ranksOf(r).length)))
  const stats = {}
  for (const m of methods) stats[m] = { method: m, counts: Array(nRanks).fill(0), points: 0, shown: 0 }

  for (const resp of responses) {
    for (const r of resp.rankings) {
      const shown = r.display_order ?? Object.keys(samples.find((s) => s.id === r.sample_id)?.outputs ?? {})
      for (const m of shown) {
        stats[m] ??= { method: m, counts: Array(nRanks).fill(0), points: 0, shown: 0 }
        stats[m].shown++
      }
      ranksOf(r).forEach((m, i) => {
        if (!m) return
        stats[m] ??= { method: m, counts: Array(nRanks).fill(0), points: 0, shown: 0 }
        stats[m].counts[i]++
        stats[m].points += nRanks - i
      })
    }
  }

  return Object.values(stats)
    .map((s) => ({
      ...s,
      firstRate: s.shown ? s.counts[0] / s.shown : 0,
      selectedRate: s.shown ? s.counts.reduce((a, b) => a + b, 0) / s.shown : 0,
      avgPoints: s.shown ? s.points / s.shown : 0,
    }))
    .sort((a, b) => b.points - a.points)
}

// Which method won 1st place most often on each question.
export function perSampleWinners(responses, samples) {
  return samples.map((s) => {
    const firsts = {}
    let n = 0
    for (const resp of responses) {
      const r = resp.rankings.find((x) => x.sample_id === s.id)
      if (!r) continue
      n++
      if (r.rank1) firsts[r.rank1] = (firsts[r.rank1] || 0) + 1
    }
    const sorted = Object.entries(firsts).sort((a, b) => b[1] - a[1])
    return { sample_id: s.id, answers: n, firsts: sorted }
  })
}

function csvCell(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  return [cols.join(','), ...rows.map((row) => cols.map((c) => csvCell(row[c])).join(','))].join('\n')
}

// One row per (participant, question): the format most analysis tools want.
export function responsesToCsv(responses) {
  const nRanks = Math.max(1, ...responses.flatMap((resp) => resp.rankings.map((r) => ranksOf(r).length)))
  const rows = []
  for (const resp of responses) {
    for (const r of resp.rankings) {
      const row = {
        session_id: resp.session_id,
        study_id: resp.study_id ?? '',
        submitted_at: resp.submitted_at ?? '',
        sample_id: r.sample_id,
      }
      const ranks = ranksOf(r)
      for (let i = 0; i < nRanks; i++) row[`rank${i + 1}`] = ranks[i] ?? ''
      row.display_order = (r.display_order ?? []).join('|')
      row.time_ms = r.time_ms ?? ''
      rows.push(row)
    }
  }
  return toCsv(rows)
}

export function statsToCsv(stats) {
  return toCsv(
    stats.map((s) => ({
      method: s.method,
      points: s.points,
      ...Object.fromEntries(s.counts.map((c, i) => [`rank${i + 1}_count`, c])),
      times_shown: s.shown,
      first_place_rate: s.firstRate.toFixed(4),
      top_k_rate: s.selectedRate.toFixed(4),
      avg_points_per_showing: s.avgPoints.toFixed(4),
    })),
  )
}

export function download(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
