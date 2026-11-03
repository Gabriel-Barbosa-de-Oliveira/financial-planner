import { randomBytes, scrypt } from 'node:crypto';
import type { ScryptConfig } from '../config/security.ts';

export type PasswordHasher = {
  hash: (password: string) => Promise<string>;
};

function deriveKey(password: string, salt: Buffer, config: ScryptConfig): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      config.keyLength,
      { N: config.N, r: config.r, p: config.p },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export function createPasswordHasher(config: ScryptConfig): PasswordHasher {
  return {
    async hash(password) {
      const salt = randomBytes(config.saltLength);
      const key = await deriveKey(password, salt, config);
      return ['scrypt', config.N, config.r, config.p, salt.toString('base64'), key.toString('base64')].join('$');
    },
  };
}
