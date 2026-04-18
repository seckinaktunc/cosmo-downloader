import { existsSync } from 'fs'
import { join } from 'path'
import type { CookieBrowser, CookieBrowserOption } from '../../shared/types'

type BrowserCandidate = {
  id: CookieBrowser
  label: string
  paths: string[]
}

function envPath(name: string): string {
  return process.env[name] ?? ''
}

function pathDirectories(): string[] {
  const delimiter = process.platform === 'win32' ? ';' : ':'
  return envPath('PATH')
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function windowsChromiumPathCandidates(): string[] {
  return pathDirectories().flatMap((directory) => {
    const chromiumExecutable = join(directory, 'chromium.exe')
    const chromeExecutable = join(directory, 'chrome.exe')
    return /chromium/i.test(directory)
      ? [chromiumExecutable, chromeExecutable]
      : [chromiumExecutable]
  })
}

export function getBrowserCandidates(platform: NodeJS.Platform): BrowserCandidate[] {
  const localAppData = envPath('LOCALAPPDATA')
  const programFiles = envPath('PROGRAMFILES')
  const programFilesX86 = envPath('PROGRAMFILES(X86)')
  const appData = envPath('APPDATA')
  const home = envPath('HOME') || envPath('USERPROFILE')

  if (platform === 'win32') {
    return [
      {
        id: 'chrome',
        label: 'Google Chrome',
        paths: [
          join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
        ]
      },
      {
        id: 'chromium',
        label: 'Chromium',
        paths: [
          join(localAppData, 'Chromium', 'Application', 'chrome.exe'),
          join(localAppData, 'Programs', 'Chromium', 'chrome.exe'),
          join(programFiles, 'Chromium', 'Application', 'chrome.exe'),
          join(programFilesX86, 'Chromium', 'Application', 'chrome.exe'),
          ...windowsChromiumPathCandidates()
        ]
      },
      {
        id: 'edge',
        label: 'Microsoft Edge',
        paths: [
          join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
        ]
      },
      {
        id: 'firefox',
        label: 'Firefox',
        paths: [
          join(programFiles, 'Mozilla Firefox', 'firefox.exe'),
          join(programFilesX86, 'Mozilla Firefox', 'firefox.exe'),
          join(appData, 'Mozilla', 'Firefox', 'profiles.ini')
        ]
      },
      {
        id: 'brave',
        label: 'Brave',
        paths: [join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')]
      },
      {
        id: 'opera',
        label: 'Opera',
        paths: [join(localAppData, 'Programs', 'Opera', 'opera.exe')]
      },
      {
        id: 'vivaldi',
        label: 'Vivaldi',
        paths: [join(localAppData, 'Vivaldi', 'Application', 'vivaldi.exe')]
      }
    ]
  }

  if (platform === 'darwin') {
    return [
      { id: 'safari', label: 'Safari', paths: ['/Applications/Safari.app'] },
      { id: 'chrome', label: 'Google Chrome', paths: ['/Applications/Google Chrome.app'] },
      { id: 'edge', label: 'Microsoft Edge', paths: ['/Applications/Microsoft Edge.app'] },
      { id: 'firefox', label: 'Firefox', paths: ['/Applications/Firefox.app'] },
      { id: 'brave', label: 'Brave', paths: ['/Applications/Brave Browser.app'] },
      { id: 'opera', label: 'Opera', paths: ['/Applications/Opera.app'] },
      { id: 'vivaldi', label: 'Vivaldi', paths: ['/Applications/Vivaldi.app'] }
    ]
  }

  return [
    {
      id: 'chrome',
      label: 'Google Chrome',
      paths: ['/usr/bin/google-chrome', '/usr/bin/chromium']
    },
    {
      id: 'chromium',
      label: 'Chromium',
      paths: ['/usr/bin/chromium', '/usr/bin/chromium-browser']
    },
    { id: 'edge', label: 'Microsoft Edge', paths: ['/usr/bin/microsoft-edge'] },
    {
      id: 'firefox',
      label: 'Firefox',
      paths: ['/usr/bin/firefox', join(home, '.mozilla', 'firefox')]
    },
    { id: 'brave', label: 'Brave', paths: ['/usr/bin/brave-browser', '/usr/bin/brave'] },
    { id: 'opera', label: 'Opera', paths: ['/usr/bin/opera'] },
    { id: 'vivaldi', label: 'Vivaldi', paths: ['/usr/bin/vivaldi'] }
  ]
}

export function detectCookieBrowsers(
  platform: NodeJS.Platform = process.platform
): CookieBrowserOption[] {
  const detected = getBrowserCandidates(platform)
    .filter((candidate) => candidate.paths.some((path) => path.length > 0 && existsSync(path)))
    .map<CookieBrowserOption>((candidate) => ({
      id: candidate.id,
      label: candidate.label,
      exists: true
    }))

  return [{ id: 'none', label: 'None', exists: true }, ...detected]
}
