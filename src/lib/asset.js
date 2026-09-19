// Resolve a path from samples.json / study.js against the deployed base path.
export function asset(path) {
  if (!path || /^(https?:|data:|blob:)/.test(path)) return path
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '')
}
