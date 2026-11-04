export const categoryConfig = {
  // Valores sem acento: o sentido (entrada/saída) do lançamento vem daqui
  types: ['ENTRADA', 'SAIDA'] as const,
  name: {
    maxLength: 100,
  },
};

export type CategoryType = (typeof categoryConfig.types)[number];
