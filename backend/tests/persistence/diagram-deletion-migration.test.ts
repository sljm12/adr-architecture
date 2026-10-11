import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { componentTestDatabase, postgresEnabled } from './component-test-database';

describe.skipIf(!postgresEnabled)('deletion revision migration 0008', () => {
  it('defaults counters to zero and preserves all pre-existing rows and restrictive references', async () => {
    const database = await componentTestDatabase(true, false);
    const id = crypto.randomUUID(), component = crypto.randomUUID(), other = crypto.randomUUID(), relationship = crypto.randomUUID(), adr = crypto.randomUUID(), group = crypto.randomUUID();
    try {
      await database.pool.query("INSERT INTO diagrams (id,name,status,created_at,updated_at,trashed_at,trash_batch_id,trash_root_diagram_id) VALUES ($1,'Preserved','trashed',now(),now(),now(),$2,$1)", [id, crypto.randomUUID()]);
      for (const c of [component, other]) await database.pool.query("INSERT INTO components (id,diagram_id,name,type,x,y,created_at,updated_at) VALUES ($1,$2,'System','software-system',0,0,now(),now())", [c, id]);
      await database.pool.query("INSERT INTO relationships (id,diagram_id,source_component_id,target_component_id,direction,created_at,updated_at) VALUES ($1,$2,$3,$4,'directed',now(),now())", [relationship, id, component, other]);
      await database.pool.query("INSERT INTO adrs (id,diagram_id,title,context,decision,consequences,status,created_at,updated_at) VALUES ($1,$2,'ADR','Context','Decision','Consequences','accepted',now(),now())", [adr,id]);
      await database.pool.query('INSERT INTO adr_component_links VALUES ($1,$2,now())', [adr, component]);
      await database.pool.query('INSERT INTO adr_relationship_links VALUES ($1,$2,now())', [adr, relationship]);
      await database.pool.query("INSERT INTO system_groups VALUES ($1,$2,'Team',0,0,480,320,now(),now())", [group,id]);
      for (const c of [component,other]) await database.pool.query('INSERT INTO system_group_members VALUES ($1,$2,now())', [group,c]);
      const tables = ['diagrams','components','relationships','adrs','adr_component_links','adr_relationship_links','system_groups','system_group_members'];
      const snapshot = async () => Promise.all(tables.map(async table => (await database.pool.query(`SELECT to_jsonb(t) - 'deletion_revision' AS value FROM ${table} t ORDER BY 1`)).rows));
      const before = await snapshot();
      await database.pool.query(await readFile(new URL('../../drizzle/0008_diagram_deletion_revision.sql', import.meta.url),'utf8'));
      expect(await snapshot()).toEqual(before);
      expect(await database.diagrams.getDeletionRevision(id)).toBe('0');
      await database.pool.query('UPDATE diagrams SET deletion_revision=9007199254740993 WHERE id=$1',[id]);
      await database.diagrams.incrementDeletionRevision(id);
      expect(await database.diagrams.getDeletionRevision(id)).toBe('9007199254740994');
      await expect(database.pool.query('UPDATE diagrams SET deletion_revision=-1 WHERE id=$1',[id])).rejects.toMatchObject({ code:'23514' });
      await expect(database.pool.query('DELETE FROM diagrams WHERE id=$1',[id])).rejects.toMatchObject({ code:'23503' });
    } finally { await database.close(); }
  });
});
