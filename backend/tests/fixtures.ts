export const ids={diagram:'00000000-0000-0000-0000-000000000001',componentA:'00000000-0000-0000-0000-000000000002',componentB:'00000000-0000-0000-0000-000000000003',adr:'00000000-0000-0000-0000-000000000004',replacementAdr:'00000000-0000-0000-0000-000000000005'};

export const completeAdrPayload = {
  title: 'Use a payment service boundary',
  context: 'Payment processing needs an explicit boundary.',
  decision: 'Route payment commands through the payment service.',
  consequences: 'The service owns payment provider integration and retries.',
  alternativesOrConstraints: null,
  status: 'draft' as const,
  replacementAdrId: null,
};
