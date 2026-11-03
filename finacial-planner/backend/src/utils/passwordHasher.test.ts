import { describe, it, expect } from '@jest/globals';
import { createPasswordHasher } from './passwordHasher.ts';
import { securityConfig } from '../config/security.ts';

describe('createPasswordHasher', () => {
  const hasher = createPasswordHasher(securityConfig.scrypt);
  const password = 'senha-segura-123';

  it('gera o formato scrypt$N$r$p$salt$hash', async () => {
    const hash = await hasher.hash(password);
    const [algorithm, n, r, p, salt, key] = hash.split('$');

    expect(algorithm).toBe('scrypt');
    expect(Number(n)).toBe(securityConfig.scrypt.N);
    expect(Number(r)).toBe(securityConfig.scrypt.r);
    expect(Number(p)).toBe(securityConfig.scrypt.p);
    expect(Buffer.from(salt, 'base64')).toHaveLength(securityConfig.scrypt.saltLength);
    expect(Buffer.from(key, 'base64')).toHaveLength(securityConfig.scrypt.keyLength);
  });

  it('usa um salt diferente a cada chamada', async () => {
    const first = await hasher.hash(password);
    const second = await hasher.hash(password);

    expect(first).not.toBe(second);
  });

  it('não contém a senha em texto puro e cabe em 255 caracteres', async () => {
    const hash = await hasher.hash(password);

    expect(hash).not.toContain(password);
    expect(hash.length).toBeLessThanOrEqual(255);
  });

  it('cabe em 255 caracteres mesmo com a senha no tamanho máximo', async () => {
    const hash = await hasher.hash('a'.repeat(securityConfig.password.maxLength));

    expect(hash.length).toBeLessThanOrEqual(255);
  });
});
