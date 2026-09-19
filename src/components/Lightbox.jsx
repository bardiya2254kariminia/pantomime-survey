import { useEffect } from 'react'
import { asset } from '../lib/asset.js'

// Full-screen view of one image; closes on click or Escape.
export default function Lightbox({ image, onClose }) {
  useEffect(() => {
    if (!image) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [image, onClose])

  if (!image) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/85 flex flex-col items-center justify-center p-4 cursor-zoom-out"
      onClick={onClose}
      role="dialog"
      aria-label={image.alt}
    >
      <img src={asset(image.src)} alt={image.alt} className="max-w-full max-h-[85vh] object-contain rounded-xl bg-white" />
      <p className="text-white/90 text-sm mt-3">{image.alt} · click anywhere or press Esc to close</p>
    </div>
  )
}
