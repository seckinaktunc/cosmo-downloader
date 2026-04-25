import { describe, expect, it } from 'vitest'
import { getElectronBuilderInvocation, getNpmInvocation } from '../../scripts/build-linux-local.mjs'

describe('getNpmInvocation', () => {
  it('uses the npm CLI path when npm launched the script', () => {
    const invocation = getNpmInvocation(['run', 'build'], { npm_execpath: 'npm-cli.js' }, 'linux')

    expect(invocation.command).toBe(process.execPath)
    expect(invocation.args).toEqual(['npm-cli.js', 'run', 'build'])
    expect(invocation.shell).toBe(false)
  })

  it('falls back to npm.cmd on Windows', () => {
    const invocation = getNpmInvocation(['run', 'build'], {}, 'win32')

    expect(invocation.command).toBe('npm.cmd')
    expect(invocation.shell).toBe(true)
  })

  it('uses npm without shell on non-Windows platforms', () => {
    const invocation = getNpmInvocation(['run', 'build'], {}, 'linux')

    expect(invocation.command).toBe('npm')
    expect(invocation.shell).toBe(false)
  })
})

describe('getElectronBuilderInvocation', () => {
  it('pins Linux packaging to AppImage x64 with publish disabled', () => {
    const invocation = getElectronBuilderInvocation()

    expect(invocation.command).toBe(process.execPath)
    expect(invocation.args[0]).toContain('electron-builder')
    expect(invocation.args).toEqual(
      expect.arrayContaining(['--linux', 'AppImage', '--x64', '--publish', 'never'])
    )
    expect(invocation.shell).toBe(false)
  })
})
