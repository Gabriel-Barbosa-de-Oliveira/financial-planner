export const securityConfig = {
  scrypt: {
    N: 16384,
    r: 8,
    p: 1,
    keyLength: 64,
    saltLength: 16,
  },
  password: {
    minLength: 8,
    maxLength: 72,
  },
  email: {
    maxLength: 255,
  },
};

export type ScryptConfig = typeof securityConfig.scrypt;
