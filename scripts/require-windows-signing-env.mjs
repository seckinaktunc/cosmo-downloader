/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { fileURLToPath } from 'url';
import { resolve } from 'path';

export const REQUIRED_WINDOWS_SIGNING_ENV = ['WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD'];

export function getMissingWindowsSigningEnv(env = process.env) {
  return REQUIRED_WINDOWS_SIGNING_ENV.filter((name) => !env[name]);
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  const missing = getMissingWindowsSigningEnv();
  if (missing.length > 0) {
    console.error(`Missing Windows signing environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}
