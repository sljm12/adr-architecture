import { describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/main';
import { createApiClient } from '../src/api-client';
import { spawn } from 'node:child_process';
import { buildApp } from '../../backend/src/api/app';
import { diagramDeletionFixture, collectionDeletionFixture } from '../../backend/tests/component-recovery-fixture';
import { DiagramService } from '../../backend/src/services/diagram-service';

const id='00000000-0000-4000-8000-000000000001';
const summary={id,name:'Payments\u001b[31m',kind:'general',scope:null,status:'active',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};
const preview={rootDiagramId:id,mode:'trash',affectedDiagrams:[summary],confirmationToken:'a'.repeat(64)};
function setup(answer:string|null='yes',interactive=true) {
  const stdout=vi.fn(),stderr=vi.fn(),confirm=vi.fn().mockResolvedValue(answer);
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(preview))).mockResolvedValueOnce(new Response(JSON.stringify({rootDiagramId:id,mode:'trash',affectedDiagrams:[summary]})));
  return {stdout,stderr,confirm,fetcher,io:{stdout,stderr,confirm,isTTY:interactive},client:createApiClient({fetch:fetcher})};
}
describe('CLI confirmed Trash',()=>{
  it.each(['trash', 'permanent'] as const)('keeps default ambiguity safe and explains unique %s collection scope', async mode => {
    const f = await collectionDeletionFixture(), app = buildApp(f.repository, f.adrs);
    const stdout = vi.fn(), stderr = vi.fn(), confirm = vi.fn().mockResolvedValue('yes');
    try {
      const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
      const fetcher = vi.fn(fetch), client = createApiClient({ baseUrl, fetch: fetcher });
      expect(await runCli(['diagrams', 'delete', '--name', f.name, `--${mode}`, '--yes'], { stdout, stderr, confirm }, client)).toBe(1);
      expect(stdout).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(stderr.mock.calls.flat().join('')).toMatch(/--id.*--all-matches/);
      expect(await f.snapshot()).toEqual(f.before);
      stdout.mockClear(); stderr.mockClear(); fetcher.mockClear();
      expect(await runCli(['diagrams', 'delete', '--name', f.name, '--all-matches', `--${mode}`, '--yes'], { stdout, stderr, confirm }, client)).toBe(0);
      const output = stdout.mock.calls.flat().join('');
      expect(output).toContain('Overlapping roots and descendants are counted once');
      expect(output).toContain(`Affected count: ${mode === 'trash' ? 6 : 8}`);
      if (mode === 'trash') expect(output).toContain('independently');
      expect(fetcher).toHaveBeenCalledTimes(2); expect(stderr).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
  it('preserves terminal-control selectors in real ambiguity diagnostics', async () => {
    const f = await diagramDeletionFixture(), app = buildApp(f.repository, f.adrs);
    const name = 'Payments\u001b[31m\n\u202e';
    for (const id of [f.ids.context, f.ids.unrelated]) await f.repository.replace({ ...(await f.repository.get(id))!, name });
    const before = await f.repository.listAll(), stdout = vi.fn(), stderr = vi.fn();
    try {
      const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
      const fetcher = vi.fn(fetch);
      expect(await runCli(['diagrams', 'delete', '--name', name, '--permanent', '--yes'], { stdout, stderr }, createApiClient({ baseUrl, fetch: fetcher }))).toBe(1);
      expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).selector).toEqual({ name });
      const output = stderr.mock.calls.flat().join('');
      expect(output).toContain('Payments\\u001b[31m\\u000a\\u202e');
      // eslint-disable-next-line no-control-regex -- Assert that terminal escape characters were removed.
      expect(output).not.toMatch(/[\u001b\u202e]/); expect(stdout).not.toHaveBeenCalled();
      expect(await f.repository.listAll()).toEqual(before);
    } finally { await app.close(); }
  });
  it.each([' Payments ', 'payments', 'Payments.*?', '支払い é', id])('forwards literal name %j', async name => {
    const s = setup(); s.fetcher.mockReset().mockResolvedValueOnce(new Response(JSON.stringify({ ...preview, affectedDiagrams: [{ ...summary, name }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ rootDiagramId: id, mode: 'trash', affectedDiagrams: [{ ...summary, name }] })));
    expect(await runCli(['diagrams', 'delete', '--name', name, '--trash', '--yes'], s.io, s.client)).toBe(0);
    expect(JSON.parse(s.fetcher.mock.calls[0][1].body).selector).toEqual({ name }); expect(s.stderr).not.toHaveBeenCalled();
  });
  it('prints duplicate UUIDs/statuses and a terminal-safe remedy only on stderr', async () => {
    const s = setup(); const candidates = [summary, { ...summary, id: '00000000-0000-4000-8000-000000000002', status: 'trashed' }];
    s.fetcher.mockReset().mockResolvedValue(new Response(JSON.stringify({ code: 'DELETE_NAME_AMBIGUOUS', message: 'Duplicate name', remedy: 'Select --id.', candidates }), { status: 409 }));
    expect(await runCli(['diagrams', 'delete', '--name', summary.name, '--permanent', '--yes'], s.io, s.client)).toBe(1);
    const errors = s.stderr.mock.calls.flat().join(''); for (const candidate of candidates) { expect(errors).toContain(candidate.id); expect(errors).toContain(`[${candidate.status}]`); }
    expect(errors).toContain('--id'); expect(errors).not.toContain('\u001b'); expect(s.stdout).not.toHaveBeenCalled(); expect(s.fetcher).toHaveBeenCalledTimes(1);
  });
  it('escapes terminal controls in invalid option diagnostics', async () => {
    const s = setup(); expect(await runCli(['diagrams', 'delete', '--id', id, '--trash', '--bad\u001b[31m'], s.io, s.client)).toBe(2);
    expect(s.stderr.mock.calls.flat().join('')).not.toContain('\u001b'); expect(s.fetcher).not.toHaveBeenCalled();
  });
  it.each([['--name', 'Payments', '--name', 'Payments', '--trash'], ['--id', id, '--permanent', '--permanent'], ['--id', id, '--trash', '--yes', '--yes'], ['--id', id, '--trash', '--unknown'], ['--id', id, '--trash', 'extra']])('refuses additional invalid usage %j before requests', async (...args) => {
    const s = setup(); expect(await runCli(['diagrams', 'delete', ...args], s.io, s.client)).toBe(2); expect(s.stdout).not.toHaveBeenCalled(); expect(s.stderr).toHaveBeenCalled(); expect(s.fetcher).not.toHaveBeenCalled();
  });
  it.each(['trash', 'permanent'] as const)('rejects stale %s consent across real HTTP in prompts and scripts without retry', async mode => {
    for (const scripted of [false, true]) {
      const { repository, adrs, ids } = await diagramDeletionFixture(); const service = new DiagramService(repository, adrs), app = buildApp(repository, adrs);
      const stdout = vi.fn(), stderr = vi.fn(); let requests = 0;
      const edit = async () => { const d = (await repository.get(ids.child))!; d.components[0].description = 'Concurrent saved edit'; await service.save(d.id, d); };
      try {
        const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
        const client = createApiClient({ baseUrl, fetch: async (url, init) => {
          requests++; const response = await fetch(url, init);
          // HTTP barrier: the preview has committed, but execution has not started.
          if (scripted && requests === 1) await edit();
          return response;
        } });
        expect(await runCli(['diagrams', 'delete', '--id', ids.context, `--${mode}`, ...(scripted ? ['--yes'] : [])], { stdout, stderr, isTTY: true, confirm: async () => { await edit(); return 'yes'; } }, client)).toBe(1);
        expect(requests).toBe(2); expect(stderr.mock.calls.flat().join('')).toContain('fresh preview'); expect(stdout.mock.calls.flat().join('')).not.toMatch(/Moved to Trash:|Permanently deleted:/);
        expect((await repository.get(ids.child))!.components[0].description).toBe('Concurrent saved edit'); expect((await repository.get(ids.context))!.status).toBe('active');
      } finally { await app.close(); }
    }
  });
  it.each(['trash', 'permanent'] as const)('reports response loss after a committed %s without retrying', async mode => {
    const { repository, adrs, ids } = await diagramDeletionFixture(); const app = buildApp(repository, adrs); const stdout = vi.fn(), stderr = vi.fn(); let requests = 0;
    try {
      const baseUrl = await app.listen({ host: '127.0.0.1', port: 0 });
      const client = createApiClient({ baseUrl, fetch: async (url, init) => { requests++; const response = await fetch(url, init); if (requests === 2) { expect(response.status).toBe(200); await response.text(); throw new Error('Response lost after commit'); } return response; } });
      expect(await runCli(['diagrams', 'delete', '--id', ids.context, `--${mode}`, '--yes'], { stdout, stderr }, client)).toBe(1);
      expect(requests).toBe(2); expect(stderr.mock.calls.flat().join('')).toMatch(/uncertain.*Verify.*before retrying/); expect(stdout.mock.calls.flat().join('')).not.toMatch(/Moved to Trash:|Permanently deleted:/);
      expect((await repository.get(ids.context))?.status).toBe(mode === 'trash' ? 'trashed' : undefined);
    } finally { await app.close(); }
  });
  it.each(['yes',' YES '])('prints impact, accepts %j, and executes exactly once by resolved UUID',async answer=>{
    const s=setup(answer);s.fetcher.mockReset().mockResolvedValueOnce(new Response(JSON.stringify({...preview,affectedDiagrams:[{...summary,name:' Literal name '}]}))).mockResolvedValueOnce(new Response(JSON.stringify({rootDiagramId:id,mode:'trash',affectedDiagrams:[summary]})));expect(await runCli(['diagrams','delete','--name',' Literal name ','--trash'],s.io,s.client)).toBe(0);
    expect(JSON.parse(s.fetcher.mock.calls[0][1].body)).toEqual({selector:{name:' Literal name '},mode:'trash'});
    expect(s.fetcher.mock.calls[1][0]).toContain(`/diagrams/${id}/deletion`);
    expect(JSON.parse(s.fetcher.mock.calls[1][1].body)).toEqual({mode:'trash',confirmationToken:preview.confirmationToken});
    expect(s.fetcher).toHaveBeenCalledTimes(2);
    const output=s.stdout.mock.calls.flat().join('');expect(output).toContain('recover');expect(output).toContain('ADR');expect(output).toContain('Moved to Trash');expect(output).not.toContain(preview.confirmationToken);expect(output).not.toContain('\u001b');
  });
  it.each(['no','y','',null])('cancels %j without execution',async answer=>{const s=setup(answer);expect(await runCli(['diagrams','delete','--id',id,'--trash'],s.io,s.client)).toBe(1);expect(s.fetcher).toHaveBeenCalledTimes(1);expect(s.stderr.mock.calls.flat().join('')).toContain('cancel');});
  it('cancels interrupted confirmation',async()=>{const s=setup();s.confirm.mockRejectedValue(new Error('Interrupted'));expect(await runCli(['diagrams','delete','--id',id,'--trash'],s.io,s.client)).toBe(1);expect(s.fetcher).toHaveBeenCalledTimes(1);});
  it.each([['--id',id],['--name',summary.name]])('confirms irreversible permanent scope using %j',async(selector,value)=>{
    const s=setup(); const child={...summary,id:'00000000-0000-4000-8000-000000000002',status:'trashed',kind:'container',scope:{parentDiagramId:id,softwareSystemId:'00000000-0000-4000-8000-000000000003',parentDiagramName:summary.name,softwareSystemName:'Child',softwareSystemDescription:null}};
    const impact={...preview,mode:'permanent',affectedDiagrams:[summary,child]};
    s.fetcher.mockReset().mockResolvedValueOnce(new Response(JSON.stringify(impact))).mockResolvedValueOnce(new Response(JSON.stringify({rootDiagramId:id,mode:'permanent',affectedDiagrams:impact.affectedDiagrams})));
    expect(await runCli(['diagrams','delete',selector,value,'--permanent','--yes'],s.io,s.client)).toBe(0);
    expect(s.fetcher).toHaveBeenCalledTimes(2);expect(s.confirm).not.toHaveBeenCalled();
    const output=s.stdout.mock.calls.flat().join('');expect(output).toContain('irreversible');expect(output).toContain('previously trashed');expect(output).toContain('[trashed]');expect(output).toContain('Permanently deleted');expect(output).not.toContain(preview.confirmationToken);
  });
  it.each(['blocked','uncertain'])('never claims permanent success when execution is %s',async outcome=>{
    const s=setup();s.fetcher.mockReset().mockResolvedValueOnce(new Response(JSON.stringify({...preview,mode:'permanent'})));
    if(outcome==='blocked')s.fetcher.mockResolvedValueOnce(new Response(JSON.stringify({code:'DIAGRAM_DEPENDENCY',message:'Outside dependency',remedy:'Resolve the reference.',blockers:[{diagramId:id,artifactId:id,reason:'ADR replacement',nextAction:'Repair ADR.'}]}),{status:409}));
    else s.fetcher.mockRejectedValueOnce(new Error('Response lost'));
    expect(await runCli(['diagrams','delete','--id',id,'--permanent','--yes'],s.io,s.client)).toBe(1);
    expect(s.fetcher).toHaveBeenCalledTimes(2);expect(s.stdout.mock.calls.flat().join('')).not.toContain('Permanently deleted');
    expect(s.stderr.mock.calls.flat().join('')).toContain(outcome==='blocked'?'Repair ADR':'Verify');
  });
  it('refuses non-TTY input and accepts explicit --yes without prompting',async()=>{
    const s=setup('yes',false);expect(await runCli(['diagrams','delete','--id',id,'--trash'],s.io,s.client)).toBe(1);expect(s.confirm).not.toHaveBeenCalled();expect(s.fetcher).toHaveBeenCalledTimes(1);
    const yes=setup(null,false);expect(await runCli(['diagrams','delete','--id',id,'--trash','--yes'],yes.io,yes.client)).toBe(0);expect(yes.confirm).not.toHaveBeenCalled();
  });
  it.each([['--trash'],['--id',id],['--name',' ' ,'--trash'],['--id','bad','--trash'],['--id',id,'--name','Payments','--trash'],['--id',id,'--trash','--permanent'],['--id',id,'--trash','--trash'],['--id',id,'--id',id,'--trash'],['--id',id,'--trash','--format','json'],['--id',id,'--trash','--output','x'],[id,'--trash']])('rejects invalid usage %j before requests',async(...args)=>{const s=setup();expect(await runCli(['diagrams','delete',...args],s.io,s.client)).toBe(2);expect(s.fetcher).not.toHaveBeenCalled();});
  it.each([['yes\n',0], [null,1], ['\u0003',1]] as const)('handles real readline input %j',async (input,expected)=>{
    const script=`import {runCli} from './cli/src/main.ts'; import {createApiClient} from './cli/src/api-client.ts'; process.stdin.isTTY=true; let calls=0; const impact=${JSON.stringify(preview)}; const client=createApiClient({fetch:async()=>new Response(JSON.stringify(++calls===1?impact:{rootDiagramId:impact.rootDiagramId,mode:impact.mode,affectedDiagrams:impact.affectedDiagrams}))}); process.exitCode=await runCli(['diagrams','delete','--id',${JSON.stringify(id)},'--trash'],undefined,client); console.error('REQUESTS:'+calls);`;
    const result=await new Promise<{code:number|null;output:string}>((resolve,reject)=>{
      const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',script],{stdio:'pipe',timeout:5000,windowsHide:true});let output='',answered=false;
      child.stdout.on('data',data=>{output+=data;});
      child.stderr.on('data',data=>{output+=data;if(!answered&&output.includes('Type yes to confirm:')){answered=true;if(input===null)child.stdin.end();else child.stdin.write(input);}});
      child.on('error',reject);child.on('exit',code=>resolve({code,output}));
    });
    expect(result.code,result.output).toBe(expected);expect(result.output).toContain(`REQUESTS:${expected===0?2:1}`);expect(result.output).not.toContain(preview.confirmationToken);
  });
});
