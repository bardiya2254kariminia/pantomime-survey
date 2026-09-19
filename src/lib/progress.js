// Keeps an unfinished survey in this browser so a refresh doesn't lose answers.
const KEY = 'pantomime-survey-progress-v1'

export function loadProgress(studyId) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return saved?.studyId === studyId ? saved : null
  } catch {
    return null
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress))
  } catch {
    // storage unavailable (private mode etc.): the survey still works, just without resume
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
