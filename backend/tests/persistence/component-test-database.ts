import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/persistence/schema';
import { PostgresDiagramRepository } from '../../src/persistence/diagram-repository';
import { PostgresAdrRepository } from '../../src/persistence/adr-repository';

export const postgresEnabled = process.env.RUN_POSTGRES_TESTS === '1' && Boolean(process.env.DATABASE_URL);
export const priorMigrations = ['0001_initial.sql', '0002_adrs.sql', '0003_system_groups.sql', '0004_component_dimensions.sql', '0005_c4_container_diagrams.sql', '0006_container_component_types.sql'];
export async function componentTestDatabase(includeComponentMigration = true) {
  const schemaName = `spec010_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  let pool: Pool | undefined;
  const close = async () => {
    await pool?.end();
    // The only cleanup target is this run's UUID-named isolated schema.
    if (!/^spec010_[0-9a-f]{32}$/.test(schemaName)) throw new Error('Invalid isolated test schema');
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`); } finally { await admin.end(); }
  };
  try {
    await admin.query(`CREATE SCHEMA ${schemaName}`);
    pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schemaName}`, connectionTimeoutMillis: 5000 });
    for (const name of priorMigrations) await pool.query(await readFile(resolve('backend/drizzle', name), 'utf8'));
    if (includeComponentMigration) await pool.query(await readFile(resolve('backend/drizzle/0007_c4_component_diagrams.sql'), 'utf8'));
    const db = drizzle(pool, { schema });
    return { pool, db, diagrams: new PostgresDiagramRepository(db), adrs: new PostgresAdrRepository(db), close };
  } catch (error) { await close(); throw error; }
}
