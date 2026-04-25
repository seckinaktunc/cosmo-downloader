/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { existsSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

const SMOKE_TEST_TIMEOUT_MS = 30_000

export function getLinuxAppImageArtifact(distDir = 'dist') {
  return getLinuxAppImageArtifactWithFs(distDir)
}

export function getLinuxAppImageArtifactWithFs(
  distDir = 'dist',
  { readDir = readdirSync, stat = statSync } = {}
) {
  return readDir(distDir)
    .filter((name) => name.endsWith('.AppImage'))
    .map((name) => join(distDir, name))
    .sort((a, b) => stat(b).mtimeMs - stat(a).mtimeMs)[0]
}

export async function verifyLinuxPackage({
  distDir = 'dist',
  platform = process.platform,
  env = process.env,
  timeoutMs = SMOKE_TEST_TIMEOUT_MS,
  getArtifact = getLinuxAppImageArtifact,
  pathExists = existsSync,
  spawnProcess = spawn
} = {}) {
  if (platform !== 'linux') {
    throw new Error('Linux package verification must run on Linux.')
  }

  const artifact = getArtifact(distDir)
  if (!artifact) {
    throw new Error(`No Linux AppImage artifact found in ${distDir}.`)
  }

  if (!pathExists(artifact)) {
    throw new Error(`Linux AppImage artifact is missing: ${artifact}`)
  }

  await new Promise((resolvePromise, reject) => {
    const child = spawnProcess('xvfb-run', ['-a', artifact], {
      stdio: 'inherit',
      shell: false,
      env: {
        ...env,
        APPIMAGE_EXTRACT_AND_RUN: '1',
        COSMO_SMOKE_TEST: '1'
      }
    })

    let settled = false
    const timer = setTimeout(() => {
      if (settled) {
        return
      }

      settled = true
      child.kill('SIGKILL')
      reject(new Error(`Linux AppImage smoke test timed out after ${timeoutMs}ms.`))
    }, timeoutMs)

    child.on('error', (error) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)
      reject(error)
    })

    child.on('close', (exitCode, signal) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)

      if (exitCode === 0) {
        resolvePromise()
        return
      }

      const outcome = signal ? `signal ${signal}` : `code ${exitCode}`
      reject(new Error(`Linux AppImage smoke test failed with ${outcome}.`))
    })
  })
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  verifyLinuxPackage()
    .then(() => {
      console.log('Linux AppImage smoke test passed.')
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
}
