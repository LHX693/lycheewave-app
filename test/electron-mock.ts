import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
export const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lwtest-'));
export const app = { getPath: () => TMP, getAppPath: () => TMP, isPackaged: false };
export const safeStorage = { isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from('ENC(' + Buffer.from(s).toString('hex') + ')'),
  decryptString: (b: Buffer) => Buffer.from(b.toString().slice(4, -1), 'hex').toString() };
export const clipboard = {}; export const systemPreferences = {};
