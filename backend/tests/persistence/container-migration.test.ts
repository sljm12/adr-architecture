import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const enabled = process.env.RUN_POSTGRES_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const schemaName = `spec009_${randomUUID().replaceAll('-', '')}`;
const timestamp = '2025-06-07T08:09:10.000Z';
const parentId = 'a1000000-0000-4000-8000-000000000001';
const otherParentId = 'a1000000-0000-4000-8000-000000000002';
const ownerId = 'a1000000-0000-4000-8000-000000000003';
const otherSystemId = 'a1000000-0000-4000-8000-000000000004';
const personId = 'a1000000-0000-4000-8000-000000000005';
const relationshipId = 'a1000000-0000-4000-8000-000000000006';
const groupId = 'a1000000-0000-4000-8000-000000000007';
const adrId = 'a1000000-0000-4000-8000-000000000008';
const secondAdrId = 'a1000000-0000-4000-8000-000000000009';
const childId = 'a1000000-0000-4000-8000-000000000010';
const secondChildId = 'a1000000-0000-4000-8000-000000000011';
const containerId = 'a1000000-0000-4000-8000-000000000012';
const externalId = 'a1000000-0000-4000-8000-000000000013';
const duplicatedExternalId = 'a1000000-0000-4000-8000-000000000014';
let admin: Pool | undefined;
let db: Pool | undefined;

