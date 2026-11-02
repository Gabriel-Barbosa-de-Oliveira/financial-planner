import { describe, it, expect, beforeAll } from '@jest/globals';

describe('environmentConfig', () => {
  let environmentConfig: typeof import('./env.ts').environmentConfig;

  beforeAll(async () => {
    delete process.env.PORT;
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    ({ environmentConfig } = await import('./env.ts'));
  });

  it('usa os valores padrão quando as variáveis não estão definidas', () => {
    expect(environmentConfig.PORT).toBe(8080);
    expect(environmentConfig.DB_HOST).toBe('localhost');
    expect(environmentConfig.DB_PORT).toBe(5432);
  });
});
