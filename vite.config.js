import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' makes the build work from any sub-path (e.g. https://<user>.github.io/pantomime-survey/)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
