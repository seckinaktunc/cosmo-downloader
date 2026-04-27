import { describe, expect, it } from 'vitest'
import {
  getElectronBuilderInvocation,
  getElectronBuilderNsisPatchInvocation,
  getLocalWindowsBuildEnv,
  getNpmInvocation
} from '../../scripts/build-windows-local.mjs'
import { getElectronBuilderNsisPatchPaths } from '../../scripts/patch-electron-builder-nsis.mjs'

describe('getLocalWindowsBuildEnv', () => {
  it('disables certificate autodiscovery for unsigned local builds', () => {
    expect(getLocalWindowsBuildEnv({ PATH: 'bin' }).CSC_IDENTITY_AUTO_DISCOVERY).toBe('false')
  })

  it('keeps signing autodiscovery untouched when signing env exists', () => {
    const env = getLocalWindowsBuildEnv({
      PATH: 'bin',
      WIN_CSC_LINK: 'cert',
      WIN_CSC_KEY_PASSWORD: 'password'
    })

    expect(env.CSC_IDENTITY_AUTO_DISCOVERY).toBeUndefined()
    expect(env.WIN_CSC_LINK).toBe('cert')
  })

  it('does not treat a password without a certificate as signing config', () => {
    const env = getLocalWindowsBuildEnv({
      PATH: 'bin',
      WIN_CSC_KEY_PASSWORD: 'password'
    })

    expect(env.CSC_IDENTITY_AUTO_DISCOVERY).toBe('false')
  })
})

describe('getNpmInvocation', () => {
  it('uses the npm CLI path when npm launched the script', () => {
    const invocation = getNpmInvocation(['run', 'build'], { npm_execpath: 'npm-cli.js' }, 'win32')

    expect(invocation.command).toBe(process.execPath)
    expect(invocation.args).toEqual(['npm-cli.js', 'run', 'build'])
    expect(invocation.shell).toBe(false)
  })

  it('falls back to shell execution for npm.cmd on Windows', () => {
    const invocation = getNpmInvocation(['run', 'build'], {}, 'win32')

    expect(invocation.command).toBe('npm.cmd')
    expect(invocation.shell).toBe(true)
  })

  it('does not use shell fallback for npm on non-Windows platforms', () => {
    const invocation = getNpmInvocation(['run', 'build'], {}, 'linux')

    expect(invocation.command).toBe('npm')
    expect(invocation.shell).toBe(false)
  })
})

describe('getElectronBuilderInvocation', () => {
  it('runs electron-builder through node instead of npx', () => {
    const invocation = getElectronBuilderInvocation()

    expect(invocation.command).toBe(process.execPath)
    expect(invocation.args[0]).toContain('electron-builder')
    expect(invocation.args).toEqual(expect.arrayContaining(['--win', '--publish', 'never']))
    expect(invocation.shell).toBe(false)
  })
})

describe('getElectronBuilderNsisPatchInvocation', () => {
  it('runs the NSIS template patch through node', () => {
    const invocation = getElectronBuilderNsisPatchInvocation()

    expect(invocation.command).toBe(process.execPath)
    expect(invocation.args).toHaveLength(1)
    expect(invocation.args[0]).toContain('patch-electron-builder-nsis.mjs')
    expect(invocation.shell).toBe(false)
  })
})

describe('getElectronBuilderNsisPatchPaths', () => {
  it('patches all tracked NSIS templates that control installer and uninstaller behavior', () => {
    const paths = getElectronBuilderNsisPatchPaths('C:\\repo')

    expect(paths).toEqual([
      {
        source: 'C:\\repo\\build\\installer-template.nsi',
        target: 'C:\\repo\\node_modules\\app-builder-lib\\templates\\nsis\\installer.nsi'
      },
      {
        source: 'C:\\repo\\build\\assistedInstaller-template.nsh',
        target: 'C:\\repo\\node_modules\\app-builder-lib\\templates\\nsis\\assistedInstaller.nsh'
      },
      {
        source: 'C:\\repo\\build\\multiUser.nsh',
        target: 'C:\\repo\\node_modules\\app-builder-lib\\templates\\nsis\\multiUser.nsh'
      }
    ])
  })
})
