import { describe, expect, it, vi } from 'vitest';
import { runCli } from '../src/main';
import { createApiClient } from '../src/api-client';
import { spawn } from 'node:child_process';

const id='00000000-0000-4000-8000-000000000001';
const summary={id,name:'Payments\u001b[31m',kind:'general',scope:null,status:'active',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};
const preview={rootDiagramId:id,mode:'trash',affectedDiagrams:[summary],confirmationToken:'a'.repeat(64)};
function setup(answer:string|null='yes',interactive=true) {
  const stdout=vi.fn(),stderr=vi.fn(),confirm=vi.fn().mockResolvedValue(answer);
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(preview))).mockResolvedValueOnce(new Response(JSON.stringify({rootDiagramId:id,mode:'trash',affectedDiagrams:[summary]})));
  return {stdout,stderr,confirm,fetcher,io:{stdout,stderr,confirm,isTTY:interactive},client:createApiClient({fetch:fetcher})};
}
describe('CLI confirmed Trash',()=>{
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
