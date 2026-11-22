import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
// Vercel provides the commit; locally, ask git.
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? safe(() => execSync('git rev-parse HEAD').toString()) ?? '').trim().slice(0, 7)

function safe<T>(fn: () => T) {
  try {
    return fn()
  } catch {
    return undefined
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __APP_COMMIT__: JSON.stringify(commit),
  },
})
