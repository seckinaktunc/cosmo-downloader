/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')

export function getNpmInvocation(args, env = process.env, platform = process.platform) {
  if (env.npm_execpath) {
    return {
      command: process.execPath,
      args: [env.npm_execpath, ...args],
      shell: false
    }
  }

  return {
    command: platform === 'win32' ? 'npm.cmd' : 'npm',
    args,
    shell: platform === 'win32'
  }
}

export function getElectronBuilderInvocation() {
  return {
    command: process.execPath,
    args: [
      resolve(projectRoot, 'node_modules', 'electron-builder', 'cli.js'),
      '--linux',
      'AppImage',
      '--x64',
      '--publish',
      'never'
    ],
    shell: false
  }
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      cwd: projectRoot,
      ...options
    })
    child.on('error', reject)
    child.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolvePromise()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${exitCode}.`))
    })
  })
}

export async function runLocalLinuxBuild({ env = process.env } = {}) {
  const download = getNpmInvocation(['run', 'download:binaries:current'], env)
  await run(download.command, download.args, { env, shell: download.shell })

  const build = getNpmInvocation(['run', 'build'], env)
  await run(build.command, build.args, { env, shell: build.shell })

  const electronBuilder = getElectronBuilderInvocation()
  await run(electronBuilder.command, electronBuilder.args, {
    env,
    shell: electronBuilder.shell
  })
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  runLocalLinuxBuild().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
