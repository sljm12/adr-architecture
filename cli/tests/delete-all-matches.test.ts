import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../src/main';
import { DiagramService } from '../../backend/src/services/diagram-service';
import { collectionCliFixture } from './deletion-collection-fixture';

const fixtures: Awaited<ReturnType<typeof collectionCliFixture>>[] = [];
afterEach(async () => { await Promise.all(fixtures.splice(0).map(f => f.app.close())); });
async function setup() { const f = await collectionCliFixture(); fixtures.push(f); return f; }
const args = (name: string, mode = 'trash') => ['diagrams', 'delete', '--name', name, '--all-matches', `--${mode}`];

describe('all-matches CLI over listening HTTP', () => {
  it.each(['trash', 'permanent'])('previews all roots and unique impact then commits once: %s', async mode => {
    const f = await setup();
    expect(await runCli([...args(f.name, mode), '--yes'], f.io, f.client)).toBe(0);
    expect(f.requests).toHaveLength(2);
    expect(f.requests[0].url).toContain('/diagrams/deletion-set-preview');
    expect(f.requests[0].body).toEqual({ target: { kind: 'all-matches', name: f.name, mode } });
    expect(f.requests[1].body.rootDiagramIds).toHaveLength(6);
    expect(f.requests[1].body.target).toEqual(f.requests[0].body.target);
    expect(f.output()).toContain('Affected count:');
    for (const id of f.requests[1].body.rootDiagramIds) expect(f.output()).toContain(id);
    expect(f.output()).not.toContain(f.requests[1].body.confirmationToken);
    expect(f.output()).toContain(mode === 'trash' ? 'Moved to Trash' : 'Permanently deleted');
    expect(f.confirm).not.toHaveBeenCalled(); expect(f.errors()).toBe('');
  });
  it.each([' Literal name ', '支払い é', '00000000-0000-4000-8000-000000000001', 'Control\u001b[31m'])('forwards literal %j and escapes display', async name => {
    const f = await setup(); const service = new DiagramService(f.repository, f.adrs);
    const document = await service.create('Temporary');
    await f.repository.replace({ ...document, name });
    expect(await runCli([...args(name), '--yes'], f.io, f.client)).toBe(name.trim() === name ? 0 : 1);
    expect(f.requests[0].body.target.name).toBe(name); expect(f.output()).not.toContain('\u001b');
    if (name.trim() !== name) { expect(f.requests).toHaveLength(1); expect((await f.repository.get(document.id))!.status).toBe('active'); }
  });
  it.each(['no', 'y', '', null, 'interrupt', 'nonTTY', ' YES '])('handles consent %j', async answer => {
    const f = await setup();
    if (answer === 'interrupt') f.confirm.mockRejectedValue(new Error('SIGINT'));
    else f.confirm.mockResolvedValue(answer);
    const success = answer === ' YES ';
    expect(await runCli(args(f.name), { ...f.io, isTTY: answer !== 'nonTTY' }, f.client)).toBe(success ? 0 : 1);
    expect(f.requests).toHaveLength(success ? 2 : 1);
    if (!success) expect(await f.snapshot()).toEqual(f.before);
  });
  it.each([
    ['--id', '00000000-0000-4000-8000-000000000001', '--trash', '--all-matches'],
    ['--all-matches', '--trash'], ['--name', 'x', '--trash', '--all-matches', '--all-matches'],
  ])('rejects invalid collection syntax %j', async flags => {
    const f = await setup(); expect(await runCli(['diagrams', 'delete', ...flags], f.io, f.client)).toBe(2); expect(f.requests).toHaveLength(0);
  });
  it('retains ordinary endpoint dispatch and duplicate refusal', async () => {
    const f = await setup();
    expect(await runCli(['diagrams', 'delete', '--name', f.name, '--trash', '--yes'], f.io, f.client)).toBe(1);
    expect(f.requests[0].url).toContain('/diagrams/deletion-preview'); expect(f.requests).toHaveLength(1);
    expect(f.errors()).toContain('More than one');
  });
  it.each([false, true])('rejects changed match membership for scripted=%s', async scripted => {
    const f = await setup(); const add = async () => { await new DiagramService(f.repository, f.adrs).create(f.name); };
    if (scripted) f.setAfterPreview(add); else f.confirm.mockImplementation(async () => { await add(); return 'yes'; });
    expect(await runCli([...args(f.name), ...(scripted ? ['--yes'] : [])], f.io, f.client)).toBe(1);
    expect(f.requests).toHaveLength(2); expect(f.errors()).toContain('fresh preview'); expect(f.output()).not.toContain('Moved to Trash:');
    expect((await f.repository.listAll()).every(d => f.before.documents.find(b => b.id === d.id)?.status === 'trashed' || d.status === 'active')).toBe(true);
  });
  it.each(['lost', 'malformed', 'target', 'roots', 'affected', 'count'])('never retries or claims success after %s response', async fault => {
    const f = await setup();
    f.setExecutionResponse(async response => {
      const result = await response.json(); expect(response.status).toBe(200);
      if (fault === 'lost') throw new Error('Lost after commit');
      if (fault === 'malformed') return new Response('{');
      if (fault === 'target') result.target.name = 'Different';
      if (fault === 'roots') result.rootDiagramIds.pop();
      if (fault === 'affected') result.affectedDiagrams[0].name = 'Different';
      if (fault === 'count') result.affectedCount++;
      return new Response(JSON.stringify(result));
    });
    expect(await runCli([...args(f.name), '--yes'], f.io, f.client)).toBe(1);
    expect(f.requests).toHaveLength(2); expect(f.errors()).toContain('uncertain'); expect(f.output()).not.toContain('Moved to Trash:');
  });
  it.each(['target', 'root-name', 'malformed'])('rejects invalid %s preview without execution', async fault => {
    const f = await setup(); f.setPreviewResponse(async response => {
      if (fault === 'malformed') return new Response('{}');
      const impact = await response.json();
      if (fault === 'target') impact.target.name = 'Wrong';
      else impact.affectedDiagrams.find((d: any) => impact.rootDiagramIds.includes(d.id)).name = 'Wrong';
      return new Response(JSON.stringify(impact));
    });
    expect(await runCli([...args(f.name), '--yes'], f.io, f.client)).toBe(1); expect(f.requests).toHaveLength(1); expect(f.confirm).not.toHaveBeenCalled();
  });
});
