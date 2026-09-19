import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' makes the build work from any sub-path (e.g. https://<user>.github.io/pantomime-survey/)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    // Allows the dev server to be reached through the Vast.ai Caddy proxy,
    // which forwards a different public host/port than what Vite binds to.
    allowedHosts: true,
    hmr: process.env.HMR_CLIENT_PORT
      ? { clientPort: Number(process.env.HMR_CLIENT_PORT) }
      : undefined,
  },
})
