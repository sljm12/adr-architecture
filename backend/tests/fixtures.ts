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

type SqlPool = { query: (sql: string, values?: unknown[]) => Promise<{ rows?: Array<{ id: string }> }> };

async function deleteDiagramRows(pool: SqlPool, diagramId: string): Promise<void> {
  await pool.query('DELETE FROM adr_component_links WHERE adr_id IN (SELECT id FROM adrs WHERE diagram_id = $1)', [diagramId]);
  await pool.query('DELETE FROM adr_relationship_links WHERE adr_id IN (SELECT id FROM adrs WHERE diagram_id = $1)', [diagramId]);
  await pool.query('DELETE FROM adrs WHERE diagram_id = $1', [diagramId]);
  await pool.query('DELETE FROM relationships WHERE diagram_id = $1', [diagramId]);
  await pool.query('DELETE FROM system_group_members WHERE group_id IN (SELECT id FROM system_groups WHERE diagram_id = $1)', [diagramId]);
  await pool.query('DELETE FROM system_groups WHERE diagram_id = $1', [diagramId]);
  await pool.query('DELETE FROM components WHERE diagram_id = $1', [diagramId]);
  await pool.query('DELETE FROM diagrams WHERE id = $1', [diagramId]);
}

/** Removes dependent child graphs before their parent/source rows. Safe with pre-feature schemas. */
export async function cleanupDiagramGraph(pool: SqlPool, diagramId: string): Promise<void> {
  const featureColumns = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'diagrams' AND column_name = 'parent_diagram_id'",
  );
  if (featureColumns.rows?.length) {
    const children = await pool.query('SELECT id FROM diagrams WHERE parent_diagram_id = $1 ORDER BY id', [diagramId]);
    for (const child of children.rows ?? []) await deleteDiagramRows(pool, child.id);
  }
  await deleteDiagramRows(pool, diagramId);
}
