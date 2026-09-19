import { isFirebaseConfigured } from '../config/firebase.js'

// Only ever shown on a developer's machine, never on the deployed site.
export default function LocalModeBanner() {
  if (!isFirebaseConfigured) {
    return (
      <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-sm px-4 py-2 text-center">
        <strong>Local mode:</strong> answers are saved only in this browser and never reach Firebase.
      </div>
    )
  }
  if (import.meta.env.DEV) {
    return (
      <div className="bg-sky-100 border-b border-sky-300 text-sky-900 text-sm px-4 py-2 text-center">
        <strong>Dev server:</strong> answers go to Firebase marked as test runs, hidden on the results page by default.
      </div>
    )
  }
  return null
}
