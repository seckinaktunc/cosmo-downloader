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
    detached?: boolean
  }
): ChildProcessWithoutNullStreams {
  return spawn(command, args, {
    cwd: options?.cwd,
    env: { ...process.env, ...options?.env },
    detached: options?.detached,
    windowsHide: true
  })
}

export type ProcessTreeKillCommand = {
  command: string
  args: string[]
}

export function getProcessTreeKillCommand(
  platform: NodeJS.Platform,
  pid: number
): ProcessTreeKillCommand | null {
  if (platform === 'win32') {
    return {
      command: 'taskkill',
      args: ['/pid', String(pid), '/t', '/f']
    }
  }

  return null
}

export function killProcessTree(child: ChildProcessWithoutNullStreams): void {
  const pid = child.pid
  if (pid == null) {
    child.kill('SIGTERM')
    return
  }

  const command = getProcessTreeKillCommand(process.platform, pid)
  if (command) {
    const killer = spawn(command.command, command.args, { windowsHide: true })
    killer.on('error', () => {
      child.kill('SIGTERM')
    })
    killer.on('close', (exitCode) => {
      if (exitCode !== 0) {
        child.kill('SIGTERM')
      }
    })
    return
  }

  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }
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
