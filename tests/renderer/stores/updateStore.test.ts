import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcResult, UpdateState } from '@shared/types'
import { useUpdateStore } from '@renderer/stores/updateStore'

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function fail<T>(message: string): IpcResult<T> {
  return { ok: false, error: { code: 'PROCESS_FAILED', message } }
}

function installCosmoMock(initialState: UpdateState = { status: 'idle' }): {
  checkNow: ReturnType<typeof vi.fn>
  download: ReturnType<typeof vi.fn>
  install: ReturnType<typeof vi.fn>
} {
  const checkNow = vi.fn(async () => ok({ status: 'not_available' as const }))
  const download = vi.fn(async () => ok({ status: 'downloading' as const }))
  const install = vi.fn(async () => ok(initialState))

  vi.stubGlobal('window', {
    cosmo: {
      updates: {
        getState: vi.fn(async () => ok(initialState)),
        checkNow,
        download,
        install,
        onState: vi.fn()
      }
    }
  })

  return { checkNow, download, install }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  useUpdateStore.setState({
    state: { status: 'idle' },
    isSubscribed: false,
    dismissedAvailableVersion: undefined,
    dismissedDownloadedVersion: undefined
  })
})

describe('useUpdateStore', () => {
  it('loads update state through preload', async () => {
    installCosmoMock({ status: 'available', updateInfo: { version: '1.2.3' } })

    await useUpdateStore.getState().load()

    expect(useUpdateStore.getState().state.status).toBe('available')
    expect(useUpdateStore.getState().state.updateInfo?.version).toBe('1.2.3')
  })

  it('runs manual update checks', async () => {
    const { checkNow } = installCosmoMock()

    await useUpdateStore.getState().checkNow()

    expect(checkNow).toHaveBeenCalledTimes(1)
    expect(useUpdateStore.getState().state.status).toBe('not_available')
  })

  it('runs update download and install actions', async () => {
    const { download, install } = installCosmoMock()

    await useUpdateStore.getState().download()
    await useUpdateStore.getState().install()

    expect(download).toHaveBeenCalledTimes(1)
    expect(install).toHaveBeenCalledTimes(1)
  })

  it('stores action errors in update state without clearing existing status', async () => {
    const { install } = installCosmoMock({ status: 'downloaded', updateInfo: { version: '1.2.3' } })
    install.mockResolvedValueOnce(fail('Finish active downloads before restarting.'))
    useUpdateStore.setState({ state: { status: 'downloaded', updateInfo: { version: '1.2.3' } } })

    await useUpdateStore.getState().install()

    expect(useUpdateStore.getState().state.status).toBe('downloaded')
    expect(useUpdateStore.getState().state.error).toBe('Finish active downloads before restarting.')
  })
})
