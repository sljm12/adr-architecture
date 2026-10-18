import { sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { archiveRowSchemas, canonicalArchiveScalar, ArchiveValidationError, type ArchiveCollection, type ArchiveRecords, type ArchiveRow } from '../../../shared/src/index';
import type * as schema from './schema';

export type ArchiveExecutor = Pick<NodePgDatabase<typeof schema>, 'execute'>;
export type DiagramArchiveCollection = 'diagrams' | 'components' | 'relationships' | 'systemGroups' | 'systemGroupMembers';
export type AdrArchiveCollection = 'adrs' | 'adrComponentLinks' | 'adrRelationshipLinks';
export const diagramArchiveCollections = ['diagrams','components','relationships','systemGroups','systemGroupMembers'] as const;
export const adrArchiveCollections = ['adrs','adrComponentLinks','adrRelationshipLinks'] as const;
const tables = { diagrams: 'diagrams', components: 'components', relationships: 'relationships', systemGroups: 'system_groups', systemGroupMembers: 'system_group_members', adrs: 'adrs', adrComponentLinks: 'adr_component_links', adrRelationshipLinks: 'adr_relationship_links' } as const;
// Identifiers come exclusively from these compiled schemas, never from archive keys.
export const archiveFields = Object.fromEntries(Object.entries(archiveRowSchemas).map(([collection, rowSchema]) => [collection, Object.keys(rowSchema.shape)])) as Record<ArchiveCollection, string[]>;
const column = (field: string) => field.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
const ident = (name: string) => sql.identifier(name);
const scalarFields = new Set(['x','y','width','height','scopeX','scopeY','scopeWidth','scopeHeight']);
export const archiveIdentityFields = (collection: ArchiveCollection) => collection === 'systemGroupMembers' ? ['groupId','componentId'] : collection === 'adrComponentLinks' ? ['adrId','componentId'] : collection === 'adrRelationshipLinks' ? ['adrId','relationshipId'] : ['id'];
export const archiveRowIdentity = (collection: ArchiveCollection, row: ArchiveRow): string[] => archiveIdentityFields(collection).map(key => String((row as unknown as Record<string, unknown>)[key]).toLowerCase());
export function normalizeArchiveRows<C extends ArchiveCollection>(collection: C, rows: ArchiveRecords[C]): ArchiveRecords[C] {
  return rows.map(row => {
    const parsed = archiveRowSchemas[collection].parse(row) as unknown as Record<string, unknown>;
    for (const key of archiveFields[collection]) if ((key === 'id' || key.endsWith('Id')) && typeof parsed[key] === 'string') parsed[key] = parsed[key].toLowerCase();
    return parsed;
  }) as ArchiveRecords[C];
}
export function sortArchiveRows<C extends ArchiveCollection>(collection: C, rows: ArchiveRecords[C]): ArchiveRecords[C] {
  return [...rows].sort((a,b) => archiveRowIdentity(collection,a).join('/').localeCompare(archiveRowIdentity(collection,b).join('/'))) as ArchiveRecords[C];
}
export function archiveTimestamp(value: string): string { return value.replace(/\.(\d{3})Z$/, '.$1000Z'); }
export const archiveGeometry = (row: { position: { x: number; y: number }; size: { width: number; height: number } }) => ({ x: canonicalArchiveScalar(row.position.x), y: canonicalArchiveScalar(row.position.y), width: canonicalArchiveScalar(row.size.width), height: canonicalArchiveScalar(row.size.height) });

export async function readArchiveTable<C extends ArchiveCollection>(db: ArchiveExecutor, collection: C, diagramIds?: string[]): Promise<ArchiveRecords[C]> {
  await db.execute(sql`SET LOCAL extra_float_digits = 3`);
  const projection = archiveFields[collection].map(field => {
    const col = ident(column(field));
    const expression = field.endsWith('At') ? sql`to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` : scalarFields.has(field) || field === 'deletionRevision' ? sql`${col}::text` : col;
    return sql`${expression} AS ${ident(field)}`;
  });
  let scope = sql`TRUE`;
  if (diagramIds) {
    const ids = sql`(${sql.join(diagramIds.map(id => sql`${id}::uuid`),sql`, `)})`;
    scope = !diagramIds.length ? sql`FALSE` : collection === 'diagrams' ? sql`id IN ${ids}`
      : collection === 'systemGroupMembers' ? sql`group_id IN (SELECT id FROM system_groups WHERE diagram_id IN ${ids})`
      : collection === 'adrComponentLinks' || collection === 'adrRelationshipLinks' ? sql`adr_id IN (SELECT id FROM adrs WHERE diagram_id IN ${ids})`
      : sql`diagram_id IN ${ids}`;
  }
  const result = await db.execute(sql`SELECT ${sql.join(projection, sql`, `)} FROM ${ident(tables[collection])} WHERE ${scope} ORDER BY ${sql.join(archiveIdentityFields(collection).map(f => ident(column(f))), sql`, `)}`);
  const rows = result.rows.map((row: Record<string, unknown>) => {
    const raw = { ...row } as Record<string, unknown>;
    for (const field of archiveFields[collection]) if (scalarFields.has(field) && raw[field] !== null) {
      try { raw[field] = canonicalArchiveScalar(Number(raw[field])); }
      catch { throw new ArchiveValidationError('ARCHIVE_INVALID', 'Unsupported stored layout', [{ path: `${collection}.${archiveRowIdentity(collection,row as ArchiveRow).join('/')}.${field}`, message: 'Repair nonfinite layout before export.' }]); }
    }
    const parsed = archiveRowSchemas[collection].safeParse(raw);
    if (!parsed.success) throw new ArchiveValidationError('ARCHIVE_INVALID', 'Unsupported stored archive value', parsed.error.issues.map(issue => ({ path: `${collection}.${archiveRowIdentity(collection,row as ArchiveRow).join('/')}.${issue.path.join('.')}`, message: 'Repair the unsupported saved value before export.' })));
    return parsed.data;
  });
  return rows as ArchiveRecords[C];
}

export async function upsertArchiveTable<C extends ArchiveCollection>(db: ArchiveExecutor, collection: C, rows: ArchiveRecords[C]): Promise<void> {
  if (!rows.length) return;
  const fields = archiveFields[collection], keys = archiveIdentityFields(collection), table = ident(tables[collection]);
  const updates = fields.filter(field => !keys.includes(field));
  // Keep batches below PostgreSQL's parameter limit, including wide diagram rows.
  for (let offset = 0; offset < rows.length; offset += 500) {
    const tuples = rows.slice(offset, offset+500).map(row => {
      const parsed = archiveRowSchemas[collection].parse(row) as unknown as Record<string, unknown>;
      return sql`(${sql.join(fields.map(field => sql`${parsed[field]}`), sql`, `)})`;
    });
    const different = updates.map(field => {
      const current = sql`${table}.${ident(column(field))}`, incoming = sql`excluded.${ident(column(field))}`;
      // SQL float equality equates signed zeros; compare their binary representation.
      return scalarFields.has(field) ? sql`float8send(${current}) IS DISTINCT FROM float8send(${incoming})` : sql`${current} IS DISTINCT FROM ${incoming}`;
    });
    await db.execute(sql`INSERT INTO ${table} (${sql.join(fields.map(f => ident(column(f))), sql`, `)}) VALUES ${sql.join(tuples, sql`, `)} ON CONFLICT (${sql.join(keys.map(f => ident(column(f))), sql`, `)}) DO UPDATE SET ${sql.join(updates.map(f => sql`${ident(column(f))} = excluded.${ident(column(f))}`), sql`, `)} WHERE ${sql.join(different, sql` OR `)}`);
  }
}
export async function removeArchiveTable(db: ArchiveExecutor, collection: ArchiveCollection, identities: string[][]): Promise<void> {
  if (collection === 'diagrams') throw new Error('Archive operations cannot remove diagrams');
  const keys = archiveIdentityFields(collection);
  for (let offset = 0; offset < identities.length; offset += 500) {
    const conditions: SQL[] = identities.slice(offset,offset+500).map(identity => {
      if (identity.length !== keys.length) throw new Error('Invalid archive identity');
      return sql`(${sql.join(keys.map((key,i) => sql`${ident(column(key))} = ${identity[i]}::uuid`), sql` AND `)})`;
    });
    await db.execute(sql`DELETE FROM ${ident(tables[collection])} WHERE ${sql.join(conditions, sql` OR `)}`);
  }
}
