# Cosmo Downloader

An Electron application with React and TypeScript.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
$ npm run download:binaries:current
```

Use `npm run download:binaries` to stage binaries for all configured platforms before cross-platform packaging.

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

If Electron exits as plain Node during development, clear `ELECTRON_RUN_AS_NODE` before running `npm run dev`.
