import type { CosmoApi } from './index'

declare global {
  interface Window {
    cosmo: CosmoApi
  }
}

export {}
