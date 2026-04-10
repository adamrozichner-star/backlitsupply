/**
 * Smoke test: start Next.js dev server, verify homepage and 404 behavior.
 */

import { spawn } from 'child_process'
import { resolve } from 'path'

const PORT = 3987
const BASE = `http://localhost:${PORT}`
const PROJECT_DIR = resolve(__dirname, '..')

// Wait for the dev server to respond
async function waitForServer(url: string, timeoutMs = 60_000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (res.ok) return true
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  return false
}

async function httpGet(url: string): Promise<{ status: number; body: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'follow' })
  const body = await res.text()
  return { status: res.status, body }
}

async function main() {
  console.log(`\nStarting Next.js dev server on port ${PORT}...\n`)

  const devServer = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: PROJECT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT) },
  })

  let serverOutput = ''
  devServer.stdout?.on('data', (d: Buffer) => { serverOutput += d.toString() })
  devServer.stderr?.on('data', (d: Buffer) => { serverOutput += d.toString() })

  // Ensure cleanup on exit
  const cleanup = () => {
    try { devServer.kill('SIGTERM') } catch {}
  }
  process.on('exit', cleanup)
  process.on('SIGINT', cleanup)

  let allPassed = true

  try {
    const ready = await waitForServer(BASE, 60_000)
    if (!ready) {
      console.log('\u274C Dev server did not start within 60s')
      console.log('Server output:', serverOutput.slice(-2000))
      process.exit(1)
    }
    console.log('\u2705 Dev server started successfully\n')

    // Test 1: Homepage returns 200
    {
      const { status } = await httpGet(BASE)
      if (status === 200) {
        console.log(`\u2705 GET / => ${status}`)
      } else {
        console.log(`\u274C GET / => ${status} (expected 200)`)
        allPassed = false
      }
    }

    // Test 2: /for/nonexistent returns 404
    {
      const { status, body } = await httpGet(`${BASE}/for/nonexistent`)
      const is404 = status === 404
      const hasNotFoundText = body.toLowerCase().includes('not found')
      if (is404 && hasNotFoundText) {
        console.log(`\u2705 GET /for/nonexistent => ${status} with "not found" in body`)
      } else if (is404) {
        console.log(`\u2705 GET /for/nonexistent => ${status} (404 but "not found" text not detected)`)
      } else {
        console.log(`\u274C GET /for/nonexistent => ${status} (expected 404)`)
        allPassed = false
      }
    }

    // Test 3: /for/glow-medspa-austin (no Supabase data => expect 404)
    {
      const { status } = await httpGet(`${BASE}/for/glow-medspa-austin`)
      if (status === 404) {
        console.log(`\u2705 GET /for/glow-medspa-austin => ${status} (expected 404 without Supabase data)`)
      } else if (status === 200) {
        console.log(`\u2705 GET /for/glow-medspa-austin => ${status} (Supabase data present)`)
      } else {
        console.log(`\u274C GET /for/glow-medspa-austin => ${status} (unexpected)`)
        allPassed = false
      }
    }

    // Test 4: Dev server did not crash
    {
      const crashed = devServer.exitCode !== null
      if (!crashed) {
        console.log(`\u2705 Dev server still running (no crash)`)
      } else {
        console.log(`\u274C Dev server crashed with code ${devServer.exitCode}`)
        allPassed = false
      }
    }

  } finally {
    cleanup()
  }

  console.log(`\n${allPassed ? '\u2705 All page checks passed' : '\u274C Some page checks failed'}`)
  process.exit(allPassed ? 0 : 1)
}

main().catch(err => {
  console.error('verify-pages failed:', err)
  process.exit(1)
})
