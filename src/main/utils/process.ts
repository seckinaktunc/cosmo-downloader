import { ChildProcessWithoutNullStreams, spawn } from 'child_process'

export type SpawnCaptureResult = {
  stdout: string
  stderr: string
  exitCode: number | null
}

export function spawnProcess(
  command: string,
  args: string[],
  options?: {
    cwd?: string
    env?: NodeJS.ProcessEnv
  }
): ChildProcessWithoutNullStreams {
  return spawn(command, args, {
    cwd: options?.cwd,
    env: { ...process.env, ...options?.env },
    windowsHide: true
  })
}

export function captureProcess(
  command: string,
  args: string[],
  options?: {
    cwd?: string
    env?: NodeJS.ProcessEnv
    signal?: AbortSignal
  }
): Promise<SpawnCaptureResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      env: { ...process.env, ...options?.env },
      windowsHide: true,
      signal: options?.signal
    })
    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode })
    })
  })
}
