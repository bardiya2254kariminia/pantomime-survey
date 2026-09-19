import { useState } from 'react'
import { asset } from '../lib/asset.js'

// Image with a grey placeholder if the file is missing (same behaviour as the reference site).
export default function Img({ src, alt, aspect = '1/1', className = '', onClick }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={`w-full bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm ${className}`}
        style={{ aspectRatio: aspect }}
      >
        [{alt}]
      </div>
    )
  }

  return (
    <img
      src={asset(src)}
      alt={alt}
      onError={() => setFailed(true)}
      onClick={onClick}
      className={`w-full object-contain rounded-xl bg-slate-100 ${onClick ? 'cursor-zoom-in' : ''} ${className}`}
      style={{ aspectRatio: aspect }}
    />
  )
}
