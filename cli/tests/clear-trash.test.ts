import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/main';
import { DiagramService } from '../../backend/src/services/diagram-service';
import { collectionCliFixture } from './deletion-collection-fixture';

const fixtures: Awaited<ReturnType<typeof collectionCliFixture>>[] = [];
afterEach(async () => { await Promise.all(fixtures.splice(0).map(f => f.app.close())); });
async function setup() { const f = await collectionCliFixture(); fixtures.push(f); return f; }
const args = ['diagrams', 'clear-trash'];
describe('clear-Trash CLI over listening HTTP', () => {
  it('returns count-zero success without prompt or execution for empty Trash', async () => {
    const f = await setup(); const service = new DiagramService(f.repository, f.adrs);
    for (const id of [f.first.datastoreChild, f.second.datastoreChild]) await service.restore(id);
    const before = await f.snapshot();
    expect(await runCli(args, { ...f.io, isTTY: false }, f.client)).toBe(0);
    expect(f.requests).toHaveLength(1); expect(f.confirm).not.toHaveBeenCalled();
    expect(f.output()).toContain('Trash is already empty'); expect(f.output()).toContain('Affected count: 0'); expect(await f.snapshot()).toEqual(before);
  });
  it.each([false, true])('commits exactly reviewed Trash with scripted=%s', async scripted => {
    const f = await setup();
    expect(await runCli([...args, ...(scripted ? ['--yes'] : [])], f.io, f.client)).toBe(0);
    expect(f.requests).toHaveLength(2); expect(f.requests[0].body).toEqual({ target: { kind: 'clear-trash' } });
    expect(f.requests[1].body.rootDiagramIds).toEqual([]); expect(f.requests[1].body.target).toEqual({ kind: 'clear-trash' });
    expect(f.output()).toContain('irreversible'); expect(f.output()).toContain('all Trash batches'); expect(f.output()).toContain('Affected count: 2');
    expect(f.output()).toContain('Permanently deleted'); expect(f.output()).not.toContain(f.requests[1].body.confirmationToken);
    for (const d of f.before.documents) expect(await f.repository.get(d.id)).toEqual(d.status === 'trashed' ? undefined : d);
    expect(f.confirm).toHaveBeenCalledTimes(scripted ? 0 : 1);
  });
  it.each(['no', '', null, 'interrupt', 'nonTTY'])('refuses consent %j without execution', async answer => {
    const f = await setup();
    if (answer === 'interrupt') f.confirm.mockRejectedValue(new Error('SIGINT')); else f.confirm.mockResolvedValue(answer);
    expect(await runCli(args, { ...f.io, isTTY: answer !== 'nonTTY' }, f.client)).toBe(1);
    expect(f.requests).toHaveLength(1); expect(await f.snapshot()).toEqual(f.before);
  });
  it.each([['--name', 'x'], ['--id', '00000000-0000-4000-8000-000000000001'], ['--trash'], ['--permanent'], ['--all-matches'], ['--format', 'json'], ['--output', 'x.zip'], ['--yes', '--yes'], ['extra']])('rejects inapplicable options %j before requests', async flags => {
    const f = await setup(); expect(await runCli([...args, ...flags], f.io, f.client)).toBe(2); expect(f.requests).toHaveLength(0);
  });
  it.each(['membership', 'content'])('rejects stale %s in prompts and scripts', async change => {
    for (const scripted of [false, true]) {
      const f = await setup(); const service = new DiagramService(f.repository, f.adrs);
      const edit = async () => {
        if (change === 'membership') await service.trash(f.first.unrelated);
        else {
          const d = await service.restore(f.first.datastoreChild);
          await service.save(d.id, { ...d, boundary: { ...d.boundary!, position: { x: 120, y: 120 } } });
          await service.trash(d.id);
        }
      };
      if (scripted) f.setAfterPreview(edit); else f.confirm.mockImplementation(async () => { await edit(); return 'yes'; });
      expect(await runCli([...args, ...(scripted ? ['--yes'] : [])], f.io, f.client)).toBe(1);
      expect(f.requests).toHaveLength(2); expect(f.errors()).toContain('fresh preview'); expect(f.output()).not.toContain('Permanently deleted:');
      expect(await f.repository.get(f.first.datastoreChild)).toBeDefined();
    }
  });
  it.each(['lost', 'malformed', 'target', 'affected', 'count', 'roots'])('reports uncertain %s execution without retry', async fault => {
    const f = await setup(); f.setExecutionResponse(async response => {
      expect(response.status).toBe(200); const result = await response.json();
      if (fault === 'lost') throw new Error('Lost after commit');
      if (fault === 'malformed') return new Response('{');
      if (fault === 'target') result.target = { kind: 'all-matches', name: f.name, mode: 'permanent' };
      if (fault === 'affected') result.affectedDiagrams[0].name = 'Wrong';
      if (fault === 'count') result.affectedCount++;
      if (fault === 'roots') result.rootDiagramIds = [f.first.context];
      return new Response(JSON.stringify(result));
    });
    expect(await runCli([...args, '--yes'], f.io, f.client)).toBe(1);
    expect(f.requests).toHaveLength(2); expect(f.errors()).toContain('uncertain'); expect(f.output()).not.toContain('Permanently deleted:');
    expect(await f.repository.get(f.first.datastoreChild)).toBeUndefined();
  });
});
