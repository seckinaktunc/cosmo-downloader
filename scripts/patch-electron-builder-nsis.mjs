/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { copyFileSync, existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');

export function getElectronBuilderNsisPatchPaths(root = projectRoot) {
  const nsisTemplateDir = resolve(root, 'node_modules', 'app-builder-lib', 'templates', 'nsis');
  return [
    {
      source: resolve(root, 'build', 'installer-template.nsi'),
      target: resolve(nsisTemplateDir, 'installer.nsi')
    },
    {
      source: resolve(root, 'build', 'assistedInstaller-template.nsh'),
      target: resolve(nsisTemplateDir, 'assistedInstaller.nsh')
    },
    {
      source: resolve(root, 'build', 'multiUser.nsh'),
      target: resolve(nsisTemplateDir, 'multiUser.nsh')
    }
  ];
}

export function patchElectronBuilderNsisTemplate(root = projectRoot) {
  let updated = false;

  for (const { source, target } of getElectronBuilderNsisPatchPaths(root)) {
    if (!existsSync(source)) {
      throw new Error(`Missing NSIS patch source: ${source}`);
    }

    if (!existsSync(target)) {
      throw new Error(`Missing electron-builder NSIS template: ${target}`);
    }

    const sourceContent = readFileSync(source, 'utf8');
    const targetContent = readFileSync(target, 'utf8');

    if (sourceContent === targetContent) {
      continue;
    }

    copyFileSync(source, target);
    updated = true;
  }

  return updated;
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  try {
    const updated = patchElectronBuilderNsisTemplate();
    console.log(
      updated
        ? 'Patched electron-builder NSIS templates.'
        : 'electron-builder NSIS templates already patched.'
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
