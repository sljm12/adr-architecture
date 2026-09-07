export const adrTestIds = {
  title: 'Use a payment service boundary',
  context: 'Payment processing needs an explicit boundary.',
  decision: 'Route payment commands through the payment service.',
  consequences: 'The service owns payment provider integration and retries.',
};

export const fillAdrForm = async (page: { getByLabel: (label: string) => { fill: (value: string) => Promise<void> } }) => {
  await page.getByLabel('Title').fill(adrTestIds.title);
  await page.getByLabel('Context').fill(adrTestIds.context);
  await page.getByLabel('Decision').fill(adrTestIds.decision);
  await page.getByLabel('Consequences').fill(adrTestIds.consequences);
};
