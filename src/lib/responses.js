import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore/lite'
import { db, isFirebaseConfigured } from '../config/firebase.js'

const LOCAL_KEY = 'pantomime-survey-local-responses'

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []
  } catch {
    return []
  }
}

// One document per session (doc id = session id), so a retry can never create a duplicate.
export async function submitResponse({ sessionId, studyId, startedAt, rankings }) {
  const payload = {
    session_id: sessionId,
    // Runs from the local dev server are tagged so the results page can hide them.
    study_id: import.meta.env.DEV ? `${studyId}-dev` : studyId,
    started_at: startedAt,
    total_time_ms: Date.now() - startedAt,
    user_agent: navigator.userAgent.slice(0, 300),
    rankings,
  }

  if (!isFirebaseConfigured) {
    const all = readLocal().filter((r) => r.session_id !== sessionId)
    all.push({ ...payload, submitted_at: new Date().toISOString() })
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all))
    return sessionId
  }

  await setDoc(doc(db, 'responses', sessionId), { ...payload, submitted_at: serverTimestamp() })
  return sessionId
}

// Admin only: Firestore rules reject this unless the signed-in user is in the admin list.
export async function fetchAllResponses() {
  if (!isFirebaseConfigured) return readLocal()

  const snap = await getDocs(collection(db, 'responses'))
  return snap.docs.map((d) => {
    const data = d.data()
    return { ...data, submitted_at: data.submitted_at?.toDate?.().toISOString() ?? null }
  })
}