describe.skipIf(!enabled)('C4 container migration 0005', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: process.env.DATABASE_URL });
    await admin.query(`CREATE SCHEMA ${schemaName}`);
    db = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schemaName}` });
    for (const name of ['0001_initial.sql', '0002_adrs.sql', '0003_system_groups.sql', '0004_component_dimensions.sql']) {
      const sql = await readFile(fileURLToPath(new URL(`../../drizzle/${name}`, import.meta.url)), 'utf8');
      await db.query(sql);
    }
    await seedLegacyData();
    const migration = await readFile(fileURLToPath(new URL('../../drizzle/0005_c4_container_diagrams.sql', import.meta.url)), 'utf8');
    await db.query(migration);
  }, 120_000);

  afterAll(async () => {
    await db?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      await admin.end();
    }
  });

  it('preserves seeded IDs, creation times, legacy types, groups, relationships, and ADR links', async () => {
    const legacy = await db!.query(`
      SELECT d.id AS diagram_id, d.created_at, c.id AS component_id, c.type, c.created_at AS component_created_at,
             r.id AS relationship_id, g.id AS group_id, a.id AS adr_id, acl.component_id AS linked_component_id,
             arl.relationship_id AS linked_relationship_id
      FROM diagrams d
      JOIN components c ON c.diagram_id = d.id AND c.id = $2
      JOIN relationships r ON r.diagram_id = d.id
      JOIN system_groups g ON g.diagram_id = d.id
      JOIN adrs a ON a.diagram_id = d.id
      JOIN adr_component_links acl ON acl.adr_id = a.id
      JOIN adr_relationship_links arl ON arl.adr_id = a.id
      WHERE d.id = $1
    `, [parentId, ownerId]);
    expect(legacy.rows[0]).toMatchObject({
      diagram_id: parentId,
      component_id: ownerId,
      type: 'legacy-service',
      relationship_id: relationshipId,
      group_id: groupId,
      adr_id: adrId,
      linked_component_id: ownerId,
      linked_relationship_id: relationshipId,
    });
    const created = await db!.query('SELECT created_at FROM diagrams WHERE id = $1', [parentId]);
    expect(new Date(created.rows[0].created_at).toISOString()).toBe(timestamp);
  });

  it('enforces all-status owner uniqueness, owner-parent membership, source FKs, and one occurrence per source', async () => {
    await insertChild(childId, ownerId, parentId, 'trashed');
    await expectRejected(() => insertChild(secondChildId, ownerId, parentId, 'active'));
    await expectRejected(() => insertChild('a1000000-0000-4000-8000-000000000015', otherSystemId, otherParentId, 'active'));
    await insertContainer(childId, containerId);
    await insertExternal(childId, externalId, otherSystemId);
    await expectRejected(() => insertExternal(childId, duplicatedExternalId, otherSystemId));
    await expectRejected(() => insertExternal(childId, 'a1000000-0000-4000-8000-000000000016', 'a1000000-0000-4000-8000-000000000099'));
  });
});

async function seedLegacyData(): Promise<void> {
  await db!.query('INSERT INTO diagrams (id,name,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$4),($5,$6,$3,$4,$4)', [parentId, 'Legacy parent', 'active', timestamp, otherParentId, 'Other parent']);
  await db!.query('INSERT INTO components (id,diagram_id,name,description,type,x,y,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,0,0,$6,$6),($7,$2,$8,NULL,$9,300,0,$6,$6),($10,$2,$11,NULL,$12,600,0,$6,$6)', [ownerId, parentId, 'Payments', 'Payment system', 'legacy-service', timestamp, otherSystemId, 'Ledger', 'software-system', personId, 'Customer', 'person']);
  await db!.query('INSERT INTO relationships (id,diagram_id,source_component_id,target_component_id,direction,label,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)', [relationshipId, parentId, ownerId, otherSystemId, 'directed', 'writes', timestamp]);
  await db!.query('INSERT INTO system_groups (id,diagram_id,name,x,y,width,height,created_at,updated_at) VALUES ($1,$2,$3,0,0,800,300,$4,$4)', [groupId, parentId, 'Legacy group', timestamp]);
  await db!.query('INSERT INTO system_group_members (group_id,component_id,created_at) VALUES ($1,$2,$3),($1,$4,$3)', [groupId, ownerId, timestamp, otherSystemId]);
  await db!.query('INSERT INTO adrs (id,diagram_id,title,context,decision,consequences,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7),($8,$2,$3,$4,$5,$6,$7,$7)', [adrId, parentId, 'Legacy ADR', 'Context', 'Decision', 'Consequences', timestamp, secondAdrId]);
  await db!.query('INSERT INTO adr_component_links (adr_id,component_id,created_at) VALUES ($1,$2,$3)', [adrId, ownerId, timestamp]);
  await db!.query('INSERT INTO adr_relationship_links (adr_id,relationship_id,created_at) VALUES ($1,$2,$3)', [adrId, relationshipId, timestamp]);
}

async function insertChild(id: string, owner: string, parent: string, status: 'active' | 'trashed'): Promise<void> {
  await db!.query(`INSERT INTO diagrams (id,name,status,created_at,updated_at,kind,parent_diagram_id,owner_component_id,scope_x,scope_y,scope_width,scope_height)
    VALUES ($1,'Child',$2,$3,$3,'container',$4,$5,0,0,480,320)`, [id, status, timestamp, parent, owner]);
}

async function insertContainer(diagramId: string, id: string): Promise<void> {
  await db!.query(`INSERT INTO components (id,diagram_id,name,type,role,technology,description,x,y,width,height,created_at,updated_at)
    VALUES ($1,$2,'API','container','container','TypeScript','Handles requests',100,100,240,120,$3,$3)`, [id, diagramId, timestamp]);
}

async function insertExternal(diagramId: string, id: string, sourceId: string): Promise<void> {
  await db!.query(`INSERT INTO components (id,diagram_id,name,type,role,technology,source_component_id,description,x,y,width,height,created_at,updated_at)
    VALUES ($1,$2,'External','software-system','external',NULL,$3,NULL,600,100,180,72,$4,$4)`, [id, diagramId, sourceId, timestamp]);
}

async function expectRejected(action: () => Promise<unknown>): Promise<void> {
  let rejected = false;
  try { await action(); } catch { rejected = true; }
  expect(rejected).toBe(true);
}
