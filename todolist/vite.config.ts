import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    allowedHosts: ["p4141.doodee.cc", "p5174.doodee.cc"]
  },

  preview: {
    host: true,
    port: 4141,
    allowedHosts: ["p4141.doodee.cc", "p5174.doodee.cc"]
  }
})
