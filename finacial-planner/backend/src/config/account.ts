export const accountConfig = {
  types: ['BANK', 'INVESTMENT', 'CASH', 'SAVINGS'] as const,
  name: {
    maxLength: 100,
  },
  balance: {
    // Até 12 dígitos no total, 2 casas decimais (DECIMAL(12, 2)); texto, nunca number
    pattern: /^-?\d{1,10}(\.\d{1,2})?$/,
    default: '0.00',
  },
};

export type AccountType = (typeof accountConfig.types)[number];
