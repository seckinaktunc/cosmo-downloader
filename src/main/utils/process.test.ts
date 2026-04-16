import { describe, expect, it } from 'vitest'
import { getProcessTreeKillCommand } from './process'

describe('getProcessTreeKillCommand', () => {
  it('uses taskkill for Windows process trees', () => {
    expect(getProcessTreeKillCommand('win32', 1234)).toEqual({
      command: 'taskkill',
      args: ['/pid', '1234', '/t', '/f']
    })
  })

  it('uses process groups directly on Unix-like platforms', () => {
    expect(getProcessTreeKillCommand('linux', 1234)).toBeNull()
    expect(getProcessTreeKillCommand('darwin', 1234)).toBeNull()
  })
})
